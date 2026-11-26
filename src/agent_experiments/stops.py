"""Stops: needless stops per 100 labelled stops under each version of the stop rules (docs/architecture.md#stops)."""

from pathlib import Path

import duckdb

# Under this one nudge moves the rate by 2 per 100 or more, more than the changes it is read for.
MIN_STOPS = 50

# A day between two versions (the day a change went in) belongs to neither.
BY_VERSION = """
WITH l AS (
  SELECT left("day", 10) AS "day", verdict FROM read_json($labels, format = 'newline_delimited',
    columns = {"day": 'VARCHAR', verdict: 'VARCHAR'}, ignore_errors = true)
  WHERE verdict IN ('right', 'wrong')),
v AS (SELECT version, "from", "to", what FROM read_csv($versions, all_varchar = true))
SELECT version, "from", what, count(l."day") AS stops, avg((l.verdict = 'wrong')::INTEGER) AS rate
FROM v LEFT JOIN l ON l."day" >= v."from" AND (v."to" IS NULL OR l."day" <= v."to")
GROUP BY ALL ORDER BY "from"
"""


def by_version(labels: Path, versions: Path) -> list[dict]:
    """Each version of the stop rules, oldest first, with its labelled stops and the share the user had to nudge on;
    the share is null under MIN_STOPS. Empty with no versions file or no labels."""
    if not versions.is_file() or not any(labels.glob("*.jsonl")):
        return []
    found = duckdb.execute(
        BY_VERSION, {"labels": f"{labels.as_posix()}/*.jsonl", "versions": versions.as_posix()}
    ).fetchall()
    return [
        {"version": v, "from": f, "what": w, "stops": n, "rate": r if n >= MIN_STOPS else None}
        for v, f, w, n, r in found
    ]
