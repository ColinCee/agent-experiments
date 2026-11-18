"""Skills: how often each skill is missed when its moment comes, over time and by the version agents loaded.

How and why: docs/architecture.md#skills. Reads the skill_loads, skill_measures and chances tables counting.py builds.
"""

import numpy as np

from agent_experiments import looks
from agent_experiments.looks import shift
from agent_experiments.stats import rate_range

TIMELINE_DAYS = 42
SERIES_DAYS = 7  # a skill's moment comes a few times a day at most, so its rate is drawn over a week
# A version with fewer tasks shows no rate: skills change several times a week, and a rate from a handful of tasks
# would rank versions by luck.
MIN_VERSION_TASKS = 10

# Each chance goes to the version first loaded at or before it, since a missed chance has no load of its own.
VERSION_TASKS = """
WITH v AS (
  SELECT version, min(ts)::TIMESTAMP AS since FROM skill_loads
  WHERE skill IN (SELECT skill FROM skill_measures WHERE measure = $measure) GROUP BY version),
c AS (
  SELECT c.ts::TIMESTAMP AS ts, c.miss, t.task FROM chances c JOIN tasks t USING (session)
  WHERE c.measure = $measure AND c."day" BETWEEN $first AND $last)
SELECT v.version, c.task, count(*) AS chances, sum(c.miss::INT) AS misses
FROM c ASOF JOIN v ON c.ts >= v.since GROUP BY ALL
"""

VERSIONS = """
SELECT version, arg_min(skill, ts) AS skill, min("day") AS since FROM skill_loads
WHERE skill IN (SELECT skill FROM skill_measures WHERE measure = $measure) GROUP BY version ORDER BY min(ts)
"""

MISSES = """
SELECT c.session, max(c."day") AS "day" FROM chances c JOIN tasks t USING (session)
WHERE c.measure = $measure AND c.miss AND c."day" BETWEEN $first AND $last
GROUP BY c.session ORDER BY max(c.ts) DESC LIMIT $n
"""


def report(con, names: dict[str, str], day: str, rng: np.random.Generator) -> list[dict]:
    """One row per measure the measures file ties to a skill, by name."""
    tied = con.execute("SELECT measure, list(DISTINCT skill ORDER BY skill) FROM skill_measures GROUP BY measure")
    rows = [_row(con, measure, skills, names.get(measure), day, rng) for measure, skills in tied.fetchall()]
    return sorted(rows, key=lambda r: r["name"])


def _row(con, measure: str, skills: list[str], name: str | None, day: str, rng: np.random.Generator) -> dict:
    first = shift(day, 1 - TIMELINE_DAYS)
    recent = shift(day, 1 - looks.USUAL_DAYS)
    per_version: dict[str, list[tuple[int, int]]] = {}
    for version, _, chances, misses in con.execute(
        VERSION_TASKS, {"measure": measure, "first": first, "last": day}
    ).fetchall():
        per_version.setdefault(version, []).append((chances, misses))
    found = con.execute(VERSIONS, {"measure": measure}).fetchall()
    # The version in force when the timeline starts, and every one after it.
    start = max((i for i, (_, _, since) in enumerate(found) if since <= first), default=0)
    versions = []
    for version, skill, since in reversed(found[start:]):
        tasks = np.array(per_version.get(version, []), dtype=float).reshape(-1, 2)
        rate = low = high = None
        if len(tasks) >= MIN_VERSION_TASKS:
            rate, low, high = (None if np.isnan(x) else float(x) for x in rate_range(tasks, rng))
        versions.append(
            {
                "version": version,
                "skill": skill,
                "since": since,
                "tasks": len(tasks),
                "rate": rate,
                "low": low,
                "high": high,
            }
        )
    # Before any agent loaded the skill it may not have existed, so a task then could not miss it; a skill never
    # loaded keeps every task.
    born = found[0][2] if found else ""
    recent = max(recent, born)
    counts = looks.by_day(con, measure, max(shift(first, 1 - SERIES_DAYS), born), day)
    args = {"measure": measure, "first": recent, "last": day, "n": looks.LATEST_MISSES}
    misses = con.execute(MISSES, args).fetchall()
    return {
        "name": name or " / ".join(skills),
        "skills": skills,
        "now": looks.side(con, measure, recent, day, rng)[0],
        "series": [
            {"day": d, "rate": r if d >= born else None} for d, r in looks.rolling(counts, first, day, SERIES_DAYS)
        ],
        "versions": versions,
        "misses": [{"day": d, "session": s} for s, d in misses],
    }
