from pathlib import Path

from test_counting import MEASURES, reply, stamp, typed, write

from agent_experiments.cli import main

NAMES = "CREATE TEMP TABLE measure_names AS SELECT * FROM (VALUES ('bad-word', 'Bad words')) t(measure, name);"


def test_daily_writes_the_page_with_one_task_a_group_and_a_broken_trial_file(tmp_path: Path, capsys):
    for i, group in enumerate(("off", "on")):
        session = f"s{i}"
        write(
            tmp_path / "projects" / "one",
            session,
            [
                stamp(f"{session}-0", session, "2026-01-02T09:00:00.000Z", f"t={group} s={group} task=aaaa000{i}"),
                typed(f"{session}-1", session, "2026-01-02T09:00:01.000Z", "please fix it"),
                reply(f"{session}-2", session, "2026-01-02T09:00:02.000Z", "a bad reply", f"m{i}"),
            ],
        )
    (tmp_path / "measures.sql").write_text(MEASURES + "\n" + NAMES)
    trials = tmp_path / "trials"
    trials.mkdir()
    (trials / "t.md").write_text("---\nname: A plain name\nmeasures: bad-word\nstarted: 2026-01-01\n---\n")
    (trials / "s.md").write_text("---\nstatus: settled\nmeasures: bad-word\nstarted: 2025-12-01\n---\n")
    (trials / "undated.md").write_text("---\nmeasures: bad-word\n---\n")
    out = tmp_path / "overview.html"
    paths = {"trials": trials, "measures": tmp_path / "measures.sql", "db": tmp_path / "x.duckdb", "page": out}
    paths["transcripts"] = tmp_path / "projects" / "*" / "*.jsonl"

    code = main(["daily", "--day", "2026-01-08", *(a for k, v in paths.items() for a in (f"--{k}", str(v)))])

    assert code == 1  # the undated trial file
    assert "undated.md" in capsys.readouterr().err
    text = out.read_text(encoding="utf-8")
    assert "A plain name" in text
    assert "Bad words" in text
    assert "1 task without, 1 with" in text
    assert "can&#x27;t tell" in text  # the last look, at one task a group
