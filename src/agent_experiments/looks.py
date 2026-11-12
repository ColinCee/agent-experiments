"""Looks and verdicts: each trial's looks, settled rules against their holdout, measures out of their usual range.

How and why: docs/architecture.md#looks. Reads and writes the experiments file that counting.py builds.
"""

import math
import re
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path

import duckdb
import numpy as np

from agent_experiments.stats import USEFUL_DROP, Effect, compare

LOOK_SIZES = (10, 20, 40)  # a look is due when the smaller group reaches each
# O'Brien-Fleming-style one-sided limits for the three looks (docs/architecture.md#method).
LIMITS = (0.0003, 0.0071, 0.0225)
TRIAL_DAYS = 7  # a rule with no verdict in a week gets a different test, not a longer one
MIN_GROUP = 5  # below this a resampled range collapses onto the few tasks there are and proves nothing
USUAL_DAYS = 28
FLAG_ROUNDS = 2000

# One row per session someone typed in (through its root): its task, the hook's task token when its stamps agree on
# one, else the root session; scheduled runs and scripted calls are not what the rules are for.
TASKS = """
CREATE OR REPLACE TEMP VIEW tasks AS
WITH kept AS (
  SELECT DISTINCT session, root FROM sessions
  WHERE root IN (SELECT session FROM sessions GROUP BY session HAVING sum(typed) > 0)),
token AS (
  SELECT k.session, any_value(k.root) AS root, count(st.stamp) AS stamps,
         count(DISTINCT regexp_extract(st.stamp, '(?:^| )task=(\\w+)', 1)) AS tasks,
         max(regexp_extract(st.stamp, '(?:^| )task=(\\w+)', 1)) AS task
  FROM kept k LEFT JOIN stamps st ON st.session IN (k.session, k.root) GROUP BY k.session)
SELECT session, root, stamps > 0 AS stamped, CASE WHEN tasks = 1 THEN task ELSE root END AS task FROM token;
"""

# Per task, a trial group's chances and misses. A session counts for a trial only when all its stamps (and its
# root's) agree on the group, and only its chances after the first stamp naming the trial: a trial added mid-task
# must not claim the replies before it.
UNITS = """
WITH named AS (
  SELECT t.session, t.task, st.ts, regexp_extract(st.stamp, '(?:^| )' || regexp_escape($trial) || '=(on|off)\\b', 1) AS grp
  FROM tasks t JOIN stamps st ON st.session IN (t.session, t.root)),
grouped AS (
  SELECT session, any_value(task) AS task, max(grp) AS grp, min(ts) AS since FROM named WHERE grp <> ''
  GROUP BY session HAVING count(DISTINCT grp) = 1)
SELECT g.grp, g.task, c."day", count(*) AS chances, sum(c.miss::INT) AS misses
FROM chances c JOIN grouped g USING (session)
LEFT JOIN sessions s ON s.session = c.session AND s."day" = c."day"
WHERE c.measure = $measure AND c.ts > g.since AND c."day" BETWEEN $first AND $last
  AND ($model IS NULL OR s.model = $model)
GROUP BY ALL
"""


@dataclass(frozen=True)
class Trial:
    name: str
    status: str  # testing or settled
    measures: tuple[str, ...]
    started: str


@dataclass(frozen=True)
class Look:
    trial: str
    measure: str
    look: int
    day: str
    tasks_off: int
    tasks_on: int
    rate_off: float
    rate_on: float
    drop: float
    low: float
    high: float
    p: float
    verdict: str


def read_trials(folder: Path) -> list[Trial]:
    """Trial files as docs/keep-going.md in the agents repo describes them: front matter with status, measures, started."""
    trials = []
    for path in sorted(folder.glob("*.md")) if folder.is_dir() else []:
        text = path.read_text(encoding="utf-8")

        def field(name: str, text: str = text) -> str:
            found = re.search(rf"^{name}:\s*(.+?)\s*$", text, re.MULTILINE)
            return found.group(1) if found else ""

        measures = tuple(m.strip() for m in field("measures").split(",") if m.strip())
        status = "settled" if field("status") == "settled" else "testing"
        trials.append(Trial(path.stem, status, measures, field("started")))
    return trials


def shift(day: str, days: int) -> str:
    return (date.fromisoformat(day) + timedelta(days=days)).isoformat()


def open_store(db: Path) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(str(db))
    con.execute(TASKS)
    return con


def group_rows(con, trial: str, measure: str, first: str, last: str, model: str | None = None) -> list[tuple]:
    """Rows of (group, task, day, chances, misses) for one trial and measure."""
    args = {"trial": trial, "measure": measure, "first": first, "last": last, "model": model}
    return con.execute(UNITS, args).fetchall()


