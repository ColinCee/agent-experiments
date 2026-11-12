"""Replays: past moments answered again under an old and a new rules file, scored by the measures file.

How and why: docs/architecture.md#replays. Picks and replies stay in the user's own output folder.
"""

import json
import os
import random
import re
import shutil
import subprocess
from dataclasses import astuple, dataclass
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import numpy as np

from agent_experiments.counting import SCHEMA
from agent_experiments.stats import USEFUL_DROP, Effect, compare_paired

# Pinned so a replay runs the same next month. promptfoo 0.125.1 needs Node 22.22 or later, so npx fetches a Node with
# it rather than asking for one on the machine; the provider loads the Agent SDK from beside promptfoo.
PROMPTFOO = (
    *("-p", "node@24.22.3", "-p", "promptfoo@0.125.1", "-p", "@anthropic-ai/claude-agent-sdk@0.3.322"),
    "promptfoo",
)
CONTEXT_CHARS = 24_000  # the tail of the conversation a reply is written from: enough for the last few turns
PER_SESSION = 3  # so one long session cannot fill the sample
GATE = 1.5  # replayed and real miss rates must agree within this factor for the replay to stand for the real agent
BATCH = 20  # moments per promptfoo run: it writes its results only at the end, so a crash loses at most these
PARALLEL = 6  # replies at once, below where the subscription starts to refuse requests
WORKS_P = 0.05  # one look, so no early-look limits

FRAME = """You are a coding agent in the middle of a session with the user. These are the user's rules for you, loaded \
every turn:

<rules>
{rules}
</rules>

Below is the recent conversation. Tool calls show as [ToolName: what], and the start of each result as (result). Write \
your next message as the agent. To use a tool, write it on its own line as [ToolName: what you run]; you will not see \
its result. Write nothing about this setup."""

# The temp tables a measures file reads, as sessions.sql makes them; a reply is one text, with nothing called or typed.
REPLY_TABLES = """
CREATE TEMP TABLE texts (s VARCHAR, "day" VARCHAR, ts VARCHAR, uuid VARCHAR, txt VARCHAR);
CREATE TEMP TABLE calls (s VARCHAR, "day" VARCHAR, ts VARCHAR, uuid VARCHAR, tool VARCHAR, arg VARCHAR, bg BOOLEAN);
CREATE TEMP TABLE typed (s VARCHAR, "day" VARCHAR, ts VARCHAR, uuid VARCHAR, body VARCHAR);
"""

# The measure's chances in sessions someone typed in, each marked when it is its session's first in the days asked.
MOMENTS = """
WITH typed AS (SELECT session, any_value(project) AS project FROM sessions GROUP BY session HAVING sum(typed) > 0)
SELECT c.session AS s, c."day", c.uuid, c.miss, t.project,
       row_number() OVER (PARTITION BY c.session ORDER BY c.ts) = 1 AS first
FROM chances c JOIN typed t USING (session)
WHERE c.measure = ? AND c.uuid IS NOT NULL AND c."day" BETWEEN ? AND ?
"""


class OutOfQuota(Exception):
    pass


@dataclass(frozen=True)
class Replay:
    folder: str
    measure: str
    day: str
    in_force: str
    moments: int
    paired: int  # moments where both replies had a chance: the ones compared
    sessions: int
    rate_old: float
    rate_new: float
    drop: float
    low: float
    high: float
    p: float
    real_rate: float  # under the rules in force, among moments where that reply had a chance
    replay_rate: float
    verdict: str


def pick(moments: list[dict], n: int, rng: random.Random) -> list[dict]:
    """Sessions in random order, one moment from each in turn (its first chance, then others), until n are picked."""
    by_session: dict[str, list[dict]] = {}
    for m in moments:
        by_session.setdefault(m["s"], []).append(m)
    sessions = list(by_session.values())
    rng.shuffle(sessions)
    queues = []
    for ms in sessions:
        rest = [m for m in ms if not m["first"]]
        rng.shuffle(rest)
        queues.append([m for m in ms if m["first"]] + rest)
    picked: list[dict] = []
    for round_ in range(PER_SESSION):
        for q in queues:
            if round_ < len(q) and len(picked) < n:
                picked.append(q[round_])
    return picked


