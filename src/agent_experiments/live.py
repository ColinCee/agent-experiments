"""Everything agents run on now, and which of it the page measures: each installed rule line and skill.

How and why: docs/architecture.md#live-now.
"""

import re
from pathlib import Path

from agent_experiments.looks import Trial

LABEL_CHARS = 80


def report(
    rules: Path, trials: list[Trial], folder: Path, skills: Path, trial_rows: dict[str, str], skill_rows: dict[str, str]
) -> dict:
    """Rule lines from the installed rules file and the trials' On sections in `folder`, and the installed skills; a
    measured one names its row on the page. `trial_rows` maps a trial's name to its row, `skill_rows` a skill's."""
    lines = [{**_line(text, group), "row": None} for group, text in _bullets(_read(rules))]
    for trial in trials:
        group = "Experiments" if trial.status == "testing" else "Active rules"
        lines += [
            {**_line(text, group), "row": trial_rows.get(trial.name)}
            for text in _rule_lines(_section(_read(folder / f"{trial.name}.md"), "On"))
        ]
    installed = sorted(p.parent.name for p in skills.glob("*/SKILL.md")) if skills.is_dir() else []
    return {"rules": lines, "skills": [{"name": s, "row": skill_rows.get(s)} for s in installed]}


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig").replace("\r\n", "\n") if path.is_file() else ""


def _section(text: str, name: str) -> str:
    found = re.search(rf"^## {name}[ \t]*\n(.*?)(?=^## |\Z)", text, re.MULTILINE | re.DOTALL)
    return found[1] if found else ""


def _rule_lines(text: str) -> list[str]:
    """A section's lines that stand at its left edge: a nested bullet or a heading is not a rule of its own."""
    return [line.removeprefix("- ").strip() for line in text.splitlines() if line.strip() and line[0] not in " \t#"]


def _bullets(text: str) -> list[tuple[str, str]]:
    """Each top-level bullet under its top-level heading."""
    group, found = "", []
    for line in text.splitlines():
        if line.startswith("# "):
            group = line[2:].strip()
        elif line.startswith("- "):
            found.append((group, line[2:].strip()))
    return found


def _line(text: str, group: str) -> dict:
    plain = re.sub(r"\*\*|`", "", text).strip()
    # A rule line opens with its gist, up to the first colon or full stop.
    label = re.split(r"(?<=\S):\s|\.\s", plain, maxsplit=1)[0].rstrip(".:")
    if len(label) > LABEL_CHARS:
        label = label[: LABEL_CHARS - 1].rsplit(" ", 1)[0] + "…"
    return {"label": label, "text": plain, "group": group}