def units(con, trial: str, measure: str, first: str, last: str, model: str | None = None) -> dict[str, np.ndarray]:
    """Each group's tasks as rows of (chances, misses)."""
    totals: dict[tuple[str, str], list[int]] = {}
    for grp, task, _, c, m in group_rows(con, trial, measure, first, last, model):
        total = totals.setdefault((grp, task), [0, 0])
        total[0] += c
        total[1] += m
    return {
        g: np.array([v for (grp, _), v in totals.items() if grp == g], dtype=float).reshape(-1, 2)
        for g in ("off", "on")
    }


def verdict(effect: Effect, look: int, smaller: int) -> str:
    """Only `works` may end a trial early: an early `no useful effect` would be more chances to be wrong."""
    final = look == len(LOOK_SIZES)
    if smaller >= MIN_GROUP and effect.p < LIMITS[look - 1] and effect.drop > 0:
        return "works"
    if not final:
        return "no verdict yet"
    if smaller >= MIN_GROUP and effect.high < USEFUL_DROP:
        return "no useful effect"
    return "can't tell"


def due_look(trial: Trial, sizes: tuple[int, int], taken: list[tuple[int, str]], day: str) -> int:
    """The look due as of `day`, or 0. A look is never retaken, and none follows `works` or the last look."""
    if day < trial.started or any(v == "works" for _, v in taken):
        return 0
    reached = sum(min(sizes) >= n for n in LOOK_SIZES)
    look = len(LOOK_SIZES) if day >= shift(trial.started, TRIAL_DAYS) else reached
    # Groups can shrink when a later stamp disagrees, so a look is due only past every look already taken.
    return look if look > max((n for n, _ in taken), default=0) else 0


def take_looks(con, trials: list[Trial], day: str, rng: np.random.Generator) -> list[Look]:
    """Takes and stores every look due as of `day`."""
    new = []
    for trial in (t for t in trials if t.status == "testing"):
        for measure in trial.measures:
            groups = units(con, trial.name, measure, trial.started, day)
            off, on = groups["off"], groups["on"]
            taken = con.execute(
                "SELECT look, verdict FROM looks WHERE trial = ? AND measure = ?", [trial.name, measure]
            ).fetchall()
            look = due_look(trial, (len(off), len(on)), taken, day)
            if not look:
                continue
            nan = math.nan
            effect = compare(off, on, rng) if len(off) and len(on) else Effect(nan, nan, nan, nan, nan, nan)
            found = Look(
                trial.name,
                measure,
                look,
                day,
                len(off),
                len(on),
                effect.off,
                effect.on,
                effect.drop,
                effect.low,
                effect.high,
                effect.p,
                verdict(effect, look, min(len(off), len(on))),
            )
            con.execute("INSERT INTO looks VALUES (" + ", ".join("?" * 13) + ")", list(asdict(found).values()))
            new.append(found)
    return new


def model_in_use(con, day: str) -> str | None:
    found = con.execute(
        """SELECT model FROM sessions WHERE "day" > ? AND "day" <= ? AND model IS NOT NULL
           GROUP BY model ORDER BY sum(replies) DESC LIMIT 1""",
        [shift(day, -7), day],
    ).fetchone()
    return found[0] if found else None


def settled(con, trials: list[Trial], day: str, rng: np.random.Generator) -> list[dict]:
    """Each settled rule against the holdout tasks that never get it, on the model in use, so a model that no longer
    needs the rule shows."""
    model = model_in_use(con, day)
    out = []
    for trial in (t for t in trials if t.status == "settled"):
        for measure in trial.measures:
            g = units(con, trial.name, measure, shift(day, 1 - USUAL_DAYS), day, model)
            effect = compare(g["off"], g["on"], rng) if len(g["off"]) and len(g["on"]) else None
            off_course = (
                effect is not None and min(len(g["off"]), len(g["on"])) >= MIN_GROUP and effect.high < USEFUL_DROP
            )
            out.append(
                {
                    "trial": trial.name,
                    "measure": measure,
                    "model": model,
                    "tasks_off": len(g["off"]),
                    "tasks_on": len(g["on"]),
                    "effect": effect,
                    "off_course": off_course,
                }
            )
    return out


def measure_tasks(con, measure: str, first: str, last: str) -> np.ndarray:
    """Every task's (chances, misses) for a measure over some days, trial groups aside."""
    rows = con.execute(
        """SELECT count(*), sum(c.miss::INT) FROM chances c JOIN tasks t USING (session)
           WHERE c.measure = ? AND c."day" BETWEEN ? AND ? GROUP BY t.task""",
        [measure, first, last],
    ).fetchall()
    return np.array(rows, dtype=float).reshape(-1, 2)


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
