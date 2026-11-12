import json
import random
from pathlib import Path

import numpy as np

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


def test_a_new_rule_that_stops_misses_works_when_the_replay_misses_like_the_real_agents(tmp_path: Path):
    picks = [{"s": f"s{i}", "day": "2026-01-01", "uuid": f"u{i}", "miss": True, "first": True} for i in range(12)]
    scored = _replies(tmp_path, picks, "a bad reply", "a good reply")

    r = judge("f", "bad-word", picks, scored, "old", np.random.default_rng(1))

    assert (r.paired, r.sessions, r.rate_old, r.rate_new) == (12, 12, 1.0, 0.0)
    assert r.verdict == "works"


def test_a_replay_that_misses_far_less_than_the_real_agents_cannot_test_the_rule(tmp_path: Path):
    picks = [{"s": f"s{i}", "day": "2026-01-01", "uuid": f"u{i}", "miss": True, "first": True} for i in range(12)]
    scored = _replies(tmp_path, picks, "a bad reply", "a good reply")

    assert judge("f", "bad-word", picks, scored, "new", np.random.default_rng(1)).verdict == "replay can't test this"


def test_a_reply_too_short_to_be_a_chance_is_left_out_of_the_pairs(tmp_path: Path):
    picks = [{"s": "s0", "day": "2026-01-01", "uuid": "u0", "miss": False, "first": True}]
    scored = _replies(tmp_path, picks, "bad", "a good reply")

    assert scored == {("u0", "new"): False}
    assert judge("f", "bad-word", picks, scored, "new", np.random.default_rng(1)).paired == 0
