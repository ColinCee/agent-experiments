"""Verdicts: each rule trial's before against its after, due on its third day of real use; and measures out of their
usual range.

How and why: docs/architecture.md#verdicts. Reads and writes the experiments file that counting.py builds.
"""

import math
import re
from dataclasses import asdict, dataclass, replace
from datetime import date, timedelta
from pathlib import Path

import duckdb
import numpy as np

from agent_experiments.replay import stands
from agent_experiments.stats import compare, rate_range

REAL_DAYS = 3  # a trial's verdict is due on its third day of real use, never later
BEFORE_DAYS = 42  # the before side reaches back this far, or to the measure's rule change before it if later
MIN_TASKS = 8  # under this the after side's range runs narrow enough to call a do-nothing change (tests/test_stats.py)
RARE = 2  # chances per day of real use under which three days hold too few, so a replay is the test
OWN_CHANGE = 3  # a `changes` row this close before a trial's start dates that trial's own change
# Settled trials that started earlier were judged against a holdout, and most of their starts changed no rule.
JUDGED_FROM = "2026-11-17"
USUAL_DAYS = 28
FLAG_ROUNDS = 2000
LATEST_MISSES = 5  # enough sessions for an agent to see a pattern, few enough to read in one sitting

# One row per session someone typed in (through its root): its task, the hook's task token when its stamps agree on
# one, else the root session; scheduled runs and scripted calls are not what the rules are for.
TASKS = """
CREATE OR REPLACE TEMP VIEW tasks AS
WITH kept AS (
  SELECT DISTINCT session, root FROM sessions
  WHERE root IN (SELECT session FROM sessions GROUP BY session HAVING sum(typed) > 0)),
token AS (
  SELECT k.session, any_value(k.root) AS root, count(st.stamp) AS stamps,
         count(DISTINCT nullif(regexp_extract(st.stamp, '(?:^| )task=(\\w+)', 1), '')) AS tasks,
         max(nullif(regexp_extract(st.stamp, '(?:^| )task=(\\w+)', 1), '')) AS task
  FROM kept k LEFT JOIN stamps st ON st.session IN (k.session, k.root) GROUP BY k.session)
SELECT session, root, stamps > 0 AS stamped, CASE WHEN tasks = 1 THEN task ELSE root END AS task FROM token;
"""
MISSES = """SELECT c.session, max(c."day") FROM chances c JOIN tasks t USING (session)
WHERE c.measure = $measure AND c."day" BETWEEN $first AND $last AND c.miss
GROUP BY ALL ORDER BY max(c.ts) DESC, c.session LIMIT $n
"""


@dataclass(frozen=True)
class Trial:
    name: str
    status: str  # testing until its verdict is acted on, then settled
    measures: tuple[str, ...]
    started: str
    title: str = ""  # the page's name for it; the file name is what stamps use
    what: str = ""  # the change, in plain words: its `changes` row
    filed: bool = True  # a trial file in the agents repo, which `daily` asks to update; else a bare `changes` row
    wording: str = ""  # its `## On` lines, which the hook gives every task


@dataclass(frozen=True)
class Verdict:
    trial: str
    started: str  # with the name, so a trial restarted under it gets a verdict of its own
    measure: str
    day: str  # its third day of real use, the after side's last
    source: str  # "before and after", or "replay" for a rare measure the replay settled
    tasks_before: int
    tasks_after: int
    rate_before: float
    rate_after: float
    change: float  # after / before - 1, so below 0 is fewer misses
    low: float  # its 90% range
    high: float
    verdict: str  # works, worse or no big effect


