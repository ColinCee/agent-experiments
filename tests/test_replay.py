import asyncio
import json
import random
from pathlib import Path

import numpy as np
import pytest
from claude_agent_sdk import ResultMessage
from test_counting import reply, typed, write

from agent_experiments import cli, replay
from agent_experiments.cli import main
from agent_experiments.counting import count
from agent_experiments.replay import context, judge, pick, score

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

    async def fake(prompt, opts):
        calls.append((opts.model, Path(opts.system_prompt["path"]).name, prompt))
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
    async def fake(prompt, opts):
        if Path(opts.system_prompt["path"]).name == "system-new.txt":
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


def test_a_reply_that_mentions_a_limit_is_a_reply_and_a_usage_limit_stops_the_run(monkeypatch):
    def fake(result: str, is_error: bool):
        async def query(prompt, options):
            yield ResultMessage("success", 1, 1, is_error, 1, "s", result=result)

        return query

    opts = replay.options(Path("s.txt"), "m", Path("."))
    monkeypatch.setattr(replay, "query", fake("Set a time limit on the loop.", False))
    assert asyncio.run(replay.ask("p", opts)) == "Set a time limit on the loop."
    monkeypatch.setattr(replay, "query", fake("You've hit your usage limit", True))
    with pytest.raises(replay.OutOfQuota):
        asyncio.run(replay.ask("p", opts))
