"""agent-experiments daily: counts, takes the looks due, and writes the overview page (docs/architecture.md)."""

import argparse
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import numpy as np

from agent_experiments import looks, page
from agent_experiments.counting import count
from agent_experiments.looks import LIMITS, TRIAL_DAYS, shift
from agent_experiments.stats import compare, tasks_needed

DATA = Path.home() / ".claude" / "keep-going"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="agent-experiments", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    daily = sub.add_parser("daily", help="count, take the looks due, and write the overview page")
    daily.add_argument("--day", help="the day to report, YYYY-MM-DD (default: yesterday, UTC)")
    daily.add_argument("--agents-repo", type=Path, default=Path.cwd(), help="the repo whose home/trials holds trials")
    daily.add_argument("--trials", type=Path, help="folder of trial files (default: home/trials in --agents-repo)")
    daily.add_argument("--measures", type=Path, default=DATA / "measures" / "measures.sql")
    daily.add_argument("--transcripts", default=str(Path.home() / ".claude" / "projects" / "*" / "*.jsonl"))
    daily.add_argument("--db", type=Path, default=DATA / "experiments.duckdb")
    daily.add_argument("--page", type=Path, default=DATA / "overview.html")
    args = parser.parse_args(argv)

    if not args.measures.is_file():
        print(f"No measures file at {args.measures}: it makes the chances table; pass --measures.", file=sys.stderr)
        return 2
    day = args.day or (datetime.now(UTC).date() - timedelta(days=1)).isoformat()
    count(args.transcripts, args.measures, args.db)
    report = build(args.db, looks.read_trials(args.trials or args.agents_repo / "home" / "trials"), day)
    page.write(args.page, report)
    for lk in report["new_looks"]:
        print(
            f"{lk.trial} ({lk.measure}), look {lk.look}: {lk.verdict}; drop {lk.drop:.0%} ({lk.low:.0%} to {lk.high:.0%})"
        )
    h = report["health"]
    print(f"{day}: {h['running']} trials running, {h['stamped']} of {h['sessions']} sessions with a group.")
    print(f"Wrote {args.page}")
    return 0


def build(db: Path, trials: list[looks.Trial], day: str) -> dict:
    """Takes the looks due as of `day` and gathers what the overview page shows."""
    rng = np.random.default_rng(1)
    con = looks.open_store(db)
    new_looks = looks.take_looks(con, trials, day, rng)
    rows = []
    for trial in (t for t in trials if t.status == "testing"):
        for measure in trial.measures:
            groups = looks.units(con, trial.name, measure, trial.started, day)
            off, on = groups["off"], groups["on"]
            taken = [
                looks.Look(*r)
                for r in con.execute(
                    "SELECT * FROM looks WHERE trial = ? AND measure = ? ORDER BY look", [trial.name, measure]
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
            rows.append(
                {
                    "trial": trial.name,
                    "measure": measure,
                    "started": trial.started,
                    "day_n": (date.fromisoformat(day) - date.fromisoformat(trial.started)).days + 1,
                    "tasks_off": len(off),
                    "tasks_on": len(on),
                    "effect": compare(off, on, rng) if min(len(off), len(on)) > 1 else None,
                    "status": taken[-1].verdict if taken else "running" if day >= trial.started else "not started",
                    "final": bool(final),
                    "needed": tasks_needed(recent, LIMITS[-1], rng),
                    "per_week": round(len(recent) / looks.USUAL_DAYS * TRIAL_DAYS / 2),
                    "trend": trend,
                    "looks": taken,
                }
            )
    settled = looks.settled(con, trials, day, rng)
    measures = []
    for measure in looks.measures(con):
        recent = looks.measure_tasks(con, measure, shift(day, -6), day)
        before = looks.measure_tasks(con, measure, shift(day, -27), shift(day, -7))
        flag = looks.flag(con, measure, day, rng)
        measures.append(
            {
                "measure": measure,
                "recent": recent[:, 1].sum() / recent[:, 0].sum() if len(recent) else None,
                "recent_n": int(recent[:, 0].sum()),
                "before": before[:, 1].sum() / before[:, 0].sum() if len(before) else None,
                "before_n": int(before[:, 0].sum()),
                "flag": flag,
                "flagged": bool(flag and flag["flagged"]),
            }
        )
    measures.sort(key=lambda r: (not r["flagged"], r["measure"]))
    stamped, sessions = looks.stamped(con, day)
    verdicts = con.execute(
        """SELECT count(*) FROM looks WHERE verdict <> 'no verdict yet' AND "day" > ? AND "day" <= ?""",
        [shift(day, -7), day],
    ).fetchone()
    con.close()
    return {
        "day": day,
        "health": {
            "running": len({r["trial"] for r in rows if not r["final"]}),
            "verdicts": verdicts[0] if verdicts else 0,
            "stamped": stamped,
            "sessions": sessions,
            "off_course": sum(s["off_course"] for s in settled),
        },
        "trials": rows,
        "settled": settled,
        "measures": measures,
        "new_looks": new_looks,
    }


if __name__ == "__main__":
    sys.exit(main())
