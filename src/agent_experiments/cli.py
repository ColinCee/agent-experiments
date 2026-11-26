"""agent-experiments: `daily` counts, takes the verdicts due and writes the overview page; `replay` tests a rule's
wording on past moments; `size` reads rule and skill sizes from git (docs/architecture.md)."""

import argparse
import re
import sys
import traceback
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np

from agent_experiments import overview, replay, size, skills, verdicts
from agent_experiments.counting import count
from agent_experiments.stats import Effect, compare
from agent_experiments.verdicts import shift

DATA = Path.home() / ".claude" / "keep-going"
PROJECTS = Path.home() / ".claude" / "projects"
TIMELINE_DAYS = 42  # each measure's timeline: long enough to hold a few rule changes and the weeks around them
WEEK = 7  # the page shows the trials started, or given a verdict, in the last week, and every one still testing


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="agent-experiments", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    daily = sub.add_parser("daily", help="count, take the verdicts due, and write the overview page")
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
    rp.add_argument(
        "--measure", type=_plain, help="a measure on reply text or one call: its chances are the moments replayed"
    )
    rp.add_argument("--old", type=Path, help="the old rules file")
    rp.add_argument("--new", type=Path, help="the new rules file")
    rp.add_argument("--model", help="the model that writes the replies, such as haiku or opus")
    rp.add_argument("--in-force", choices=("old", "new"), help="which rules the sessions really had")
    rp.add_argument("--from", dest="from_", default="0000-00-00", help="first day of moments, YYYY-MM-DD")
    rp.add_argument("--to", default="9999-99-99", help="last day of moments, YYYY-MM-DD")
    rp.add_argument("--n", type=int, default=200, help="moments to replay, at most 3 a session")
    rp.add_argument("--check-only", action="store_true", help="write only the in-force arm, for the check alone")
    rp.add_argument(
        "--context-chars", type=_positive, default=replay.CONTEXT_CHARS, help="conversation each reply sees"
    )
    rp.add_argument(
        "--frame", choices=replay.FRAMES, default="bare", help="rules alone, or after Claude Code's own system prompt"
    )
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
    trials = verdicts.read_trials(args.trials or (args.agents_repo or Path.cwd()) / "home" / "trials", errors)
    count(args.transcripts, args.measures, args.db)
    if args.agents_repo:
        size.measure(args.agents_repo, size.PATHS, args.db)
    report, new = build(args.db, trials, day, errors)
    for v in new:
        change = "no rate to compare" if np.isnan(v.change) else f"change {v.change:+.0%}"
        print(f"{v.trial} ({v.measure}): {v.verdict} on {v.day}, from {v.source}; {change}")
    testing = sum(t["verdict"] is None for t in report["trials"])
    print(f"{day}: {testing} trial measures awaiting a verdict, {report['sessions']['total']} sessions typed in.")
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


def _positive(text: str) -> int:
    if not text.isdigit() or int(text) < 1:
        raise argparse.ArgumentTypeError(f"{text!r}: give a whole number of 1 or more")
    return int(text)


def build(db: Path, trials: list[verdicts.Trial], day: str, errors: list[str]) -> tuple[dict, list[verdicts.Verdict]]:
    """Takes the verdicts due as of `day`, and returns the report the overview page shows (its shape:
    dashboard/src/data/report.ts) with the verdicts just taken. A trial that fails is left out and added to `errors`,
    so the others still show; so is one past its verdict that is still testing, or a rare one with no replay."""
    rng = np.random.default_rng(1)
    # Numbers only the page uses draw from their own generator, so adding one never moves a verdict's range.
    shown = np.random.default_rng(2)
    con = verdicts.open_store(db)
    names = dict(con.execute("SELECT measure, name FROM measure_names").fetchall())

    def name(trial: verdicts.Trial, measure: str) -> str:
        # A trial with no name of its own is often named for its one measure.
        found = names.get(measure) or trial.title or names.get(trial.name)
        if not found:
            errors.append(
                f"Trial {trial.name} shows its file name: give its measure {measure} a name in `measure_names` in the"
                " measures file, or the trial file a line `name: <the mistake, in plain words>`."
            )
        return found or trial.name

    rows, new = [], []
    week = shift(day, 1 - WEEK)
    for trial in (t for t in trials if t.status == "testing" or t.started >= verdicts.JUDGED_FROM):
        try:
            for measure in trial.measures:
                stored = con.execute(
                    "SELECT count(*) FROM verdicts WHERE trial = ? AND started = ? AND measure = ?",
                    [trial.name, trial.started, measure],
                ).fetchone()
                found = verdicts.judge(con, trial, measure, day, rng)
                new += [found] if found and not (stored and stored[0]) else []
                row = _trial_row(con, trial, measure, found, day, shown)
                if trial.status == "testing" or trial.started >= week or (found and found.day >= week):
                    rows.append({"name": name(trial, measure), **row})
                if trial.status != "testing":
                    continue
                if found:
                    errors.append(
                        f"Trial {trial.name}: {found.verdict} on {found.day}, its day {verdicts.REAL_DAYS} of real use,"
                        f" and still `status: testing`. {ACT[found.verdict]} Then add its line to docs/findings.md."
                    )
                elif (
                    row["rare"] and row["real_days"] and not (row["replay"] and row["replay"]["real_rate"] is not None)
                ):
                    errors.append(
                        f"Trial {trial.name}: {measure} has under {verdicts.RARE} chances a day of real use, too few for"
                        f" {verdicts.REAL_DAYS} days to tell. Run `agent-experiments replay --measure {measure}` with"
                        " the trial's Off and On as --old and --new before its verdict is due."
                    )
        except Exception:
            errors.append(f"Trial {trial.name} left off the page:\n{traceback.format_exc()}")
    rows.sort(key=lambda r: (r["verdict"] is not None, r["started"], r["name"]))
    changes = con.execute(
        """SELECT measure, "day", what, 'rule' FROM changes WHERE "day" <= ? ORDER BY "day\"""", [day]
    ).fetchall()
    # Trial starts are marked; a before and after boundary is a rule change (docs/architecture.md#overview-page).
    changes += [(m, t.started, t.title or t.name, "trial") for t in trials if t.started <= day for m in t.measures]
    mistakes = [_mistake(con, m, names.get(m, m), changes, day, rng) for m in verdicts.measures(con)]
    mistakes.sort(key=lambda r: r["name"])
    in_group, total = verdicts.stamped(con, day)
    found = con.execute('SELECT * FROM replays ORDER BY "day" DESC, measure')
    columns = [d[0] for d in found.description]
    replays = [_replay(dict(zip(columns, r, strict=True)), names) for r in found.fetchall()]
    sizes = size.report(con)
    skill_rows = skills.report(con, names, day, shown)
    con.close()
    report = {
        "day": day,
        "written": datetime.now(UTC).isoformat(timespec="seconds"),
        "sessions": {"total": total, "stamped": in_group},
        "trials": rows,
        "mistakes": mistakes,
        "replays": replays,
        "sizes": sizes,
        "skills": skill_rows,
    }
    return report, new