def read_trials(folder: Path, errors: list[str]) -> list[Trial]:
    """Trial files as docs/keep-going.md in the agents repo describes them: front matter with status, measures, started
    and an optional name. A file with no valid `started` is left out and added to `errors`."""
    trials = []
    for path in sorted(folder.glob("*.md")) if folder.is_dir() else []:
        text = path.read_text(encoding="utf-8")

        def field(name: str, text: str = text) -> str:
            found = re.search(rf"^{name}:\s*(.+?)\s*$", text, re.MULTILINE)
            return found.group(1).strip("'\"") if found else ""

        try:
            started = date.fromisoformat(field("started")).isoformat()
        except ValueError:
            errors.append(f"{path}: needs a line `started: YYYY-MM-DD`, found {field('started')!r}; left out.")
            continue
        measures = tuple(m.strip() for m in field("measures").split(",") if m.strip())
        status = "settled" if field("status") == "settled" else "testing"
        on = re.search(r"^## On\s*\n(.*?)(?=^## |\Z)", text, re.MULTILINE | re.DOTALL)
        wording = "\n".join(line.strip() for line in on.group(1).splitlines() if line.strip()) if on else ""
        trials.append(Trial(path.stem, status, measures, started, field("name"), wording=wording))
    return trials


def shift(day: str, days: int) -> str:
    return (date.fromisoformat(day) + timedelta(days=days)).isoformat()


def open_store(db: Path) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(str(db))
    con.execute(TASKS)
    return con


def real_days(con, first: str, last: str) -> list[str]:
    """Days from `first` to `last` on which someone typed in a session: a day nobody used the agents tells nothing."""
    rows = con.execute(
        """SELECT "day" FROM sessions WHERE "day" BETWEEN ? AND ? GROUP BY "day" HAVING sum(typed) > 0 ORDER BY 1""",
        [first, last],
    ).fetchall()
    return [d for (d,) in rows]


def due(con, trial: Trial, day: str) -> tuple[str | None, int]:
    """A trial's verdict day, its third day of real use from `started`, once `day` has reached it; and how many days of
    real use it has had by `day`, at most three."""
    used = real_days(con, trial.started, day)[:REAL_DAYS]
    return (used[-1] if len(used) == REAL_DAYS else None), len(used)


def own(trial: Trial, measure: str, day: str) -> bool:
    """A `changes` row on `day` dates this trial's own change."""
    return measure in trial.measures and shift(trial.started, -OWN_CHANGE) <= day <= trial.started


def with_changes(con, trials: list[Trial]) -> list[Trial]:
    """The trial files, each with its change in plain words, and every other rule change from JUDGED_FROM as a trial
    of its own, so each rule change gets one verdict (docs/architecture.md#verdicts). A change that dated a trial
    already judged is that trial's, even once its file has moved on to a new wording and start."""
    found = con.execute('SELECT measure, "day", what FROM changes ORDER BY "day", measure').fetchall()
    now = {(t.name, t.started) for t in trials}
    # A trial file's earlier starts. A bare change's own verdict is not one: it started on its change's day, which a
    # trial file, started the day after its change went in, never does.
    earlier = [
        Trial(t, "settled", (m,), s)
        for t, s, m in con.execute("SELECT trial, started, measure FROM verdicts").fetchall()
        if t in {name for name, _ in now} and (t, s) not in now
    ]
    filed = [replace(t, what=next((w for m, d, w in found if own(t, m, d)), "")) for t in trials]
    bare: dict[tuple[str, str], list[str]] = {}
    for measure, day, what in found:
        if day >= JUDGED_FROM and not any(
            own(t, measure, day) for t in trials + [e for e in earlier if e.started != day]
        ):
            bare.setdefault((measure, day), []).append(what)  # changes on one day are one change, with one verdict
    return filed + [
        Trial(measure, "testing", (measure,), day, what="; ".join(whats), filed=False)
        for (measure, day), whats in bare.items()
    ]


def before_from(con, trial: Trial, measure: str) -> str:
    """The before side's first day: BEFORE_DAYS back, or the measure's earlier rule change if that is later."""
    found = con.execute(
        """SELECT max("day") FROM changes WHERE measure = ? AND "day" < ?""",
        [measure, shift(trial.started, -OWN_CHANGE)],
    ).fetchone()
    return max(found[0] if found and found[0] else "", shift(trial.started, -BEFORE_DAYS))


def sides(con, trial: Trial, measure: str, last: str) -> tuple[np.ndarray, np.ndarray]:
    """A trial's tasks before its start, and from its start to `last`, as rows of (chances, misses)."""
    before = measure_tasks(con, measure, before_from(con, trial, measure), shift(trial.started, -1))
    return before, measure_tasks(con, measure, trial.started, last)


