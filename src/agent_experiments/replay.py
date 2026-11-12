"""Replays: past moments answered again under an old and a new rules file, scored by the measures file.

How and why: docs/architecture.md#replays. Picks and replies stay in the user's own output folder.
"""

import asyncio
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import tempfile
from dataclasses import astuple, dataclass
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import numpy as np
from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, query

from agent_experiments.counting import SCHEMA
from agent_experiments.stats import USEFUL_DROP, Effect, compare_paired

CONTEXT_CHARS = 24_000  # the tail of the conversation a reply is written from: enough for the last few turns
CALL_CHARS, RESULT_CHARS = 600, 300  # how much of each tool call, and of the start of each result, the context shows
ASK = "(Write the agent's next message.)"
PER_SESSION = 3  # so one long session cannot fill the sample
GATE = 1.5  # replayed and real miss rates must agree within this factor for the replay to stand for the real agent
REPLY_SECONDS = 600  # one reply takes well under a minute; past this it is hung, and is counted as failed
PARALLEL = 6  # replies at once, below where the subscription starts to refuse requests
WORKS_P = 0.05  # one look, so no early-look limits
MIN_PAIRED = 30  # fewer paired moments than this give no verdict: a handful can swing either way by chance
QUOTA_ERRORS = ("rate_limit", "billing_error")
QUOTA_WORDS = re.compile(r"usage limit|rate limit|quota|billing|credit balance", re.IGNORECASE)
QUOTA_EXIT = 3
# What the child that writes replies keeps of the caller's environment: enough to run, and to sign in as the user
# (Claude Code reads its credentials from CLAUDE_CONFIG_DIR, else the home folder's .claude, or takes the token).
# The rest, such as a calling agent's session variables or an API key, would change how it runs or who pays.
ENV_KEEP = (
    *("PATH", "SystemRoot", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"),
    *("CLAUDE_CONFIG_DIR", "CLAUDE_CODE_OAUTH_TOKEN"),
)

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
                out.append(f"Agent: [{b.get('name')}: {_cut(str(what), CALL_CHARS)}]")
            elif b.get("type") == "tool_result":
                c = b.get("content")
                out.append(f"  (result) {_cut(_clean(c if isinstance(c, str) else json.dumps(c or '')), RESULT_CHARS)}")
    text = "\n\n".join(out)
    return f"[earlier conversation cut]\n\n{text[-CONTEXT_CHARS:]}" if len(text) > CONTEXT_CHARS else text


def options(system: Path, model: str, cwd: Path) -> ClaudeAgentOptions:
    """The clean context a reply is written in: the framed rules file as the whole system prompt, no tools, settings,
    MCP servers or saved session, and one turn. The system prompt goes by file, since a command line is limited."""
    return ClaudeAgentOptions(
        system_prompt={"type": "file", "path": str(system)},
        tools=[],
        setting_sources=[],
        mcp_servers={},
        strict_mcp_config=True,
        max_turns=1,
        model=model,
        cwd=cwd,
        extra_args={"no-session-persistence": None},
    )


def _outside_home() -> Path:
    """Where each reply's empty working folder goes. Claude Code reads CLAUDE.md files in the folders above where it
    runs, the user's own rules sit in the home folder, and on Windows the temp folder is inside it too."""
    home = Path.home().resolve()
    temp = Path(tempfile.gettempdir()).resolve()
    for base in (temp, Path(temp.anchor)):
        if not base.is_relative_to(home):
            return base
    raise RuntimeError(f"no folder outside {home} for replies to run in")


async def ask(prompt: str, system: Path, model: str) -> str:
    """One reply, written in a fresh empty folder outside the home folder. Raises OutOfQuota when the model refused
    for quota, RuntimeError on any other failure."""
    reply, error, failed = None, None, False
    with tempfile.TemporaryDirectory(
        prefix="agent-experiments-", dir=_outside_home(), ignore_cleanup_errors=True
    ) as cwd:
        async with asyncio.timeout(REPLY_SECONDS):
            async for message in query(prompt=prompt, options=options(system, model, Path(cwd))):
                # Claude Code can end with subtype "success" and an API error, such as a usage limit, as its result.
                if isinstance(message, AssistantMessage) and message.error:
                    error = message.error
                elif isinstance(message, ResultMessage):
                    reply, failed = message.result, message.is_error
    # Only a failed reply is read for quota words: a good reply may well mention a limit.
    if error in QUOTA_ERRORS or (failed and QUOTA_WORDS.search(reply or "")):
        raise OutOfQuota(reply or str(error))
    if error or failed or reply is None:
        raise RuntimeError(f"no reply ({error}): {reply}")
    return reply


async def write_replies(path: Path, todo: list[tuple[dict, str, str]], answer) -> int:
    """Writes a reply for each (moment, arm, prompt), PARALLEL at once, appending each to `path` as it comes, with
    `answer(prompt, arm)`. Returns how many failed; OutOfQuota stops the rest, keeping what was written."""
    gate = asyncio.Semaphore(PARALLEL)
    failed = 0
    with path.open("a+b") as f:
        if size := f.seek(0, os.SEEK_END):
            f.seek(size - 1)
            if f.read(1) != b"\n":
                f.write(b"\n")  # ends a line cut off by a kill, so the next reply is not lost with it

        async def one(m: dict, arm: str, prompt: str) -> None:
            nonlocal failed
            async with gate:
                try:
                    reply = await answer(prompt, arm)
                except OutOfQuota:
                    raise
                except Exception as e:
                    failed += 1
                    print(f"A reply failed: {str(e)[:200]}")
                    return
            f.write((json.dumps({"uuid": m["uuid"], "arm": arm, "reply": reply}) + "\n").encode())
            f.flush()

        try:
            async with asyncio.TaskGroup() as tasks:
                for m, arm, prompt in todo:
                    tasks.create_task(one(m, arm, prompt))
        except* OutOfQuota as e:
            raise e.exceptions[0] from None
    return failed


def moments(db: Path, projects: Path, measure: str, first: str, last: str) -> list[dict]:
    con = duckdb.connect(str(db), read_only=True)
    rows = con.execute(MOMENTS, [measure, first, last]).fetchall()
    con.close()
    return [
        {"s": s, "day": d, "uuid": u, "miss": bool(m), "file": str(projects / p / f"{s}.jsonl"), "first": bool(f)}
        for s, d, u, m, p, f in rows
    ]


def prompts(picks: list[dict]) -> dict[str, str]:
    """Each moment's prompt, reading each transcript once."""
    by_file: dict[str, list[dict]] = {}
    for m in picks:
        by_file.setdefault(m["file"], []).append(m)
    out = {}
    for file, ms in by_file.items():
        lines = Path(file).read_text(encoding="utf-8", errors="replace").splitlines()
        for m in ms:
            out[m["uuid"]] = f"{context(lines, m['uuid'])}\n\n{ASK}"
    return out


def _read_replies(path: Path) -> list[dict]:
    """The replies saved so far, less a line cut off by a kill: that reply is written again."""
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            out.append(json.loads(line))
        except ValueError:
            continue
    return out


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
    if len(both) < MIN_PAIRED:
        verdict = "can't tell"
    elif not stands:
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


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _todo(out: Path, picks: list[dict]) -> list[tuple[dict, str]]:
    have = {(r["uuid"], r["arm"]) for r in _read_replies(out / "replies.jsonl")}
    return [(m, arm) for arm in ("old", "new") for m in picks if (m["uuid"], arm) not in have]


def write(out: Path) -> int:
    """Writes the replies a run folder still lacks. Returns 0, 1 when some failed, or QUOTA_EXIT."""
    model = json.loads((out / "manifest.json").read_text(encoding="utf-8"))["model"]
    picks = json.loads((out / "picks.json").read_text(encoding="utf-8"))
    todo = _todo(out, picks)
    needed = {m["uuid"] for m, _ in todo}
    found = prompts([m for m in picks if m["uuid"] in needed])
    try:
        failed = asyncio.run(
            write_replies(
                out / "replies.jsonl",
                [(m, arm, found[m["uuid"]]) for m, arm in todo],
                lambda prompt, arm: ask(prompt, out / f"system-{arm}.txt", model),
            )
        )
    except OutOfQuota as e:
        print(f"Out of model quota ({str(e)[:200]}): the replies written so far are kept; rerun later to continue.")
        return QUOTA_EXIT
    if failed:
        print(f"{failed} replies failed; rerun to write them.")
    return 1 if failed else 0


def _write_in_child(out: Path) -> int:
    """`write` in a child process given only ENV_KEEP, since the SDK hands Claude Code its caller's whole environment.
    Without non-essential traffic Claude Code makes one model call per reply, not a second for a title."""
    env = {k: os.environ[k] for k in ENV_KEEP if k in os.environ} | {"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"}
    return subprocess.run([sys.executable, "-m", "agent_experiments.replay", str(out)], env=env, check=False).returncode


def run(args, projects: Path) -> int:
    """`agent-experiments replay`: in a folder named for the measure and a hash of everything that shapes the replies,
    picks moments once, writes the replies not yet written, scores and stores. `--rescore FOLDER` rescores a folder
    from its manifest, with no model calls."""
    if args.rescore:
        out = args.rescore.resolve()
        manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
        picks = json.loads((out / "picks.json").read_text(encoding="utf-8"))
        code = 0
    else:
        systems = {
            arm: FRAME.format(rules=path.read_text(encoding="utf-8"))
            for arm, path in (("old", args.old), ("new", args.new))
        }
        inputs = {"measure": args.measure, "model": args.model, "n": args.n, "from": args.from_, "to": args.to}
        # The frame is in each arm's text; the rest of each prompt is shaped by these.
        inputs |= {arm: _sha(text) for arm, text in systems.items()}
        inputs |= {"prompt": [CONTEXT_CHARS, CALL_CHARS, RESULT_CHARS, ASK]}
        out = (args.db.parent / "replays" / f"{args.measure}-{_sha(json.dumps(inputs, sort_keys=True))[:8]}").resolve()
        manifest = inputs | {"in_force": args.in_force}
        picks_file = out / "picks.json"
        if picks_file.exists():
            picks = json.loads(picks_file.read_text(encoding="utf-8"))
        else:
            picks = pick(moments(args.db, projects, args.measure, args.from_, args.to), args.n, random.Random(1))
        print(f"{len(_todo(out, picks))} replies to write with {args.model}, for {len(picks)} moments, in {out}")
        if args.dry_run:
            return 0
        out.mkdir(parents=True, exist_ok=True)
        (out / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
        picks_file.write_text(json.dumps(picks), encoding="utf-8")
        for arm, text in systems.items():
            (out / f"system-{arm}.txt").write_text(text, encoding="utf-8")
        code = _write_in_child(out)
        if code == QUOTA_EXIT:
            return 1
    replies = _read_replies(out / "replies.jsonl")
    scored = score(args.measures, manifest["measure"], picks, replies)
    r = judge(str(out), manifest["measure"], picks, scored, manifest["in_force"], np.random.default_rng(1))
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


if __name__ == "__main__":
    sys.exit(write(Path(sys.argv[1])))
