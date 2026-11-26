from dataclasses import replace
from pathlib import Path

import duckdb
import numpy as np

from agent_experiments import verdicts
from agent_experiments.counting import SCHEMA
from agent_experiments.verdicts import Trial, call

TRIAL = Trial("t", "testing", ("x",), "2026-01-10")


def store(tmp_path: Path) -> duckdb.DuckDBPyConnection:
    """An experiments file with the columns the verdicts read, as counting.py would leave it."""
    db = tmp_path / "x.duckdb"
    con = duckdb.connect(str(db))
    con.execute("""
        CREATE TABLE sessions (session VARCHAR, "day" VARCHAR, model VARCHAR, replies INT, typed INT, root VARCHAR);
        CREATE TABLE stamps (session VARCHAR, ts VARCHAR, stamp VARCHAR);
        CREATE TABLE chances (measure VARCHAR, session VARCHAR, "day" VARCHAR, ts VARCHAR, uuid VARCHAR, miss BOOL);
        CREATE TABLE changes (measure VARCHAR, "day" VARCHAR, what VARCHAR);
    """)
    con.execute(SCHEMA.replace("store.", ""))
    con.close()
    return verdicts.open_store(db)


def add_task(con, name: str, day: str, misses: list[bool], typed: int = 1):
    con.execute("INSERT INTO sessions VALUES (?, ?, 'model-a', 5, ?, ?)", [name, day, typed, name])
    for i, miss in enumerate(misses):
        con.execute(
            "INSERT INTO chances VALUES ('x', ?, ?, ?, ?, ?)", [name, day, f"{day}T10:00:0{i}Z", f"{name}{i}", miss]
        )


def days(con, first: str, n: int, per_day: int, misses: list[bool]):
    for d in range(n):
        day = verdicts.shift(first, d)
        for k in range(per_day):
            add_task(con, f"{day}-{k}", day, misses)


def test_the_verdict_is_due_on_the_third_day_someone_typed(tmp_path):
    con = store(tmp_path)
    add_task(con, "a", "2026-01-10", [False])
    add_task(con, "scripted", "2026-01-11", [False], typed=0)  # nobody typed: not a day of real use
    add_task(con, "b", "2026-01-13", [False])

    assert verdicts.due(con, TRIAL, "2026-01-13") == (None, 2)
    add_task(con, "c", "2026-01-15", [False])
    assert verdicts.due(con, TRIAL, "2026-01-14") == (None, 2)
    assert verdicts.due(con, TRIAL, "2026-01-20") == ("2026-01-15", 3)


def test_a_drop_works_a_rise_is_worse_and_anything_unsure_is_no_big_effect():
    assert call(-0.8, -0.2, True) == "works"
    assert call(0.1, 0.9, True) == "worse"
    assert call(-0.6, 0.3, True) == "no big effect"
    assert call(-0.8, -0.2, False) == "no big effect"  # too few tasks on a side
    assert call(float("nan"), float("nan"), True) == "no big effect"


def test_a_verdict_is_taken_once_from_the_days_before_and_the_first_three_after(tmp_path):
    con = store(tmp_path)
    days(con, "2026-01-01", 9, 2, [True, False])
    days(con, "2026-01-10", 3, 3, [False, False])
    days(con, "2026-01-13", 3, 2, [True, True])  # past day 3: never counted
    rng = np.random.default_rng(1)

    assert verdicts.judge(con, TRIAL, "x", "2026-01-11", rng) is None
    taken = verdicts.judge(con, TRIAL, "x", "2026-01-12", rng)
    assert taken
    assert (taken.day, taken.tasks_before, taken.tasks_after, taken.rate_before) == ("2026-01-12", 18, 9, 0.5)
    assert (taken.change, taken.verdict) == (-1.0, "works")
    assert verdicts.judge(con, TRIAL, "x", "2026-01-20", rng) == taken
    assert con.execute("SELECT count(*) FROM verdicts").fetchone() == (1,)


def test_the_before_side_starts_at_the_earlier_rule_change_but_not_the_trials_own(tmp_path):
    con = store(tmp_path)
    con.execute("INSERT INTO changes VALUES ('x', '2026-01-03', 'earlier'), ('x', '2026-01-09', 'this one')")

    assert verdicts.before_from(con, TRIAL, "x") == "2026-01-03"
    con.execute("DELETE FROM changes")
    assert verdicts.before_from(con, TRIAL, "x") == verdicts.shift(TRIAL.started, -verdicts.BEFORE_DAYS)


def test_a_rule_change_with_no_trial_file_is_judged_too_and_a_trials_own_change_names_it(tmp_path):
    con = store(tmp_path)
    con.execute(
        "INSERT INTO changes VALUES ('x', '2026-11-18', 'its own'), ('y', '2026-11-24', 'a hook'),"
        " ('y', '2026-11-02', 'before the method')"
    )
    trial = Trial("t", "testing", ("x",), "2026-11-19")

    filed, bare = verdicts.with_changes(con, [trial])
    assert (filed.name, filed.what, filed.filed) == ("t", "its own", True)
    assert (bare.measures, bare.started, bare.what, bare.filed) == (("y",), "2026-11-24", "a hook", False)


def test_a_judged_trials_change_is_not_judged_again_when_its_file_restarts(tmp_path):
    con = store(tmp_path)
    con.execute("INSERT INTO changes VALUES ('x', '2026-11-18', 'first wording')")
    con.execute(
        "INSERT INTO verdicts VALUES ('t', '2026-11-19', 'x', '2026-11-21', 'before and after', 9, 9, .5, .5, 0, -.1,"
        " .1, 'no big effect')"
    )
    reworded = Trial("t", "testing", ("x",), "2026-11-30")

    assert verdicts.with_changes(con, [reworded]) == [replace(reworded, what="")]


def test_a_rare_measure_is_settled_by_a_trusted_replay(tmp_path):
    con = store(tmp_path)
    days(con, "2026-01-01", 9, 1, [])  # days of real use with no chance
    for d in range(0, 9, 3):  # one chance every third day: rare
        add_task(con, f"b{d}", verdicts.shift("2026-01-01", d), [True])
    days(con, "2026-01-10", 3, 1, [False])
    # The replayed moments missed as often as the real agents did, and the new wording cut them by 60 to 90%.
    con.execute(
        "INSERT INTO replays VALUES ('r', 'x', '2026-01-09', 'old', 60, 60, 30, .5, .1, .8, .6, .9, .001, .5, .5,"
        " 'works')"
    )

    assert verdicts.is_rare(con, TRIAL, "x")
    taken = verdicts.judge(con, TRIAL, "x", "2026-01-12", np.random.default_rng(1))
    assert taken and (taken.source, taken.verdict, taken.change) == ("replay", "works", -0.8)


def test_a_trial_file_without_a_date_is_reported_and_the_rest_are_read(tmp_path):
    (tmp_path / "quoted.md").write_text('---\nname: A plain name\nmeasures: x\nstarted: "2026-01-01"\n---\n')
    (tmp_path / "undated.md").write_text("---\nmeasures: x\n---\n")
    errors: list[str] = []

    trials = verdicts.read_trials(tmp_path, errors)

    assert trials == [Trial("quoted", "testing", ("x",), "2026-01-01", "A plain name")]
    assert len(errors) == 1 and "undated.md" in errors[0]
