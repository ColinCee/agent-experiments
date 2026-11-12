import subprocess
from pathlib import Path

import duckdb

from agent_experiments.size import measure, report


def _commit(repo: Path, message: str) -> None:
    git = ["git", "-C", str(repo), "-c", "user.name=t", "-c", "user.email=t@example.com"]
    subprocess.run([*git, "add", "-A"], check=True)
    subprocess.run([*git, "commit", "-q", "-m", message], check=True)


def test_sizes_follow_appends_renames_and_deletes_and_skip_files_outside_the_globs(tmp_path: Path):
    repo = tmp_path / "repo"
    (repo / "home" / "trials").mkdir(parents=True)
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    rules = repo / "home" / "rules.md"
    rules.write_text("one two three\n")
    (repo / "home" / "trials" / "t.md").write_text("not sized\n")
    _commit(repo, "start")
    rules.write_text("one two three\nfour five\n")
    _commit(repo, "append")
    rules.rename(repo / "home" / "core.md")
    _commit(repo, "rename")
    (repo / "home" / "core.md").write_text("one\n")
    _commit(repo, "rewrite")
    (repo / "home" / "core.md").unlink()
    _commit(repo, "delete")
    db = tmp_path / "x.duckdb"

    assert measure(repo, ("home/*.md",), db) == 6

    con = duckdb.connect(str(db))
    rows = con.execute("SELECT file, words, added, deleted FROM sizes ORDER BY n").fetchall()
    assert rows == [
        ("home/rules.md", 3, 1, 0),
        ("home/rules.md", 5, 1, 0),
        ("home/rules.md", 0, 0, 0),  # renamed away: its words now count under the new name
        ("home/core.md", 5, 0, 0),
        ("home/core.md", 1, 1, 2),
        ("home/core.md", 0, 0, 1),
    ]
    assert report(con)["largest"] == []


def test_a_file_moved_into_a_glob_counts_no_lines_added(tmp_path: Path):
    repo = tmp_path / "repo"
    (repo / "skills" / ".drafts" / "a").mkdir(parents=True)
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    (repo / "skills" / ".drafts" / "a" / "SKILL.md").write_text("one\ntwo\nthree\n")
    _commit(repo, "draft")
    (repo / "skills" / ".drafts" / "a").rename(repo / "skills" / "a")
    _commit(repo, "move")
    db = tmp_path / "x.duckdb"

    measure(repo, ("skills/*/SKILL.md",), db)

    rows = duckdb.connect(str(db)).execute("SELECT file, words, added, deleted FROM sizes").fetchall()
    assert rows == [("skills/a/SKILL.md", 3, 0, 0)]