def _clean(text: str) -> str:
    return re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.DOTALL).strip()


def _cut(text: str, most: int) -> str:
    return text[:most] + "…" if len(text) > most else text


def context(lines: list[str], uuid: str) -> str:
    """The conversation before the moment, as text: what the user typed, what the agent wrote and ran, and how
    results began."""
    out = []
    for line in lines:
        try:
            e = json.loads(line)
        except ValueError:
            continue  # a line cut off while it was written
        if e.get("uuid") == uuid:
            break
        if (
            e.get("isSidechain")
            or e.get("isMeta")
            or e.get("isCompactSummary")
            or e.get("type") not in ("user", "assistant")
        ):
            continue
        content = (e.get("message") or {}).get("content")
        blocks = [{"type": "text", "text": content}] if isinstance(content, str) else content or []
        who = "User" if e["type"] == "user" else "Agent"
        for b in blocks:
            if b.get("type") == "text" and (text := _clean(b.get("text") or "")):
                out.append(f"{who}: {text}")
            elif b.get("type") == "tool_use":
                i = b.get("input") or {}
                what = i.get("command") or i.get("file_path") or i.get("skill") or json.dumps(i)
                out.append(f"Agent: [{b.get('name')}: {_cut(str(what), 600)}]")
            elif b.get("type") == "tool_result":
                c = b.get("content")
                out.append(f"  (result) {_cut(_clean(c if isinstance(c, str) else json.dumps(c or '')), 300)}")
    text = "\n\n".join(out)
    return f"[earlier conversation cut]\n\n{text[-CONTEXT_CHARS:]}" if len(text) > CONTEXT_CHARS else text


def _env(out: Path) -> dict[str, str]:
    # Without the calling agent's session variables the nested Claude Code runs as from a plain terminal; without its
    # non-essential traffic it makes one model call per reply, not a second to title the session.
    env = {k: v for k, v in os.environ.items() if not re.match(r"CLAUDE_CODE_|ANTHROPIC_|CLAUDECODE$", k)}
    return env | {
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
        "PROMPTFOO_DISABLE_TELEMETRY": "1",
        "PROMPTFOO_DISABLE_UPDATE": "1",
        "PROMPTFOO_CONFIG_DIR": str(out / ".promptfoo"),
    }


def _ask(out: Path, rules: str, prompts: list[str], model: str) -> list[str | None]:
    """One promptfoo run: a reply to each prompt under `rules`, None where it failed. Raises OutOfQuota when the
    model refused for quota, after the run, so the replies it did write are still returned through the exception."""
    config = {
        "description": "replay",
        "prompts": ["{{conversation}}"],
        "providers": [
            {
                "id": "anthropic:claude-agent-sdk",
                "config": {
                    "apiKeyRequired": False,
                    "model": model,
                    "custom_system_prompt": FRAME.format(rules=rules),
                    "tools": [],
                    "setting_sources": [],
                    "strict_mcp_config": True,
                    "persist_session": False,
                    "max_turns": 1,
                },
            }
        ],
        # promptfoo replaces {{name}} inside a var with that var, so the prompt's own name is broken up.
        "tests": [{"vars": {"conversation": re.sub(r"\{\{(\s*conversation\s*\}\})", "{​{\\1", p)}} for p in prompts],
    }
    (out / "promptfoo.json").write_text(json.dumps(config), encoding="utf-8")
    results = out / "results.json"
    results.unlink(missing_ok=True)
    npx = shutil.which("npx") or "npx"
    # Relative paths and cwd: npx on Windows is a .cmd file, which splits paths with spaces.
    args = [npx, "--yes", *PROMPTFOO, "eval", "-c", "promptfoo.json", "-o", "results.json", "--no-cache", "--no-write"]
    run = subprocess.run(
        [*args, "-j", str(PARALLEL)],
        cwd=out,
        env=_env(out),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=1800,  # a batch takes a few minutes, the first a few more while npx fetches promptfoo
    )
    if not results.exists():
        raise RuntimeError(f"promptfoo wrote no results (exit {run.returncode}): {(run.stdout + run.stderr)[-500:]}")
    replies: list[str | None] = [None] * len(prompts)
    errors = []
    for row in json.loads(results.read_text(encoding="utf-8"))["results"]["results"]:
        response = row.get("response") or {}
        output = response.get("output")
        meta = response.get("metadata") or {}
        # Claude Code can end "successfully" with an API error, such as a usage limit, as its result text.
        failure = row.get("error") or meta.get("apiErrorStatus") or meta.get("assistantErrors")
        if failure or not isinstance(output, str):
            errors.append(f"{failure} {output}")
        else:
            replies[row["testIdx"]] = output
    if any(re.search(r"limit|quota", e, re.IGNORECASE) for e in errors):
        raise OutOfQuota(replies)
    for e in errors[:3]:
        print(f"A reply failed: {e[:200]}")
    return replies


