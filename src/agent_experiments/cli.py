"""agent-experiments: `daily` counts, takes the looks due and writes the overview page; `replay` tests a rule's wording
on past moments; `size` reads rule and skill sizes from git (docs/architecture.md)."""

import argparse
import re
import sys
import traceback
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np

from agent_experiments import looks, overview, replay, size
from agent_experiments.counting import count
from agent_experiments.looks import LIMITS, TRIAL_DAYS, shift
from agent_experiments.stats import Effect, compare, rate_range, tasks_needed

DATA = Path.home() / ".claude" / "keep-going"
PROJECTS = Path.home() / ".claude" / "projects"
TIMELINE_DAYS = 42  # each measure's timeline: long enough to hold a few rule changes and the weeks around them


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="agent-experiments", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    daily = sub.add_parser("daily", help="count, take the looks due, and write the overview page")
    daily.add_argument("--day", help="the day to report, YYYY-MM-DD (default: yesterday, UTC)")
    daily.add_argument(
        "--agents-repo", type=Path, help="the repo whose home/trials holds trials, and whose rules are sized"
    )
    daily.add_argument("--trials", type=Path, help="folder of trial files (default: home/trials in --agents-repo)")
    daily.add_argument("--measures", type=Path, default=DATA / "measures" / "measures.sql")
    daily.add_argument("--transcripts", default=str(PROJECTS / "*" / "*.jsonl"))
    daily.add_argument("--db", type=Path, default=DATA / "experiments.duckdb")
    daily.add_argument("--page", type=Path, default=DATA / "overview.html", help="report.json is written beside it")
    rp = sub.add_parser("replay", help="answer past moments again under old and new rules, and compare their misses")
    rp.add_argument("--measure", type=_plain, help="a measure on reply text: its chances are the moments replayed")
    rp.add_argument("--old", type=Path, help="the old rules file")
    rp.add_argument("--new", type=Path, help="the new rules file")
    rp.add_argument("--model", help="the model that writes the replies, such as haiku or opus")
    rp.add_argument("--in-force", choices=("old", "new"), help="which rules the sessions really had")
    rp.add_argument("--from", dest="from_", default="0000-00-00", help="first day of moments, YYYY-MM-DD")
    rp.add_argument("--to", default="9999-99-99", help="last day of moments, YYYY-MM-DD")
    rp.add_argument("--n", type=int, default=200, help="moments to replay, at most 3 a session")
    rp.add_argument("--dry-run", action="store_true", help="print how many replies a run would write, and stop")
    rp.add_argument("--rescore", type=Path, metavar="FOLDER", help="score a run's saved replies, with no model calls")
    rp.add_argument("--measures", type=Path, default=DATA / "measures" / "measures.sql")
    rp.add_argument("--db", type=Path, default=DATA / "experiments.duckdb")
    sz = sub.add_parser("size", help="words of rule and skill files after each commit, and lines added and deleted")
    sz.add_argument("--repo", type=Path, required=True)
    sz.add_argument("--paths", nargs="+", default=size.PATHS, help="git globs of the files to size")
    sz.add_argument("--db", type=Path, default=DATA / "experiments.duckdb")
    args = parser.parse_args(argv)

    if args.command == "size":
        n = size.measure(args.repo, tuple(args.paths), args.db)
        print(f"{n} changes to {', '.join(args.paths)} in {args.repo}; the overview page shows them after `daily`.")
        return 0
    if args.command == "replay":
        if not args.rescore and not all((args.measure, args.old, args.new, args.model, args.in_force)):
            parser.error("replay needs --measure, --old, --new, --model and --in-force, unless --rescore")
        return replay.run(args, PROJECTS)

    if not args.measures.is_file():
        print(f"No measures file at {args.measures}: it makes the chances table; pass --measures.", file=sys.stderr)
        return 2
    day = args.day or (datetime.now(UTC).date() - timedelta(days=1)).isoformat()
    errors: list[str] = []
    trials = looks.read_trials(args.trials or (args.agents_repo or Path.cwd()) / "home" / "trials", errors)
    count(args.transcripts, args.measures, args.db)
    if args.agents_repo:
        size.measure(args.agents_repo, size.PATHS, args.db)
    report, new_looks = build(args.db, trials, day, errors)
    for lk in new_looks:
        print(
            f"{lk.trial} ({lk.measure}), look {lk.look}: {lk.verdict}; drop {lk.drop:.0%} ({lk.low:.0%} to {lk.high:.0%})"
        )
    running = sum(t["state"] == "running" for t in report["trials"])
    s = report["sessions"]
    print(f"{day}: {running} trial measures running, {s['in_group']} of {s['total']} sessions with a group.")
    try:
        print(f"Wrote {overview.write(args.page, report)} and {args.page}")
    except (ValueError, FileNotFoundError) as e:  # no dashboard built, or one with no slot for the report
        errors.append(f"{e}\nLeft {args.page} and the report.json beside it as they were.")
    for error in errors:
        print(error, file=sys.stderr)
    return 1 if errors else 0


