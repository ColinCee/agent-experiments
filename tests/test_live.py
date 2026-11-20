from agent_experiments import live, looks

RULES = """# Everywhere

Intro line.

- **Short notes:** keep each one brief.
- Name the widget. Not the gadget.
  - a nested line that is not a rule of its own

# Only on the laptop

- Water the plants on the windowsill every morning before the first coffee, so they never dry out in the sun.
"""

TRIAL = "---\n{status}measures: m\nstarted: 2026-01-01\n---\n## Off\nOld wording.\n## On\n{on}"


def test_lists_every_live_rule_line_and_skill_with_the_row_that_measures_it(tmp_path):
    rules = tmp_path / "AGENTS.md"
    rules.write_bytes(RULES.replace("\n", "\r\n").encode("utf-8-sig"))
    folder = tmp_path / "trials"
    folder.mkdir()
    (folder / "tried.md").write_text(TRIAL.format(status="", on="New wording.\n  - nested\n### Aside\n"))
    (folder / "kept.md").write_bytes(TRIAL.format(status='status: "settled"\n', on="- Kept wording.").encode())
    (folder / "bare.md").write_text("---\nstatus: settled\nmeasures: m\nstarted: 2026-01-01\n---\n")
    skills = tmp_path / "skills"
    for name in ("alpha", "beta"):
        (skills / name).mkdir(parents=True)
        (skills / name / "SKILL.md").write_text("x", encoding="utf-8")
    (skills / "no-skill-file").mkdir()
    trials = looks.read_trials(folder, [])

    found = live.report(rules, trials, folder, skills, {"tried": "Tried row", "kept": "Kept row"}, {"beta": "Beta row"})

    assert [(r["group"], r["label"], r["row"]) for r in found["rules"]] == [
        ("Everywhere", "Short notes", None),
        ("Everywhere", "Name the widget", None),
        ("Only on the laptop", "Water the plants on the windowsill every morning before the first coffee, so…", None),
        ("Active rules", "Kept wording", "Kept row"),
        ("Experiments", "New wording", "Tried row"),
    ]
    assert found["rules"][0]["text"] == "Short notes: keep each one brief."
    assert found["skills"] == [{"name": "alpha", "row": None}, {"name": "beta", "row": "Beta row"}]
