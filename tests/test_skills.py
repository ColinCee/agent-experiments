from pathlib import Path

import duckdb
import numpy as np
from test_counting import reply, typed, write

from agent_experiments import looks, skills
from agent_experiments.counting import count

# A chance per reply, missed when its session never loaded the skill.
MEASURES = """CREATE TEMP TABLE chances AS
SELECT 'tidy-skill' AS measure, s, "day", ts, uuid, NOT EXISTS (SELECT 1 FROM skill_loads k WHERE k.s = t.s) AS miss
FROM texts t;
CREATE TEMP TABLE skill_measures AS SELECT * FROM (VALUES ('tidy-skill', 'tidy'), ('tidy-skill', 'tidying')) t(measure, skill);
"""


def load(uuid: str, session: str, ts: str, folder: str, text: str) -> dict:
    return typed(uuid, session, ts, f"Base directory for this skill: {folder}\n\n{text}", isMeta=True)


def session(folder: Path, name: str, day: str, extra: list[dict] | None = None) -> None:
    entries = [typed(f"{name}-0", name, f"{day}T09:00:00.000Z", "please tidy it"), *(extra or [])]
    entries.append(reply(f"{name}-9", name, f"{day}T09:00:09.000Z", "tidied", f"{name}-m"))
    write(folder, name, entries)


def test_a_skill_version_is_its_text_and_each_chance_counts_for_the_version_loaded_by_then(tmp_path: Path):
    folder = tmp_path / "projects" / "one"
    session(folder, "before", "2025-12-31")  # before any load: the skill may not have existed yet
    a = load("a-1", "a", "2026-01-01T09:00:01.000Z", r"C:\home\skills\tidy", "Do X.")
    session(folder, "a", "2026-01-01", [a])
    for i in range(11):
        session(folder, f"t{i}", f"2026-01-{2 + i:02d}")
    # The same text from another folder, with other arguments, under the skill's later name: one version.
    b1 = load("b-1", "b1", "2026-01-15T09:00:01.000Z", r"C:\home\skills\tidying", "Do Y.\n\nARGUMENTS: one")
    b2 = load("b-2", "b2", "2026-01-16T09:00:01.000Z", "D:/wt/.claude/skills/tidying", "Do Y.\n\nARGUMENTS: two")
    session(folder, "b1", "2026-01-15", [b1])
    session(folder, "b2", "2026-01-16", [b2])
    # An older copy loaded after the newer version exists: its task counts for the version it read.
    c = load("c-1", "c", "2026-01-17T09:00:01.000Z", "C:/other/skills/tidy", "Do X.")
    session(folder, "c", "2026-01-17", [c])
    (tmp_path / "measures.sql").write_text(MEASURES)
    db = tmp_path / "x.duckdb"

    count(str(tmp_path / "projects" / "*" / "*.jsonl"), tmp_path / "measures.sql", db)
    con = looks.open_store(db)
    rows = skills.report(con, {"tidy-skill": "Tidied without the tidy skill"}, "2026-01-20", np.random.default_rng(0))

    assert con.execute("SELECT skill, count(DISTINCT version) FROM skill_loads GROUP BY 1 ORDER BY 1").fetchall() == [
        ("tidy", 1),
        ("tidying", 1),
    ]
    [row] = rows
    assert row["name"] == "Tidied without the tidy skill" and row["skills"] == ["tidy", "tidying"]
    newer, older = row["versions"]
    assert (newer["skill"], newer["since"], newer["tasks"], newer["rate"]) == ("tidying", "2026-01-15", 2, None)
    assert (older["skill"], older["since"], older["tasks"]) == ("tidy", "2026-01-01", 13)
    assert older["rate"] == 11 / 13 and older["low"] is not None
    assert all(s["rate"] is None for s in row["series"] if s["day"] < "2026-01-01")
    assert row["now"]["tasks"] == 15 and [m["session"] for m in row["misses"]] == ["t10", "t9", "t8", "t7", "t6"]


def test_a_skill_committed_before_its_first_load_counts_the_tasks_since_its_commit(tmp_path: Path):
    folder = tmp_path / "projects" / "one"
    session(folder, "before", "2025-12-31")
    session(folder, "a", "2026-01-01", [load("a-1", "a", "2026-01-01T09:00:01.000Z", "C:/s/tidy", "Do X.")])
    (tmp_path / "measures.sql").write_text(MEASURES)
    db = tmp_path / "x.duckdb"
    count(str(tmp_path / "projects" / "*" / "*.jsonl"), tmp_path / "measures.sql", db)
    con = looks.open_store(db)
    con.execute(
        "INSERT INTO sizes VALUES (1, 'abc', '2025-12-30', 'skills/*/SKILL.md', 'skills/tidying/SKILL.md', 9, 9, 0)"
    )

    [row] = skills.report(con, {}, "2026-01-02", np.random.default_rng(0))

    assert row["now"]["tasks"] == 2 and [m["session"] for m in row["misses"]] == ["before"]


def test_a_store_counted_with_no_skill_measures_reports_no_skills(tmp_path: Path):
    session(tmp_path / "projects" / "one", "a", "2026-01-01")
    (tmp_path / "measures.sql").write_text(MEASURES.split(";")[0] + ";")
    db = tmp_path / "x.duckdb"

    count(str(tmp_path / "projects" / "*" / "*.jsonl"), tmp_path / "measures.sql", db)

    assert skills.report(looks.open_store(db), {}, "2026-01-02", np.random.default_rng(0)) == []
    assert duckdb.connect(str(db)).execute("SELECT count(*) FROM skill_loads").fetchone() == (0,)
