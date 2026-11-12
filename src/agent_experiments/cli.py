"""agent-experiments: `daily` counts, takes the looks due and writes the overview page; `replay` tests a rule's wording
on past moments (docs/architecture.md)."""

import argparse
import sys
import traceback
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import numpy as np

from agent_experiments import looks, page, replay
from agent_experiments.counting import count
from agent_experiments.looks import LIMITS, TRIAL_DAYS, shift
from agent_experiments.stats import tasks_needed

DATA = Path.home() / ".claude" / "keep-going"
PROJECTS = Path.home() / ".claude" / "projects"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="agent-experiments", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    daily = sub.add_parser("daily", help="count, take the looks due, and write the overview page")
    daily.add_argument("--day", help="the day to report, YYYY-MM-DD (default: yesterday, UTC)")
    daily.add_argument("--agents-repo", type=Path, default=Path.cwd(), help="the repo whose home/trials holds trials")
    daily.add_argument("--trials", type=Path, help="folder of trial files (default: home/trials in --agents-repo)")
    daily.add_argument("--measures", type=Path, default=DATA / "measures" / "measures.sql")
    daily.add_argument("--transcripts", default=str(PROJECTS / "*" / "*.jsonl"))
    daily.add_argument("--db", type=Path, default=DATA / "experiments.duckdb")
    daily.add_argument("--page", type=Path, default=DATA / "overview.html")
    rp = sub.add_parser("replay", help="answer past moments again under old and new rules, and compare their misses")
    rp.add_argument("--measure", required=True, help="a measure on reply text: its chances are the moments replayed")
    rp.add_argument("--old", type=Path, help="the old rules file")
    rp.add_argument("--new", type=Path, help="the new rules file")
    rp.add_argument("--in-force", required=True, choices=("old", "new"), help="which rules the sessions really had")
    rp.add_argument("--from", dest="from_", default="0000-00-00", help="first day of moments, YYYY-MM-DD")
    rp.add_argument("--to", default="9999-99-99", help="last day of moments, YYYY-MM-DD")
    rp.add_argument("--n", type=int, default=200, help="moments to replay, at most 3 a session")
    rp.add_argument("--model", default="opus", help="the model that writes the replies")
    rp.add_argument("--rescore", action="store_true", help="score the replies already written, with no model calls")
    rp.add_argument("--out", type=Path, help="folder for picks and replies (default: replays/<measure> beside --db)")
    rp.add_argument("--measures", type=Path, default=DATA / "measures" / "measures.sql")
    rp.add_argument("--db", type=Path, default=DATA / "experiments.duckdb")
    args = parser.parse_args(argv)

    if args.command == "replay":
        if not args.rescore and not (args.old and args.new):
            parser.error("replay needs --old and --new, unless --rescore")
        return replay.run(args, PROJECTS)

    if not args.measures.is_file():
        print(f"No measures file at {args.measures}: it makes the chances table; pass --measures.", file=sys.stderr)
        return 2
    day = args.day or (datetime.now(UTC).date() - timedelta(days=1)).isoformat()
    errors: list[str] = []
    trials = looks.read_trials(args.trials or args.agents_repo / "home" / "trials", errors)
    count(args.transcripts, args.measures, args.db)
    report = build(args.db, trials, day, errors)
    page.write(args.page, report)
    for lk in report["new_looks"]:
        print(
            f"{lk.trial} ({lk.measure}), look {lk.look}: {lk.verdict}; drop {lk.drop:.0%} ({lk.low:.0%} to {lk.high:.0%})"
        )
    h = report["health"]
    running = f"{h['running']} {page.plural(h['running'], 'trial')} running"
    print(f"{day}: {running}, {h['stamped']} of {h['sessions']} sessions with a group.")
    print(f"Wrote {args.page}")
    for error in errors:
        print(error, file=sys.stderr)
    return 1 if errors else 0