def _plain(name: str) -> str:
    """A measure id, which names a folder: letters, digits, dashes and underscores only."""
    if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
        raise argparse.ArgumentTypeError(f"{name!r}: use letters, digits, - and _ only")
    return name


def build(db: Path, trials: list[looks.Trial], day: str, errors: list[str]) -> tuple[dict, list[looks.Look]]:
    """Takes the looks due as of `day`, and returns the report the overview page shows (its shape:
    docs/architecture.md#overview-page) with the looks just taken. A trial that fails is left out and added to
    `errors`, so the others still show."""
    rng = np.random.default_rng(1)
    con = looks.open_store(db)
    names = dict(con.execute("SELECT measure, name FROM measure_names").fetchall())

    def name(trial: looks.Trial, measure: str) -> str:
        # A trial with no name of its own is often named for its one measure.
        return names.get(measure) or trial.title or names.get(trial.name, trial.name)

    rows, permanent, new_looks = [], [], []
    for trial in trials:
        try:
            if trial.status == "settled":
                permanent += [
                    {
                        "name": name(trial, s["measure"]),
                        "since": trial.started,
                        "model": s["model"],
                        "tasks_with": s["tasks_on"],
                        "tasks_without": s["tasks_off"],
                        "change": _change(s["effect"]),
                        "slipping": s["off_course"],
                    }
                    for s in looks.settled(con, [trial], day, rng)
                ]
            else:
                for measure in trial.measures:
                    row, new = _trial_row(con, trial, measure, day, rng)
                    rows.append({"name": name(trial, measure), **row})
                    new_looks += [new] if new else []
        except Exception:
            errors.append(f"Trial {trial.name} left off the page:\n{traceback.format_exc()}")
    changes = con.execute(
        """SELECT measure, "day", what, 'rule' FROM changes WHERE "day" <= ? ORDER BY "day\"""", [day]
    ).fetchall()
    # Trial starts are marked, never a before and after boundary (docs/architecture.md#overview-page).
    changes += [
        (m, t.started, t.title or t.name, "trial")
        for t in trials
        if t.status != "settled" and t.started <= day
        for m in t.measures
    ]
    mistakes = [_mistake(con, m, names.get(m, m), changes, day, rng) for m in looks.measures(con)]
    mistakes.sort(key=lambda r: r["name"])
    in_group, total = looks.stamped(con, day)
    first_stamp = con.execute("SELECT min(ts) FROM stamps").fetchone()
    found = con.execute('SELECT * FROM replays ORDER BY "day" DESC, measure')
    columns = [d[0] for d in found.description]
    replays = [_replay(dict(zip(columns, r, strict=True)), names) for r in found.fetchall()]
    sizes = size.report(con)
    con.close()
    report = {
        "day": day,
        "written": datetime.now(UTC).isoformat(timespec="seconds"),
        "sessions": {
            "total": total,
            "in_group": in_group,
            "split_since": first_stamp[0][:10] if first_stamp and first_stamp[0] else None,
        },
        "trials": rows,
        "permanent": permanent,
        "mistakes": mistakes,
        "replays": replays,
        "sizes": sizes,
    }
    return report, new_looks


def _change(effect: Effect | None) -> dict | None:
    """An effect as the report's change, with / without - 1, so below 0 is fewer misses; null with no rate to compare
    against."""
    if effect is None or effect.drop is None or np.isnan(effect.drop):
        return None
    low, high = (None if x is None or np.isnan(x) else -x for x in (effect.high, effect.low))
    return {"value": -effect.drop, "low": low, "high": high}


def _rate(tasks: np.ndarray) -> float | None:
    chances = tasks[:, 0].sum()
    return tasks[:, 1].sum() / chances if chances else None


def _side(con, measure: str, first: str, last: str, rng: np.random.Generator) -> tuple[dict | None, np.ndarray]:
    """A measure's misses over some days with their 90% range, and its tasks; no side with no tasks."""
    tasks = looks.measure_tasks(con, measure, first, last)
    if not len(tasks):
        return None, tasks
    rate, low, high = rate_range(tasks, rng)
    return {"rate": rate, "low": low, "high": high, "tasks": len(tasks), "from": first}, tasks


