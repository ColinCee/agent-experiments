import asyncio
import json
import random
import subprocess
from pathlib import Path

import numpy as np
import pytest
from claude_agent_sdk import AssistantMessage, ResultMessage
from claude_agent_sdk.types import AssistantMessageError
from test_counting import reply, typed, write

from agent_experiments import cli, replay
from agent_experiments.cli import main
from agent_experiments.counting import count
from agent_experiments.replay import context, judge, pick, score

WRITE_IN_CHILD = replay._write_in_child

# A chance is a reply of at least 5 characters, a miss one that says "bad"; calls and typed must exist, even empty.
MEASURES = """CREATE TEMP TABLE chances AS
SELECT 'bad-word' AS measure, s, "day", ts, uuid, txt LIKE '%bad%' AS miss FROM texts WHERE len(txt) >= 5
UNION ALL SELECT 'other', s, "day", ts, uuid, true FROM calls
UNION ALL SELECT 'other', s, "day", ts, uuid, true FROM typed;"""


def test_pick_takes_each_sessions_first_chance_before_any_second_and_at_most_three_a_session():
    moments = [{"s": "a", "uuid": f"a{i}", "first": i == 0} for i in range(5)]
    moments += [{"s": "b", "uuid": "b0", "first": True}]

    picked = pick(moments, 10, random.Random(1))

    assert [m["uuid"] for m in picked[:2]] in (["a0", "b0"], ["b0", "a0"])
    assert len(picked) == 4
    assert len(pick(moments, 1, random.Random(1))) == 1


def test_context_stops_at_the_moment_and_shows_calls_and_results_without_reminders():
    lines = [
        json.dumps({"type": "user", "uuid": "1", "message": {"content": "fix it<system-reminder>x</system-reminder>"}}),
        "{cut off",
        json.dumps({"type": "assistant", "uuid": "2", "isSidechain": True, "message": {"content": "a subagent"}}),
        json.dumps(
            {
                "type": "assistant",
                "uuid": "3",
                "message": {"content": [{"type": "tool_use", "name": "Bash", "input": {"command": "ls"}}]},
            }
        ),
        json.dumps(
            {"type": "user", "uuid": "4", "message": {"content": [{"type": "tool_result", "content": "a.txt"}]}}
        ),
        json.dumps({"type": "assistant", "uuid": "5", "message": {"content": "the moment"}}),
    ]

    assert context(lines, "5") == "User: fix it\n\nAgent: [Bash: ls]\n\n  (result) a.txt"


def _replies(tmp_path: Path, picks: list[dict], old: str, new: str):
    (tmp_path / "m.sql").write_text(MEASURES)
    replies = [{"uuid": m["uuid"], "arm": "old", "reply": old} for m in picks]
    replies += [{"uuid": m["uuid"], "arm": "new", "reply": new} for m in picks]
    return score(tmp_path / "m.sql", "bad-word", picks, replies)


def _picks(n: int) -> list[dict]:
    return [{"s": f"s{i}", "day": "2026-01-01", "uuid": f"u{i}", "miss": True, "first": True} for i in range(n)]


def test_a_new_rule_that_stops_misses_works_when_the_replay_misses_like_the_real_agents(tmp_path: Path):
    picks = _picks(30)
    scored = _replies(tmp_path, picks, "a bad reply", "a good reply")

    r = judge("f", "bad-word", picks, scored, "old", np.random.default_rng(1))

    assert (r.paired, r.sessions, r.rate_old, r.rate_new) == (30, 30, 1.0, 0.0)
    assert r.verdict == "works"
    few = _picks(29)
    scored = _replies(tmp_path, few, "a bad reply", "a good reply")
    assert judge("f", "bad-word", few, scored, "old", np.random.default_rng(1)).verdict == "can't tell"


def test_a_replay_that_misses_far_less_than_the_real_agents_cannot_test_the_rule(tmp_path: Path):
    picks = _picks(30)
    scored = _replies(tmp_path, picks, "a bad reply", "a good reply")

    assert judge("f", "bad-word", picks, scored, "new", np.random.default_rng(1)).verdict == "replay can't test this"


def test_a_reply_too_short_to_be_a_chance_is_left_out_of_the_pairs(tmp_path: Path):
    picks = [{"s": "s0", "day": "2026-01-01", "uuid": "u0", "miss": False, "first": True}]
    scored = _replies(tmp_path, picks, "bad", "a good reply")

    assert scored == {("u0", "new"): False}
    assert judge("f", "bad-word", picks, scored, "new", np.random.default_rng(1)).paired == 0