# What each verdict asks of the trial file (docs/keep-going.md in the agents repo).
ACT = {
    "works": "Settle it: `status: settled`.",
    "worse": "Replace the wording with a hook or check, and delete the trial file.",
    "no big effect": "Keep the line (`status: settled`) or delete the file; either way it is no longer tracked.",
}


def _change(effect: Effect | None) -> dict | None:
    """An effect as the report's change, after / before - 1, so below 0 is fewer misses; null with no rate to compare
    against."""
    if effect is None or effect.drop is None or np.isnan(effect.drop):
        return None
    low, high = (None if x is None or np.isnan(x) else -x for x in (effect.high, effect.low))
    return {"value": -effect.drop, "low": low, "high": high}


def _trial_row(
    con, trial: verdicts.Trial, measure: str, found: verdicts.Verdict | None, day: str, rng: np.random.Generator
) -> dict:
    """A trial's row for one measure: each side's rate with its range, over the days its verdict uses (to `day` until
    it has one), the verdict, the replay that can settle a rare measure, and the sessions behind the latest misses."""
    last, used = verdicts.due(con, trial, day)
    end = found.day if found else last or day
    first = verdicts.before_from(con, trial, measure)
    before = verdicts.side(con, measure, first, shift(trial.started, -1), rng)[0]
    after = verdicts.side(con, measure, trial.started, end, rng)[0] if day >= trial.started else None
    replayed = verdicts.latest_replay(con, trial, measure)
    return {
        "started": trial.started,
        "status": trial.status,
        "due": found.day if found else last,
        "real_days": verdicts.REAL_DAYS if found else used,
        "rare": verdicts.is_rare(con, trial, measure),
        "before": before,
        "after": after,
        "change": None
        if found is None or np.isnan(found.change)
        else {
            "value": found.change,
            "low": None if np.isnan(found.low) else found.low,
            "high": None if np.isnan(found.high) else found.high,
        },
        "verdict": found.verdict if found else None,
        "source": found.source if found else None,
        "replay": _replay(replayed, {}) if replayed else None,
        "misses": verdicts.latest_misses(con, measure, trial.started, end) if day >= trial.started else [],
    }


def _mistake(con, measure: str, name: str, changes: list, day: str, rng: np.random.Generator) -> dict:
    """A tracked measure's day against its usual range, its timeline with the rule changes and trial starts on it, and
    its misses before and after the latest rule change, the before side starting at the rule change before it; with no
    rule yet, its misses over the last USUAL_DAYS (docs/architecture.md#overview-page)."""
    marks = sorted({(d, w, k) for m, d, w, k in changes if m == measure})
    days = [(d, w) for d, w, k in marks if k == "rule"]
    flag = verdicts.flag(con, measure, day, rng)
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
            for d, r in verdicts.rolling(verdicts.by_day(con, measure, shift(first, -2), day), first, day)
        ],
        "changes": [{"day": d, "what": w, "kind": k} for d, w, k in marks if d >= first],
    }
    if not days:
        row["current"] = verdicts.side(con, measure, shift(day, 1 - verdicts.USUAL_DAYS), day, rng)[0]
        return row
    latest = days[-1][0]
    earlier = [d for d, _ in days if d < latest]
    start = max(earlier[-1] if earlier else "", shift(latest, -TIMELINE_DAYS))
    row["before"], before = verdicts.side(con, measure, start, shift(latest, -1), rng)
    row["after"], after = verdicts.side(con, measure, latest, day, rng)
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