def is_rare(con, trial: Trial, measure: str) -> bool:
    """Under RARE chances per day of real use before the trial: its three days would hold too few to tell."""
    first, last = before_from(con, trial, measure), shift(trial.started, -1)
    days = len(real_days(con, first, last))
    found = con.execute(
        """SELECT count(*) FROM chances c JOIN tasks t USING (session)
           WHERE c.measure = ? AND c."day" BETWEEN ? AND ?""",
        [measure, first, last],
    ).fetchone()
    return not days or (found[0] if found else 0) / days < RARE


def latest_replay(con, trial: Trial, measure: str) -> dict | None:
    """The measure's latest replay from just before the trial's start on, the one that tested its wording."""
    found = con.execute(
        """SELECT * FROM replays WHERE measure = ? AND "day" >= ? ORDER BY "day" DESC, folder DESC LIMIT 1""",
        [measure, shift(trial.started, -OWN_CHANGE)],
    )
    row = found.fetchone()
    return dict(zip([d[0] for d in found.description], row, strict=True)) if row else None


def call(low: float, high: float, enough: bool) -> str:
    """Works when the whole 90% range is fewer misses, worse when it is all more, else no big effect: on its third day
    of real use a trial gets no more time."""
    if enough and high < 0:
        return "works"
    if enough and low > 0:
        return "worse"
    return "no big effect"


def judge(con, trial: Trial, measure: str, day: str, rng: np.random.Generator) -> Verdict | None:
    """A trial's verdict for one measure: the stored one, else one taken and stored now if due by `day`, else None. A
    verdict is never retaken. A rare measure's trusted replay decides when before and after cannot."""
    found = con.execute(
        "SELECT * FROM verdicts WHERE trial = ? AND started = ? AND measure = ?", [trial.name, trial.started, measure]
    ).fetchone()
    if found:
        return Verdict(*found)
    last, _ = due(con, trial, day)
    if last is None:
        return None
    before, after = sides(con, trial, measure, last)
    effect = compare(before, after, rng, resamples=99) if min(len(before), len(after)) > 1 else None
    change, low, high = (-effect.drop, -effect.high, -effect.low) if effect else (math.nan,) * 3
    source, verdict = "before and after", call(low, high, min(len(before), len(after)) >= MIN_TASKS)
    replayed = latest_replay(con, trial, measure) if is_rare(con, trial, measure) else None
    if verdict == "no big effect" and replayed and replayed["real_rate"] is not None:
        r = (-replayed["drop"], -replayed["high"], -replayed["low"])
        if stands(replayed["real_rate"], replayed["replay_rate"]) and call(r[1], r[2], True) != "no big effect":
            source, verdict, (change, low, high) = "replay", call(r[1], r[2], True), r
    rates = [b[:, 1].sum() / b[:, 0].sum() if len(b) else math.nan for b in (before, after)]
    taken = Verdict(
        trial.name, trial.started, measure, last, source, len(before), len(after), *rates, change, low, high, verdict
    )
    con.execute("INSERT INTO verdicts VALUES (" + ", ".join("?" * 13) + ")", list(asdict(taken).values()))
    return taken


def latest_misses(con, measure: str, first: str, last: str) -> list[dict]:
    """The sessions with the latest misses over some days, newest first, each with its last day with a miss."""
    args = {"measure": measure, "first": first, "last": last, "n": LATEST_MISSES}
    return [{"day": d, "session": s} for s, d in con.execute(MISSES, args).fetchall()]


def measure_tasks(con, measure: str, first: str, last: str) -> np.ndarray:
    """Every task's (chances, misses) for a measure over some days, trial groups aside."""
    rows = con.execute(
        """SELECT count(*), sum(c.miss::INT) FROM chances c JOIN tasks t USING (session)
           WHERE c.measure = ? AND c."day" BETWEEN ? AND ? GROUP BY t.task""",
        [measure, first, last],
    ).fetchall()
    return np.array(rows, dtype=float).reshape(-1, 2)


