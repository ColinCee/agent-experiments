"""Rule and skill size: each file's words after every commit that changed it, and the lines it added and deleted, read
from git (docs/architecture.md#rule-and-skill-size)."""

import subprocess
from pathlib import Path, PurePosixPath

import duckdb

from agent_experiments.counting import SCHEMA

# The agents repo's every-turn rules files and its skills.
PATHS = ("home/*.md", "skills/*/SKILL.md")
LABELS = dict(zip(PATHS, ("Rules", "Skills"), strict=True))


def _git(repo: Path, *args: str, stdin: bytes | None = None) -> bytes:
    return subprocess.run(
        ["git", "-C", str(repo), *args], input=stdin, capture_output=True, check=True, timeout=300
    ).stdout


def changes(repo: Path, globs: tuple[str, ...]) -> list[tuple[str, str, str, str, int, int]]:
    """Rows of (commit, day, glob, file, added, deleted), each commit after its parents. A file renamed away gets a row
    of its own with nothing added or deleted, so its old name stops counting from then."""
    # The whole repo, filtered after: git sees a rename only when both names are in what it logs, and a file moved into
    # a glob from anywhere would otherwise count as all new lines.
    log = _git(repo, "log", "--reverse", "--topo-order", "-z", "--numstat", "-M", "--format=%x01%H %cs")
    rows = []
    for record in log.decode("utf-8", "replace").split("\x01")[1:]:
        header, _, rest = record.partition("\x00")
        commit, day = header.split()
        fields = rest.lstrip("\n").split("\x00")
        i = 0
        while i < len(fields) and fields[i]:
            added, deleted, path = fields[i].split("\t")
            if path:
                i += 1
            else:  # a rename: the old path and the new follow, each on its own
                old, path = fields[i + 1], fields[i + 2]
                rows.append((commit, day, old, 0, 0))
                i += 3
            # A binary file's counts are "-".
            rows.append((commit, day, path, int(added) if added != "-" else 0, int(deleted) if deleted != "-" else 0))
    out = []
    for commit, day, path, added, deleted in rows:
        glob = next((g for g in globs if PurePosixPath(path).full_match(g)), None)
        if glob:
            out.append((commit, day, glob, path, added, deleted))
    return out


def words(repo: Path, rows: list[tuple]) -> list[int]:
    """Each row's file's words just after its commit, 0 where the commit removed it, read with one git process."""
    found = _git(repo, "cat-file", "--batch", stdin="".join(f"{r[0]}:{r[3]}\n" for r in rows).encode())
    counts, at = [], 0
    for _ in rows:
        end = found.index(b"\n", at)
        header = found[at:end].split()
        at = end + 1
        if header[-1] == b"missing":
            counts.append(0)
            continue
        size = int(header[2])
        counts.append(len(found[at : at + size].decode("utf-8", "replace").split()))
        at += size + 1
    return counts


def measure(repo: Path, globs: tuple[str, ...], db: Path) -> int:
    """Replaces the sizes table in `db` from `repo`'s history; returns how many changes it holds."""
    rows = changes(repo, globs)
    counted = words(repo, rows)
    con = duckdb.connect(str(db))
    con.execute(SCHEMA)
    con.execute("BEGIN")
    con.execute("DELETE FROM sizes")
    con.executemany(
        "INSERT INTO sizes VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [(i, c, day, g, f, n, a, d) for i, ((c, day, g, f, a, d), n) in enumerate(zip(rows, counted, strict=True))],
    )
    con.execute("COMMIT")
    con.close()
    return len(rows)


def report(con) -> dict:
    """The report's `sizes`: each pattern's words by day and now, the largest files now, and per month and pattern how
    often a change only added lines and the share of changed lines that were added."""
    words_by_day = con.execute("""
        WITH days AS (SELECT DISTINCT "day" FROM sizes),
        latest AS (
          SELECT d."day", s.pattern, s.file, arg_max(s.words, s.n) AS words
          FROM days d JOIN sizes s ON s."day" <= d."day" GROUP BY ALL)
        SELECT "day", pattern, sum(words)::INT FROM latest GROUP BY ALL ORDER BY "day", pattern""").fetchall()
    largest = con.execute("""
        SELECT file, arg_max(words, n) AS words FROM sizes GROUP BY file HAVING words > 0
        ORDER BY words DESC LIMIT 8""").fetchall()
    months = con.execute("""
        SELECT left("day", 7) AS month, pattern, count(*) AS changes, avg((deleted = 0)::INT) AS only_added,
               sum(added) / sum(added + deleted) AS added_share
        FROM sizes WHERE added + deleted > 0 GROUP BY ALL ORDER BY month, pattern""").fetchall()
    series = []
    for pattern, label in LABELS.items():
        points = [{"day": d, "words": w} for d, p, w in words_by_day if p == pattern]
        if points:
            series.append({"label": label, "now": points[-1]["words"], "points": points})
    return {
        "series": series,
        "largest": [{"file": f, "words": w} for f, w in largest],
        "months": [
            {"month": m, "label": LABELS[p], "changes": n, "only_added": o, "added_share": a}
            for m, p, n, o, a in months
            if p in LABELS
        ],
    }