def _mistake(con, measure: str, name: str, changes: list, day: str, rng: np.random.Generator) -> dict:
    """A tracked measure's day against its usual range, its timeline with the rule changes and trial starts on it, and
    its misses before and after the latest rule change, the before side starting at the rule change before it; with no
    rule yet, its misses over the last USUAL_DAYS (docs/architecture.md#overview-page)."""
    marks = sorted({(d, w, k) for m, d, w, k in changes if m == measure})
    days = [(d, w) for d, w, k in marks if k == "rule"]
    flag = looks.flag(con, measure, day, rng)
    first = shift(day, 1 - TIMELINE_DAYS)
    today = None
    if flag:
        rate, low, high = flag["rate"], flag["low"], flag["high"]
        outside = "above" if rate > high else "below" if rate < low else None
        today = {"rate": rate, "usual_low": low, "usual_high": high, "outside": outside}
    row = {
        "name": name,
        "today": today,
        "rule": {"day": days[-1][0], "what": days[-1][1]} if days else None,
        "before": None,
        "after": None,
        "change": None,
        "sure": False,
        "current": None,
        "series": [
            {"day": d, "rate": r}
            for d, r in looks.rolling(looks.by_day(con, measure, shift(first, -2), day), first, day)
        ],
        "changes": [{"day": d, "what": w, "kind": k} for d, w, k in marks if d >= first],
    }
    if not days:
        row["current"] = _side(con, measure, shift(day, 1 - looks.USUAL_DAYS), day, rng)[0]
        return row
    latest = days[-1][0]
    earlier = [d for d, _ in days if d < latest]
    start = max(earlier[-1] if earlier else "", shift(latest, -TIMELINE_DAYS))
    row["before"], before = _side(con, measure, start, shift(latest, -1), rng)
    row["after"], after = _side(con, measure, latest, day, rng)
    if min(len(before), len(after)) > 1:
        # After against before as one number and its range; p is not used, so few shuffles.
        change = _change(compare(before, after, rng, resamples=99))
        row["change"] = change
        row["sure"] = bool(
            change and change["low"] is not None and change["high"] is not None and change["low"] * change["high"] > 0
        )
    return row


def _replay(r: dict, names: dict[str, str]) -> dict:
    """A stored replay as the report shows it; `trusted` is the check under the rules in force (replay.stands)."""
    change = _change(Effect(r["rate_old"], r["rate_new"], r["drop"], r["low"], r["high"], r["p"]))
    return {
        "name": names.get(r["measure"], r["measure"]),
        "day": r["day"],
        "verdict": r["verdict"],
        "trusted": r["real_rate"] is not None
        and r["replay_rate"] is not None
        and replay.stands(r["real_rate"], r["replay_rate"]),
        "real_rate": r["real_rate"],
        "replay_rate": r["replay_rate"],
        "rate_old": r["rate_old"],
        "rate_new": r["rate_new"],
        "moments": r["moments"],
        "paired": r["paired"],
        "change": change,
    }


def _trial_row(con, trial: looks.Trial, measure: str, day: str, rng: np.random.Generator):
    """A testing trial's row for one measure, and the look it took if one was due."""
    off, on, effect, new = looks.look_at(con, trial, measure, day, rng)
    taken = [
        looks.Look(*r)
        for r in con.execute(
            "SELECT * FROM looks WHERE trial = ? AND started = ? AND measure = ? ORDER BY look",
            [trial.name, trial.started, measure],
        ).fetchall()
    ]
    recent = looks.measure_tasks(con, measure, shift(day, 1 - looks.USUAL_DAYS), day)
    per_day: dict[str, dict[str, tuple[int, int]]] = {"off": {}, "on": {}}
    for grp, _, d, c, m in looks.group_rows(con, trial.name, measure, trial.started, day):
        was = per_day[grp].get(d, (0, 0))
        per_day[grp][d] = (was[0] + c, was[1] + m)
    trend = []
    if day >= trial.started:
        without, with_ = (looks.rolling(per_day[g], trial.started, day) for g in ("off", "on"))
        trend = [{"day": d, "with": w, "without": o} for (d, o), (_, w) in zip(without, with_, strict=True)]
    final = taken and (taken[-1].verdict == "works" or taken[-1].look == len(looks.LOOK_SIZES))
    row = {
        "started": trial.started,
        # The last look is due on the first day TRIAL_DAYS after the start (looks.due_look).
        "ends": shift(trial.started, TRIAL_DAYS),
        "state": "scheduled" if day < trial.started else "finished" if final else "running",
        "verdict": taken[-1].verdict if taken else None,
        "tasks_with": len(on),
        "tasks_without": len(off),
        "rate_with": _rate(on),
        "rate_without": _rate(off),
        "change": _change(effect),
        "needed": tasks_needed(recent, LIMITS[-1], rng),
        "per_week": round(len(recent) / looks.USUAL_DAYS * TRIAL_DAYS / 2),
        "looks": [
            {
                "look": lk.look,
                "day": lk.day,
                "verdict": lk.verdict,
                "tasks_with": lk.tasks_on,
                "tasks_without": lk.tasks_off,
            }
            for lk in taken
        ],
        "trend": trend,
    }
    return row, new
