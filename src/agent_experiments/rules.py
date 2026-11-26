"""Every rule line and skill in force, each with the measures that count its mistake and how often it had a chance to
be broken lately (docs/architecture.md#rules-and-skills-in-force)."""

import csv
import hashlib
import json
import re
import subprocess
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from agent_experiments.verdicts import Trial, shift

RULES = "home/*.md"
SKILLS = "skills/*/SKILL.md"
SKILL_USE = "tools/skill-use.sql"
TRIM_DAYS = 30  # no chance in this long, and a rule or skill may no longer earn its words
HEADER = re.compile(r"^\|[\s|:-]*\|?$|^\| (When|) \|")


def rule_lines(repo: Path) -> list[tuple[str, str]]:
    """Each rules file's bullet and table lines, as the rule-use count reads them (its `day.py`)."""
    out = []
    for path in sorted(repo.glob(RULES)):
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if line.startswith("- ") or (line.startswith("|") and not HEADER.match(line)):
                out.append((path.name, line))
    return out


def key(line: str) -> str:
    """The rule-use count's key for a line, so a reworded line is a new line."""
    return hashlib.sha1(line.encode()).hexdigest()[:8]


def chances(folder: Path, first: str, last: str) -> tuple[dict[str, list[str]], list[str]]:
    """Each line key's chances from `first` to `last` in the rule-use count's daily files, as their days, and the days
    the files hold."""
    found: dict[str, list[str]] = {}
    days = []
    for path in sorted(folder.glob("????-??-??.csv")):
        if not first <= path.stem <= last:
            continue
        days.append(path.stem)
        with path.open(encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                k = row["line"].rsplit(":", 1)[-1]
                found.setdefault(k, []).append(path.stem)
    return found, days


def written(repo: Path) -> dict[str, str]:
    """The day each current rule line was last written, by its key, from git blame."""
    out = {}
    for path in sorted(repo.glob(RULES)):
        blame = subprocess.run(
            ["git", "blame", "--line-porcelain", "--", path.relative_to(repo).as_posix()],
            cwd=repo,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        ).stdout
        when = 0
        for line in blame.splitlines():
            if line.startswith("author-time "):
                when = int(line.split()[1])
            elif line.startswith("\t"):
                out[key(line[1:].strip())] = datetime.fromtimestamp(when, UTC).date().isoformat()
    return out


def skill_loads(repo: Path) -> dict[str, int]:
    """Each installed skill's loads over the last TRIM_DAYS days, from the agents repo's own count, which runs in the
    DuckDB command line: it reads the home folder with `getenv`, which only the command line has. None for a repo
    without that count."""
    if not (repo / SKILL_USE).is_file():
        return {}
    out = subprocess.run(
        ["duckdb", "-json", "-cmd", f"SET VARIABLE days = {TRIM_DAYS}", "-f", str(repo / SKILL_USE)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
        timeout=600,
    ).stdout
    rows = json.loads(out or "[]")
    return {r["skill"]: r["by_agent"] + r["read_as_file"] + r["by_user"] for r in rows}


def report(
    con,
    repo: Path,
    trials: list[Trial],
    names: dict[str, str],
    day: str,
    rule_use: Path,
    errors: list[str],
    loads: Callable[[Path], dict[str, int]] = skill_loads,
) -> list[dict]:
    """One row per rule line, trial `## On` line and skill: the names of the measures that count its mistake (none is
    not measured), and how often it was used over the last TRIM_DAYS days, or since it was written, with the days
    counted; null where nothing counts it. A rule line's use is its chances to be broken, a skill's its loads. A rule
    line is measured by the skills it names, a trial by its own measures. A count that fails is added to `errors` and
    its uses left null, so the page is still written."""
    by_skill = con.execute("SELECT skill, measure FROM skill_measures ORDER BY skill, measure").fetchall()
    first = shift(day, 1 - TRIM_DAYS)
    counted, days = chances(rule_use, first, day)
    try:
        ages = written(repo) if days else {}
    except (OSError, subprocess.SubprocessError) as e:
        errors.append(f"Rule lines' use left out: git blame in {repo} failed: {e}")
        days, ages = [], {}

    def measured(ids: list[str]) -> list[str]:
        return [names.get(m, m) for m in dict.fromkeys(ids)]

    rows = []
    for file, text in rule_lines(repo):
        k = key(text)
        since = [d for d in days if d >= ages.get(k, day)]
        named = set(re.findall(r"`([a-z0-9-]+)`", text))
        rows.append(
            {
                "kind": "rule",
                "file": file,
                "text": text,
                "measures": measured([m for sk, m in by_skill if sk in named]),
                "used": sum(d >= since[0] for d in counted.get(k, [])) if since else None,
                "window": {"from": since[0], "days": len(since)} if since else None,
            }
        )
    rows += [
        {
            "kind": "trial",
            "file": f"trials/{t.name}.md",
            "text": line,
            "measures": measured(list(t.measures)),
            "used": None,  # the hook gives it, and the rule-use count reads only rules files
            "window": None,
        }
        for t in trials
        if t.filed
        for line in t.wording.splitlines()
        if line.strip()
    ]
    try:
        loaded = loads(repo)
    except (OSError, subprocess.SubprocessError, ValueError) as e:
        errors.append(f"Skills' use left out: {SKILL_USE} in the DuckDB command line failed: {e}")
        loaded = {}
    for path in sorted(repo.glob(SKILLS)):
        skill = path.parent.name
        rows.append(
            {
                "kind": "skill",
                "file": skill,
                "text": skill,
                "measures": measured([m for sk, m in by_skill if sk == skill]),
                "used": loaded.get(skill),
                "window": {"from": first, "days": TRIM_DAYS} if skill in loaded else None,
            }
        )
    return rows