@pytest.fixture(autouse=True)
def _projects(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(cli, "PROJECTS", tmp_path / "projects")
    monkeypatch.setattr(replay, "_write_in_child", replay.write)  # in this process, so the fakes below answer


def _store(tmp_path: Path) -> list[str]:
    """A store with one 'bad-word' chance in each of three typed sessions, and the replay arguments for it."""
    for i in range(3):
        write(
            tmp_path / "projects" / "p",
            f"s{i}",
            [
                typed(f"t{i}", f"s{i}", "2026-01-02T09:00:00.000Z", "please fix it"),
                reply(f"r{i}", f"s{i}", "2026-01-02T09:00:01.000Z", "a bad reply", f"m{i}"),
            ],
        )
    (tmp_path / "m.sql").write_text(MEASURES)
    count(str(tmp_path / "projects" / "*" / "*.jsonl"), tmp_path / "m.sql", tmp_path / "x.duckdb")
    for arm in ("old", "new"):
        (tmp_path / f"{arm}.md").write_text(f"{arm} rules")
    files = ("--measures", str(tmp_path / "m.sql"), "--db", str(tmp_path / "x.duckdb"))
    rules = ("--old", str(tmp_path / "old.md"), "--new", str(tmp_path / "new.md"))
    return ["replay", "--measure", "bad-word", *rules, "--in-force", "old", *files]


def test_a_run_writes_each_reply_once_and_other_inputs_go_to_their_own_folder(tmp_path: Path, monkeypatch, capsys):
    calls = []

    async def fake(prompt, system, model):
        calls.append((model, system.name, prompt))
        return "a good reply"

    monkeypatch.setattr(replay, "ask", fake)
    args = _store(tmp_path)

    assert main([*args, "--model", "a", "--dry-run"]) == 0
    assert "6 replies to write" in capsys.readouterr().out
    assert not calls and not (tmp_path / "replays").exists()
    main([*args, "--model", "a"])
    main([*args, "--model", "a"])
    main([*args, "--model", "b"])

    assert len(calls) == 12  # 3 moments, 2 arms, 2 models; the rerun wrote nothing
    assert "please fix it" in calls[0][2]
    assert len(list((tmp_path / "replays").iterdir())) == 2


def test_running_out_of_quota_stops_the_run_and_keeps_the_replies_written(tmp_path: Path, monkeypatch):
    async def fake(prompt, system, model):
        if system.name == "system-new.txt":
            raise replay.OutOfQuota("usage limit")
        return "a bad reply"

    monkeypatch.setattr(replay, "ask", fake)
    monkeypatch.setattr(replay, "PARALLEL", 1)

    assert main([*_store(tmp_path), "--model", "a"]) == 1
    (folder,) = (tmp_path / "replays").iterdir()
    assert len((folder / "replies.jsonl").read_text().splitlines()) == 3


@pytest.mark.parametrize("measure", ["../x", "a b", ""])
def test_a_measure_must_be_a_plain_name(measure):
    with pytest.raises(SystemExit):
        main(["replay", "--measure", measure, "--rescore", "f"])


def test_a_kill_mid_line_loses_only_that_reply(tmp_path: Path, monkeypatch):
    async def fake(prompt, system, model):
        return "a bad reply"

    monkeypatch.setattr(replay, "ask", fake)
    args = [*_store(tmp_path), "--model", "a"]
    main(args)
    (folder,) = (tmp_path / "replays").iterdir()
    replies = folder / "replies.jsonl"
    replies.write_text(replies.read_text()[:-20])

    assert main(args) == 0
    assert main(args) == 0
    assert len(replay._read_replies(replies)) == 6


def _result(result: str, is_error: bool, error: AssistantMessageError | None = None):
    async def query(prompt, options):
        if error:
            yield AssistantMessage([], "m", error=error)
        yield ResultMessage("success", 1, 1, is_error, 1, "s", result=result)

    return query


@pytest.mark.parametrize(
    ("result", "is_error", "error", "raises"),
    [
        ("Set a time limit on the loop.", False, None, None),
        ("You've hit your usage limit", True, None, replay.OutOfQuota),
        ("API Error: Rate limit reached", True, "rate_limit", replay.OutOfQuota),
        ("Credit balance is too low", True, "billing_error", replay.OutOfQuota),
        ("Prompt is too long: over the context limit", True, "invalid_request", RuntimeError),
    ],
)
def test_only_a_quota_refusal_stops_the_run_and_says_why(monkeypatch, result, is_error, error, raises):
    monkeypatch.setattr(replay, "query", _result(result, is_error, error))
    reply = replay.ask("p", Path("s.txt"), "m")
    if raises is None:
        assert asyncio.run(reply) == result
        return
    with pytest.raises(raises, match=result.split(":")[0]):
        asyncio.run(reply)


def test_a_change_to_how_prompts_are_cut_writes_to_a_new_folder(tmp_path: Path, monkeypatch, capsys):
    args = [*_store(tmp_path), "--model", "a", "--dry-run"]
    main(args)
    monkeypatch.setattr(replay, "CONTEXT_CHARS", 100)
    main(args)

    first, second = (line.split(" in ")[-1] for line in capsys.readouterr().out.splitlines())
    assert first != second


def test_the_child_gets_only_what_it_needs_to_run_and_sign_in(tmp_path: Path, monkeypatch):
    seen = {}

    def run(cmd, env, check):
        seen.update(env)
        return subprocess.CompletedProcess(cmd, 0)

    monkeypatch.setattr(replay.subprocess, "run", run)
    for k, v in (("CLAUDE_CODE_OAUTH_TOKEN", "t"), ("CLAUDE_CODE_SESSION_ID", "x"), ("ANTHROPIC_API_KEY", "k")):
        monkeypatch.setenv(k, v)

    assert WRITE_IN_CHILD(tmp_path) == 0
    assert "CLAUDE_CODE_OAUTH_TOKEN" in seen and "PATH" in seen
    assert not {"CLAUDE_CODE_SESSION_ID", "ANTHROPIC_API_KEY"} & set(seen)
