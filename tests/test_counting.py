import json
from pathlib import Path

import duckdb

from agent_experiments.counting import count

MEASURES = """CREATE TEMP TABLE chances AS
SELECT 'bad-word' AS measure, s, "day", ts, uuid, txt LIKE '%bad%' AS miss FROM texts;"""


def typed(uuid: str, session: str, ts: str, content, **extra) -> dict:
    entry = {"type": "user", "uuid": uuid, "sessionId": session, "timestamp": ts, "turnOrigin": "human"}
    return {**entry, "message": {"role": "user", "content": content}, **extra}


def reply(uuid: str, session: str, ts: str, text: str, message: str) -> dict:
    return {
        "type": "assistant",
        "uuid": uuid,
        "sessionId": session,
        "timestamp": ts,
        "entrypoint": "cli",
        "message": {
            "id": message,
            "model": "model-a",
            "content": [{"type": "text", "text": text}],
            "usage": {"input_tokens": 10, "output_tokens": 5},
        },
    }


def stamp(uuid: str, session: str, ts: str, line: str) -> dict:
    content = [f"Rule trials: {line}\nMore of the user's rules, with the same standing as their AGENTS.md:\n- A rule."]
    return {
        "type": "attachment",
        "uuid": uuid,
        "sessionId": session,
        "timestamp": ts,
        "attachment": {"type": "hook_additional_context", "content": content},
    }


def write(folder: Path, session: str, entries: list[dict]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{session}.jsonl").write_text("\n".join(json.dumps(e) for e in entries) + "\n", encoding="utf-8")


def test_counting_dedupes_a_continuation_and_reads_stamps_and_typed_messages(tmp_path: Path):
    first = [
        stamp("u0", "s1", "2026-01-01T09:00:00.000Z", "t=on holdout=no task=aaaa1111 rules=abc1234"),
        typed("u1", "s1", "2026-01-01T09:00:01.000Z", "please fix it"),
        reply("u2", "s1", "2026-01-01T09:00:02.000Z", "a bad reply", "m1"),
        typed("u3", "s1", "2026-01-01T09:00:03.000Z", "<system-reminder>a note</system-reminder>"),
        typed("u4", "s1", "2026-01-01T09:00:04.000Z", [{"type": "tool_result", "content": "ok"}], turnOrigin="tool"),
    ]
    # A continuation copies its parent's entries under its own session id, then goes on.
    second = [{**e, "sessionId": "s2"} for e in first] + [
        stamp("u5", "s2", "2026-01-02T08:00:00.000Z", "t=on holdout=no task=aaaa1111 rules=def5678"),
        typed("u6", "s2", "2026-01-02T08:00:01.000Z", "<system-reminder>x</system-reminder> and carry on"),
        reply("u7", "s2", "2026-01-02T08:00:02.000Z", "a good reply", "m2"),
    ]
    write(tmp_path / "projects" / "one", "s1", first)
    write(tmp_path / "projects" / "one", "s2", second)
    (tmp_path / "measures.sql").write_text(MEASURES)
    db = tmp_path / "x.duckdb"

    count(str(tmp_path / "projects" / "*" / "*.jsonl"), tmp_path / "measures.sql", db)

    con = duckdb.connect(str(db))
    assert con.execute("SELECT session, day, ts, miss FROM chances ORDER BY ts").fetchall() == [
        ("s1", "2026-01-01", "2026-01-01T09:00:02.000Z", True),
        ("s2", "2026-01-02", "2026-01-02T08:00:02.000Z", False),
    ]
    assert con.execute("SELECT session, day, typed, root FROM sessions ORDER BY session").fetchall() == [
        ("s1", "2026-01-01", 1, "s1"),
        ("s2", "2026-01-02", 1, "s1"),
    ]
    assert con.execute("SELECT session, ts, stamp FROM stamps WHERE session = 's2' ORDER BY ts").fetchall() == [
        ("s2", "2026-01-01T09:00:00.000Z", "t=on holdout=no task=aaaa1111 rules=abc1234"),
        ("s2", "2026-01-02T08:00:00.000Z", "t=on holdout=no task=aaaa1111 rules=def5678"),
    ]
