from pathlib import Path

import duckdb
import numpy as np
import pytest

from agent_experiments import looks
from agent_experiments.counting import SCHEMA
from agent_experiments.looks import Trial, due_look, verdict
from agent_experiments.stats import Effect

TRIAL = Trial("t", "testing", ("x",), "2026-01-01")


@pytest.mark.parametrize(
    ("sizes", "taken", "day", "due"),
    [
        ((9, 30), [], "2026-01-03", 0),
        ((10, 30), [], "2026-01-03", 1),
        ((25, 20), [(1, "no verdict yet")], "2026-01-03", 2),
        ((40, 41), [], "2026-01-03", 3),
        ((12, 12), [(1, "no verdict yet")], "2026-01-03", 0),  # never retaken
        ((15, 11), [(2, "no verdict yet")], "2026-01-03", 0),  # a shrunken group does not bring back look 1
        ((12, 12), [(1, "works")], "2026-01-08", 0),  # nothing follows works
        ((3, 2), [], "2026-01-07", 0),
        ((3, 2), [], "2026-01-08", 3),  # the last look comes 7 days after the start, whatever the size
        ((50, 50), [(3, "can't tell")], "2026-01-09", 0),
        ((50, 50), [], "2025-12-31", 0),
    ],
)
def test_a_look_is_due_at_each_size_once_and_last_after_seven_days(sizes, taken, day, due):
    assert due_look(TRIAL, sizes, taken, day) == due


def test_verdicts_by_look():
    strong = Effect(0.5, 0.1, 0.8, 0.6, 0.95, 0.0001)
    nothing = Effect(0.4, 0.4, 0.0, -0.2, 0.2, 0.5)
    assert verdict(strong, 1, 10) == "works"
    assert verdict(nothing, 1, 10) == "no verdict yet"
    assert verdict(nothing, 3, 40) == "no useful effect"
    assert verdict(Effect(0.4, 0.3, 0.25, -0.2, 0.6, 0.1), 3, 40) == "can't tell"
    # A p that passes the last look's limit is not enough at the first.
    assert verdict(Effect(0.5, 0.2, 0.6, 0.3, 0.8, 0.01), 1, 10) == "no verdict yet"
    assert verdict(strong, 3, 4) == "can't tell"  # too few tasks in a group to say anything


def store(tmp_path: Path) -> Path:
    """An experiments file with the columns the looks read, as counting.py would leave it."""
    db = tmp_path / "x.duckdb"
    con = duckdb.connect(str(db))
    con.execute("""
        CREATE TABLE sessions (session VARCHAR, "day" VARCHAR, model VARCHAR, replies INT, typed INT, root VARCHAR);
        CREATE TABLE stamps (session VARCHAR, ts VARCHAR, stamp VARCHAR);
        CREATE TABLE chances (measure VARCHAR, session VARCHAR, "day" VARCHAR, ts VARCHAR, uuid VARCHAR, miss BOOL);
    """)
    con.execute(SCHEMA.replace("store.", ""))
    con.close()
    return db


def add_session(con, name: str, stamps: list[tuple[str, str]], chances: list[tuple[str, bool]], typed: int = 1):
    con.execute("INSERT INTO sessions VALUES (?, '2026-01-02', 'model-a', 5, ?, ?)", [name, typed, name])
    for ts, line in stamps:
        con.execute("INSERT INTO stamps VALUES (?, ?, ?)", [name, ts, line])
    for i, (ts, miss) in enumerate(chances):
        con.execute("INSERT INTO chances VALUES ('x', ?, '2026-01-02', ?, ?, ?)", [name, ts, f"{name}-{i}", miss])


def test_units_leave_out_disagreeing_sessions_untyped_ones_and_chances_before_the_stamp(tmp_path):
    db = store(tmp_path)
    con = looks.open_store(db)
    early, stamp_at, late = "2026-01-02T08:00:00Z", "2026-01-02T09:00:00Z", "2026-01-02T10:00:00Z"
    add_session(con, "plain", [(stamp_at, "t=on holdout=no task=aaaa0001")], [(late, True), (late, False)])
    # The trial reached this task mid-way: its first reply came before any stamp named the trial.
    add_session(
        con,
        "joined",
        [(early, "holdout=no task=aaaa0002"), (stamp_at, "t=off holdout=no task=aaaa0002")],
        [(early, True), (late, False)],
    )
    add_session(con, "mixed", [(stamp_at, "t=on task=aaaa0003"), (late, "t=off task=aaaa0003")], [(late, True)])
    add_session(con, "scripted", [(stamp_at, "t=on task=aaaa0004")], [(late, True)], typed=0)
    add_session(con, "other-trial", [(stamp_at, "tt=on task=aaaa0005")], [(late, True)])
    # With no task token, each session is its own task.
    add_session(con, "untokened-1", [(stamp_at, "t=off")], [(late, True)])
    add_session(con, "untokened-2", [(stamp_at, "t=off")], [(late, True)])

    groups = looks.units(con, "t", "x", "2026-01-01", "2026-01-31")

    assert groups["on"].tolist() == [[2.0, 1.0]]
    assert sorted(groups["off"].tolist()) == [[1.0, 0.0], [1.0, 1.0], [1.0, 1.0]]


def test_a_look_is_written_once(tmp_path):
    db = store(tmp_path)
    con = looks.open_store(db)
    ts = "2026-01-02T10:00:00Z"
    for i in range(24):
        group = "on" if i % 2 else "off"
        add_session(con, f"s{i}", [("2026-01-02T09:00:00Z", f"t={group} task=b{i:07d}")], [(ts, group == "off")] * 4)
    rng = np.random.default_rng(1)

    first = looks.look_at(con, TRIAL, "x", "2026-01-03", rng)[3]
    again = looks.look_at(con, TRIAL, "x", "2026-01-04", rng)[3]
    week = looks.look_at(con, TRIAL, "x", "2026-01-08", rng)[3]
    restarted = looks.look_at(con, Trial("t", "testing", ("x",), "2026-01-02"), "x", "2026-01-03", rng)[3]

    assert first and (first.look, first.tasks_off, first.tasks_on, first.verdict) == (1, 12, 12, "works")
    assert again is None
    assert week is None  # nothing follows works
    assert restarted and restarted.look == 1  # a trial restarted under the same name starts its looks again
    assert con.execute("SELECT count(*) FROM looks").fetchone() == (2,)


def test_the_last_look_at_one_task_a_group_cannot_tell(tmp_path):
    con = looks.open_store(store(tmp_path))
    for group in ("off", "on"):
        add_session(con, group, [("2026-01-02T09:00:00Z", f"t={group} task={group}")], [("2026-01-02T10:00:00Z", True)])

    _, _, effect, look = looks.look_at(con, TRIAL, "x", "2026-01-08", np.random.default_rng(1))

    assert effect is None
    assert look and (look.look, look.verdict) == (3, "can't tell")


def test_a_trial_file_without_a_date_is_reported_and_the_rest_are_read(tmp_path):
    (tmp_path / "quoted.md").write_text('---\nname: A plain name\nmeasures: x\nstarted: "2026-01-01"\n---\n')
    (tmp_path / "undated.md").write_text("---\nmeasures: x\n---\n")
    errors: list[str] = []

    trials = looks.read_trials(tmp_path, errors)

    assert trials == [Trial("quoted", "testing", ("x",), "2026-01-01", "A plain name")]
    assert len(errors) == 1 and "undated.md" in errors[0]
