import os
import subprocess
from pathlib import Path

import duckdb

from agent_experiments import rules, verdicts
from agent_experiments.verdicts import Trial

LINES = ["- Load `shipping` before a pull request.", "- Never print a secret.", "| A big job | Run it overnight |"]


def repo_with_rules(tmp_path: Path, written: str) -> Path:
    repo = tmp_path / "agents"
    (repo / "home").mkdir(parents=True)
    for skill in ("shipping", "unused"):
        (repo / "skills" / skill).mkdir(parents=True)
        (repo / "skills" / skill / "SKILL.md").write_text("---\nname: x\n---\n")
    (repo / "home" / "core.md").write_text("# Rules\n\n| When | Read or do |\n|---|---|\n" + "\n".join(LINES) + "\n")
    git = ["git", "-C", str(repo), "-c", "user.name=t", "-c", "user.email=t@example.com"]
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    subprocess.run([*git, "add", "-A"], check=True)
    env = {**os.environ, "GIT_AUTHOR_DATE": f"{written}T12:00:00Z", "GIT_COMMITTER_DATE": f"{written}T12:00:00Z"}
    subprocess.run([*git, "commit", "-q", "-m", "rules"], check=True, env=env)
    return repo


def rule_use(tmp_path: Path, days: dict[str, list[str]]) -> Path:
    """The rule-use count's daily files: for each day, the lines that had a chance in one session."""
    folder = tmp_path / "rule-use"
    folder.mkdir()
    for day, lines in days.items():
        rows = [f"{day},s,home,home:{rules.key(line)},x,0" for line in lines]
        (folder / f"{day}.csv").write_text("day,session,file,line,text,broke\n" + "\n".join(rows) + "\n")
        (folder / f"{day}-skills.csv").write_text("day,session,at,skill,version\n")
    return folder


def test_each_rule_line_trial_line_and_skill_is_a_row_with_its_measures_and_use(tmp_path: Path):
    repo = repo_with_rules(tmp_path, "2026-01-01")
    use = rule_use(tmp_path, {"2026-01-02": [LINES[0], LINES[1]], "2026-01-03": [LINES[0]]})
    con = duckdb.connect()
    con.execute("CREATE TABLE skill_measures AS SELECT * FROM (VALUES ('ship-skill', 'shipping')) t(measure, skill)")
    trial = Trial("t", "testing", ("bad-word",), "2026-01-02", wording="Say less.\nSay it once.")

    rows = rules.report(
        con, repo, [trial], {"ship-skill": "Shipped without the skill"}, "2026-01-03", use, lambda _: {"shipping": 4}
    )

    found = {(r["kind"], r["text"]): (r["measures"], r["used"], r["window"]) for r in rows}
    window = {"from": "2026-01-02", "days": 2}
    assert found == {
        ("rule", LINES[0]): (["Shipped without the skill"], 2, window),
        ("rule", LINES[1]): ([], 1, window),
        ("rule", LINES[2]): ([], 0, window),
        ("trial", "Say less."): (["bad-word"], None, None),
        ("trial", "Say it once."): (["bad-word"], None, None),
        ("skill", "shipping"): (["Shipped without the skill"], 4, {"from": "2025-12-05", "days": rules.TRIM_DAYS}),
        ("skill", "unused"): ([], None, None),  # not installed, so the skill count has no row for it
    }


def test_a_line_written_after_the_count_began_counts_only_from_then(tmp_path: Path):
    repo = repo_with_rules(tmp_path, "2026-01-03")
    use = rule_use(tmp_path, {"2026-01-02": [LINES[0]], "2026-01-03": [LINES[0]], "2026-01-04": []})
    con = duckdb.connect()
    con.execute("CREATE TABLE skill_measures (measure VARCHAR, skill VARCHAR)")

    rows = rules.report(con, repo, [], {}, "2026-01-04", use, lambda _: {})

    first = next(r for r in rows if r["text"] == LINES[0])
    assert (first["used"], first["window"]) == (1, {"from": "2026-01-03", "days": 2})


def test_a_model_switch_is_the_day_most_sessions_over_a_week_move_to_another_model():
    con = duckdb.connect()
    con.execute('CREATE TABLE sessions (session VARCHAR, "day" VARCHAR, model VARCHAR, typed INT)')
    for d in range(20):
        day = verdicts.shift("2026-01-01", d)
        model = "old" if d < 8 else "new"
        con.execute(
            "INSERT INTO sessions VALUES (?, ?, ?, 1), (?, ?, ?, 1)", [f"a{d}", day, model, f"b{d}", day, model]
        )
        if d == 3:  # one day with a session on a third model is not a switch
            con.execute("INSERT INTO sessions VALUES ('c', ?, 'other', 1)", [day])

    assert verdicts.model_switches(con, "2026-01-01", "2026-01-20") == [("2026-01-12", "new")]