def moments(db: Path, projects: Path, measure: str, first: str, last: str) -> list[dict]:
    con = duckdb.connect(str(db), read_only=True)
    rows = con.execute(MOMENTS, [measure, first, last]).fetchall()
    con.close()
    return [
        {"s": s, "day": d, "uuid": u, "miss": bool(m), "file": str(projects / p / f"{s}.jsonl"), "first": bool(f)}
        for s, d, u, m, p, f in rows
    ]


def write_replies(out: Path, picks: list[dict], rules: dict[str, str], model: str) -> int:
    """Asks for each reply not yet in replies.jsonl, appending each as it comes. Returns how many failed."""
    path = out / "replies.jsonl"
    have = {(r["uuid"], r["arm"]) for r in _read_replies(path)}
    failed = 0
    for arm in ("old", "new"):
        todo = [m for m in picks if (m["uuid"], arm) not in have]
        print(f"{arm} rules: {len(todo)} replies to write")
        for start in range(0, len(todo), BATCH):
            batch = todo[start : start + BATCH]
            prompts = [_prompt(m) for m in batch]
            try:
                replies = _ask(out, rules[arm], prompts, model)
            except OutOfQuota as e:
                _append(path, batch, arm, e.args[0])
                raise
            failed += _append(path, batch, arm, replies)
    return failed


def _prompt(moment: dict) -> str:
    lines = Path(moment["file"]).read_text(encoding="utf-8", errors="replace").splitlines()
    return f"{context(lines, moment['uuid'])}\n\n(Write the agent's next message.)"


def _append(path: Path, batch: list[dict], arm: str, replies: list[str | None]) -> int:
    with path.open("a", encoding="utf-8") as f:
        for m, reply in zip(batch, replies, strict=True):
            if reply is not None:
                f.write(json.dumps({"uuid": m["uuid"], "arm": arm, "reply": reply}) + "\n")
    return sum(r is None for r in replies)


