import json
from pathlib import Path

from agent_experiments.stops import MIN_STOPS, by_version


def test_each_version_counts_the_stops_of_its_own_days_and_shows_no_rate_under_the_minimum(tmp_path: Path):
    labels = tmp_path / "labels"
    labels.mkdir()
    rows = [{"day": "2026-01-01", "verdict": "wrong" if i < 15 else "right"} for i in range(60)]
    rows += [{"day": "2026-01-03", "verdict": "wrong"}]  # the day the rule changed: neither version's
    rows += [{"day": "2026-01-04", "verdict": "right"}] * 10 + [{"day": "2026-01-04", "verdict": "unsure"}]
    (labels / "a.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + '\n{"day": "2026-01-0')
    versions = tmp_path / "versions.csv"
    versions.write_text(
        'version,from,to,what,link\nv0,2026-01-01,2026-01-02,No rule,\nv1,2026-01-04,,"A rule, kept",\n'
    )

    old, new = by_version(labels, versions)
    assert (old["version"], old["stops"], old["rate"]) == ("v0", 60, 0.25)
    assert (new["what"], new["stops"], new["rate"]) == ("A rule, kept", 10, None)
    assert new["stops"] < MIN_STOPS
    assert by_version(tmp_path / "none", versions) == []