def side(con, measure: str, first: str, last: str, rng: np.random.Generator) -> tuple[dict | None, np.ndarray]:
    """A measure's misses over some days with their 90% range, and its tasks; no side with no tasks."""
    tasks = measure_tasks(con, measure, first, last)
    if not len(tasks):
        return None, tasks
    rate, low, high = rate_range(tasks, rng)
    return {"rate": rate, "low": low, "high": high, "tasks": len(tasks), "from": first}, tasks


def by_day(con, measure: str, first: str, last: str) -> dict[str, tuple[int, int]]:
    """Each day's (chances, misses) for a measure, in the same tasks as measure_tasks."""
    rows = con.execute(
        """SELECT c."day", count(*), sum(c.miss::INT) FROM chances c JOIN tasks t USING (session)
           WHERE c.measure = ? AND c."day" BETWEEN ? AND ? GROUP BY c."day\"""",
        [measure, first, last],
    ).fetchall()
    return {d: (c, m) for d, c, m in rows}


def rolling(
    counts: dict[str, tuple[int, int]], first: str, last: str, width: int = 3
) -> list[tuple[str, float | None]]:
    """Each day's share of chances missed over it and the `width - 1` days before; None with no chances."""
    out = []
    for i in range((date.fromisoformat(last) - date.fromisoformat(first)).days + 1):
        day = shift(first, i)
        window = [counts.get(shift(day, -k), (0, 0)) for k in range(width)]
        chances = sum(c for c, _ in window)
        out.append((day, sum(m for _, m in window) / chances if chances else None))
    return out


def flag(con, measure: str, day: str, rng: np.random.Generator) -> dict | None:
    """Whether `day`'s miss rate lies outside the middle 98% of what the same number of tasks from the 28 days before
    gave; None with too little history to say."""
    today = measure_tasks(con, measure, day, day)
    before = measure_tasks(con, measure, shift(day, -USUAL_DAYS), shift(day, -1))
    if not len(today) or len(before) < 10:
        return None
    draws = before[rng.integers(len(before), size=(FLAG_ROUNDS, len(today)))]
    rates = draws[..., 1].sum(axis=1) / draws[..., 0].sum(axis=1)
    low, high = np.quantile(rates, [0.01, 0.99])
    rate = today[:, 1].sum() / today[:, 0].sum()
    return {"tasks": len(today), "rate": rate, "low": low, "high": high, "flagged": not low <= rate <= high}


def measures(con) -> list[str]:
    return [m for (m,) in con.execute("SELECT DISTINCT measure FROM chances ORDER BY measure").fetchall()]


def stamped(con, day: str) -> tuple[int, int]:
    """Of the sessions someone typed in on `day`, how many the hook stamped, and how many there were."""
    found = con.execute(
        """SELECT count(*) FILTER (WHERE stamped), count(*) FROM tasks
           WHERE session IN (SELECT session FROM sessions WHERE "day" = ?)""",
        [day],
    ).fetchone()
    return (found[0], found[1]) if found else (0, 0)


def model_switches(con, first: str, last: str, width: int = 7) -> list[tuple[str, str]]:
    """The days from `first` to `last` on which the model most typed-in sessions used over the week to then changed,
    with the new model; a week, so one day's handful of sessions on another model is not a switch."""
    rows = con.execute(
        """SELECT "day", model, count(*) FROM sessions WHERE typed > 0 AND model IS NOT NULL AND "day" <= ?
           GROUP BY ALL""",
        [last],
    ).fetchall()
    counts: dict[str, dict[str, int]] = {}
    for d, model, n in rows:
        counts.setdefault(d, {})[model] = n
    out, held = [], None
    for d in sorted(counts):
        week: dict[str, int] = {}
        for k in range(width):
            for model, n in counts.get(shift(d, -k), {}).items():
                week[model] = week.get(model, 0) + n
        top = max(sorted(week), key=week.__getitem__)
        if held is not None and top != held and d >= first:
            out.append((d, top))
        held = top
    return out