def _read_replies(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def score(measures: Path, measure: str, picks: list[dict], replies: list[dict]) -> dict[tuple[str, str], bool]:
    """Each reply's miss, keyed by (moment, arm), for the replies the measure counts as a chance; the measures file
    reads each reply as the one text of a session of its own."""
    days = {m["uuid"]: m["day"] for m in picks}
    con = duckdb.connect()
    con.execute(REPLY_TABLES)
    rows = [
        (f"{r['uuid']} {r['arm']}", days[r["uuid"]], f"{days[r['uuid']]}T00:00:00.000Z", r["uuid"], r["reply"])
        for r in replies
        if r["uuid"] in days
    ]
    con.executemany("INSERT INTO texts VALUES (?, ?, ?, ?, ?)", rows)
    con.execute(measures.read_text(encoding="utf-8"))
    found = con.execute("SELECT s, bool_or(miss) FROM chances WHERE measure = ? GROUP BY s", [measure]).fetchall()
    con.close()
    return {tuple(s.split(" ")): bool(miss) for s, miss in found}  # type: ignore[misc]


def judge(
    folder: str, measure: str, picks: list[dict], scored: dict, in_force: str, rng: np.random.Generator
) -> Replay:
    """Compares the old and new replies over sessions, on moments where both had a chance, after checking the replay
    misses about as often as the real agents did under the rules they had."""
    both = [m for m in picks if (m["uuid"], "old") in scored and (m["uuid"], "new") in scored]
    per_session: dict[str, list[int]] = {}
    for m in both:
        row = per_session.setdefault(m["s"], [0, 0, 0, 0])
        row[0] += 1
        row[1] += scored[(m["uuid"], "old")]
        row[2] += 1
        row[3] += scored[(m["uuid"], "new")]
    table = np.array(list(per_session.values()), dtype=float).reshape(-1, 4)
    effect = compare_paired(table[:, :2], table[:, 2:], rng) if len(table) > 1 else Effect(*[np.nan] * 6)
    had = [m for m in picks if (m["uuid"], in_force) in scored]
    real = sum(m["miss"] for m in had) / len(had) if had else np.nan
    replayed = sum(scored[(m["uuid"], in_force)] for m in had) / len(had) if had else np.nan
    # Rates a few points apart agree even when their ratio is large, as when both are near zero.
    stands = bool(abs(replayed - real) <= 0.05 or (real > 0 and 1 / GATE <= replayed / real <= GATE))
    if not stands:
        verdict = "replay can't test this"
    elif effect.p < WORKS_P and effect.drop > 0:
        verdict = "works"
    elif effect.high < USEFUL_DROP:
        verdict = "no useful effect"
    else:
        verdict = "can't tell"
    day = datetime.now(UTC).date().isoformat()
    return Replay(
        folder,
        measure,
        day,
        in_force,
        len(picks),
        len(both),
        len(per_session),
        *astuple(effect),
        real,
        replayed,
        verdict,
    )


def store(db: Path, replay: Replay) -> None:
    con = duckdb.connect(str(db))
    con.execute(SCHEMA)
    con.execute("INSERT OR REPLACE INTO replays VALUES (" + ", ".join("?" * 16) + ")", list(astuple(replay)))
    con.close()


def run(args, projects: Path) -> int:
    """`agent-experiments replay`: picks moments once, writes the replies not yet written, scores and stores."""
    out = (args.out or args.db.parent / "replays" / args.measure).resolve()
    out.mkdir(parents=True, exist_ok=True)
    picks_file = out / "picks.json"
    if picks_file.exists():
        picks = json.loads(picks_file.read_text(encoding="utf-8"))
    else:
        found = moments(args.db, projects, args.measure, args.from_, args.to)
        picks = pick(found, args.n, random.Random(1))
        picks_file.write_text(json.dumps(picks), encoding="utf-8")
    code = 0
    if not args.rescore:
        rules = {arm: path.read_text(encoding="utf-8") for arm, path in (("old", args.old), ("new", args.new))}
        try:
            failed = write_replies(out, picks, rules, args.model)
        except OutOfQuota:
            print("Out of model quota: the replies written so far are kept; rerun later to continue.")
            return 1
        if failed:
            print(f"{failed} replies failed; rerun to write them.")
            code = 1
    replies = _read_replies(out / "replies.jsonl")
    scored = score(args.measures, args.measure, picks, replies)
    r = judge(str(out), args.measure, picks, scored, args.in_force, np.random.default_rng(1))
    store(args.db, r)

    def pct(x: float) -> str:
        return "n/a" if np.isnan(x) else f"{100 * x:.1f}%"

    print(f"{r.measure}: {r.verdict}")
    print(f"{r.moments} moments from {len({m['s'] for m in picks})} sessions; {r.paired} paired, from {r.sessions}")
    print(
        f"Missed {pct(r.rate_old)} under the old rules, {pct(r.rate_new)} under the new: a drop of {pct(r.drop)} "
        f"(90% range {pct(r.low)} to {pct(r.high)}, p = {r.p:.4f})"
    )
    print(
        f"Check: under the {r.in_force} rules the real agents missed {pct(r.real_rate)}, the replay {pct(r.replay_rate)}"
    )
    return code