def build(db: Path, trials: list[looks.Trial], day: str, errors: list[str]) -> dict:
    """Takes the looks due as of `day` and gathers what the overview page shows. A trial that fails is left off the
    page and added to `errors`, so the others still show."""
    rng = np.random.default_rng(1)
    con = looks.open_store(db)
    names = dict(con.execute("SELECT measure, name FROM measure_names").fetchall())
    rows, settled = [], []
    for trial in trials:
        try:
            if trial.status == "settled":
                settled += [{**s, "title": trial.title} for s in looks.settled(con, [trial], day, rng)]
            else:
                rows += [_trial_row(con, trial, measure, day, rng) for measure in trial.measures]
        except Exception:
            errors.append(f"Trial {trial.name} left off the page:\n{traceback.format_exc()}")
    for row in rows + settled:
        row["name"] = names.get(row["measure"], row["measure"])
        # A trial with no name of its own is often named for its one measure.
        row["title"] = row["title"] or names.get(row["trial"], row["trial"])
    measures = []
    for measure in looks.measures(con):
        recent = looks.measure_tasks(con, measure, shift(day, -6), day)
        before = looks.measure_tasks(con, measure, shift(day, -27), shift(day, -7))
        flag = looks.flag(con, measure, day, rng)
        measures.append(
            {
                "measure": measure,
                "name": names.get(measure, measure),
                "recent": recent[:, 1].sum() / recent[:, 0].sum() if len(recent) else None,
                "recent_n": int(recent[:, 0].sum()),
                "before": before[:, 1].sum() / before[:, 0].sum() if len(before) else None,
                "before_n": int(before[:, 0].sum()),
                "flag": flag,
                "flagged": bool(flag and flag["flagged"]),
            }
        )
    measures.sort(key=lambda r: (not r["flagged"], r["name"]))
    stamped, sessions = looks.stamped(con, day)
    verdicts = con.execute(
        """SELECT count(*) FROM looks WHERE verdict <> 'no verdict yet' AND "day" > ? AND "day" <= ?""",
        [shift(day, -7), day],
    ).fetchone()
    replays = [
        dict(zip([d[0] for d in con.description], r, strict=True)) | {"name": names.get(r[1], r[1])}
        for r in con.execute('SELECT * FROM replays ORDER BY "day" DESC, measure').fetchall()
    ]
    con.close()
    return {
        "day": day,
        "health": {
            "running": len({r["trial"] for r in rows if not r["final"] and r["day_n"] >= 1}),
            "verdicts": verdicts[0] if verdicts else 0,
            "stamped": stamped,
            "sessions": sessions,
            "off_course": sum(s["off_course"] for s in settled),
        },
        "trials": rows,
        "settled": settled,
        "measures": measures,
        "replays": replays,
        "new_looks": [r["new"] for r in rows if r["new"]],
    }


def _trial_row(con, trial: looks.Trial, measure: str, day: str, rng: np.random.Generator) -> dict:
    """A testing trial's row on the page for one measure, with the look it took if one was due."""
    off, on, effect, new = looks.look_at(con, trial, measure, day, rng)
    taken = [
        looks.Look(*r)
        for r in con.execute(
            "SELECT * FROM looks WHERE trial = ? AND started = ? AND measure = ? ORDER BY look",
            [trial.name, trial.started, measure],
        ).fetchall()
    ]
    recent = looks.measure_tasks(con, measure, shift(day, 1 - looks.USUAL_DAYS), day)
    per_day: dict[tuple[str, str], list[float]] = {}
    for grp, _, d, c, m in looks.group_rows(con, trial.name, measure, trial.started, day):
        total = per_day.setdefault((grp, d), [0, 0])
        total[0] += c
        total[1] += m
    trend = {g: sorted((d, m / c) for (grp, d), (c, m) in per_day.items() if grp == g) for g in ("off", "on")}
    final = taken and (taken[-1].verdict == "works" or taken[-1].look == len(looks.LOOK_SIZES))
    return {
        "trial": trial.name,
        "title": trial.title,
        "measure": measure,
        "started": trial.started,
        "day_n": (date.fromisoformat(day) - date.fromisoformat(trial.started)).days + 1,
        "tasks_off": len(off),
        "tasks_on": len(on),
        "effect": effect,
        "status": taken[-1].verdict if taken else "running" if day >= trial.started else "not started",
        "final": bool(final),
        "needed": tasks_needed(recent, LIMITS[-1], rng),
        "per_week": round(len(recent) / looks.USUAL_DAYS * TRIAL_DAYS / 2),
        "trend": trend,
        "looks": taken,
        "new": new,
    }


if __name__ == "__main__":
    sys.exit(main())
