import json
import math
import re
from pathlib import Path

import duckdb
import numpy as np
import pytest
from test_counting import reply, stamp, typed, write

from agent_experiments import cli, overview
from agent_experiments.cli import main
from agent_experiments.counting import SCHEMA

# Two measures on reply text: one a rule changed for, one no rule covers. A name with `</script><!--` in it must not
# end the page's data early.
MEASURES = """CREATE TEMP TABLE chances AS
SELECT 'bad-word' AS measure, s, "day", ts, uuid, txt LIKE '%bad%' AS miss FROM texts
UNION ALL SELECT 'long-reply', s, "day", ts, uuid, length(txt) > 8 FROM texts;
CREATE TEMP TABLE measure_names AS
SELECT * FROM (VALUES ('bad-word', 'Bad words'), ('long-reply', 'Long </script><!-- replies')) t(measure, name);
CREATE TEMP TABLE changes AS SELECT * FROM (VALUES ('bad-word', '2026-01-02', 'rule added')) t(measure, "day", what);
"""
# The placeholder anywhere but the report's tag must stay as it is.
TEMPLATE = (
    '<html><script>const empty = "__REPORT__"</script>'
    '<script id="report" type="application/json">__REPORT__</script></html>'
)
PACKAGED = overview.template
SIDE = {"rate", "low", "high", "tasks", "from"}
KEYS = {
    "report": {"day", "written", "sessions", "trials", "permanent", "mistakes", "replays", "sizes"},
    "sessions": {"total", "in_group", "split_since"},
    "trial": {"name", "started", "ends", "state", "verdict", "tasks_with", "tasks_without", "rate_with"}
    | {"rate_without", "change", "needed", "per_week", "looks", "trend"},
    "permanent": {"name", "since", "model", "tasks_with", "tasks_without", "change", "slipping"},
    "mistake": {"name", "today", "rule", "before", "after", "change", "sure", "current", "series", "changes"},
}


def daily(tmp_path: Path, day: str = "2026-01-02") -> int:
    """`daily` on made-up sessions: a task in each half of a running trial, a scheduled trial, a settled one and a
    broken trial file."""
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
    (tmp_path / "measures.sql").write_text(MEASURES)
    trials = tmp_path / "trials"
    trials.mkdir(exist_ok=True)
    (trials / "t.md").write_text("---\nname: A plain name\nmeasures: bad-word\nstarted: 2026-01-01\n---\n")
    (trials / "later.md").write_text("---\nmeasures: bad-word\nstarted: 2026-01-10\n---\n")
    (trials / "s.md").write_text("---\nstatus: settled\nmeasures: bad-word\nstarted: 2025-12-01\n---\n")
    (trials / "undated.md").write_text("---\nmeasures: bad-word\n---\n")
    paths = {"trials": trials, "measures": tmp_path / "measures.sql", "db": tmp_path / "x.duckdb"}
    paths |= {"page": tmp_path / "overview.html", "transcripts": tmp_path / "projects" / "*" / "*.jsonl"}
    return main(["daily", "--day", day, *(a for k, v in paths.items() for a in (f"--{k}", str(v)))])


@pytest.fixture(autouse=True)
def template(monkeypatch):
    monkeypatch.setattr(overview, "template", lambda: TEMPLATE)


def test_daily_writes_the_report_and_puts_it_in_the_page(tmp_path: Path, capsys):
    assert daily(tmp_path) == 1  # the undated trial file
    assert "undated.md" in capsys.readouterr().err

    text = (tmp_path / "report.json").read_text(encoding="utf-8")
    report = json.loads(text)
    assert "NaN" not in text and "Infinity" not in text
    assert set(report) == KEYS["report"] and set(report["sessions"]) == KEYS["sessions"]
    assert report["sessions"] == {"total": 2, "in_group": 2, "split_since": "2026-01-02"}
    trials = {t["started"]: t for t in report["trials"]}
    assert all(set(t) == KEYS["trial"] for t in trials.values())
    running, scheduled = trials["2026-01-01"], trials["2026-01-10"]
    assert (running["name"], running["state"], running["ends"]) == ("Bad words", "running", "2026-01-08")
    assert (running["tasks_with"], running["tasks_without"], running["rate_with"]) == (1, 1, 1.0)
    assert running["change"] is None  # one task a half is too few to compare
    assert [p["day"] for p in running["trend"]] == ["2026-01-01", "2026-01-02"]
    assert running["trend"][1] == {"day": "2026-01-02", "with": 1.0, "without": 1.0}
    assert (scheduled["state"], scheduled["trend"], scheduled["verdict"]) == ("scheduled", [], None)
    (permanent,) = report["permanent"]
    assert set(permanent) == KEYS["permanent"] and permanent["since"] == "2025-12-01"
    mistakes = {m["name"]: m for m in report["mistakes"]}
    assert all(set(m) == KEYS["mistake"] for m in mistakes.values())
    ruled, unruled = mistakes["Bad words"], mistakes["Long </script><!-- replies"]
    assert ruled["rule"] == {"day": "2026-01-02", "what": "rule added"}
    assert ruled["current"] is None and set(ruled["after"]) == SIDE and ruled["after"]["from"] == "2026-01-02"
    assert unruled["rule"] is None and unruled["before"] is None and set(unruled["current"]) == SIDE
    assert len(ruled["series"]) == cli.TIMELINE_DAYS

    html = (tmp_path / "overview.html").read_text(encoding="utf-8")
    assert 'const empty = "__REPORT__"' in html
    data = re.search(r'<script id="report" type="application/json">(.*?)</script>', html, re.DOTALL)
    assert data and json.loads(data.group(1))["mistakes"] == report["mistakes"]


def test_the_last_look_finishes_a_trial_and_replays_and_sizes_are_reported(tmp_path: Path):
    with duckdb.connect(str(tmp_path / "x.duckdb")) as con:
        con.execute(SCHEMA)
        # A replay that missed far less often than the real agents did: its drop stands for nothing.
        con.execute(
            "INSERT INTO replays VALUES ('r', 'bad-word', '2026-01-07', 'old', 9, 8, 5, .4, .2, .5, .2, .8, .01, .3, .1, 'replay can''t test this')"
        )
        con.execute("""INSERT INTO sizes VALUES (1, 'a', '2025-12-01', 'home/*.md', 'home/a.md', 100, 10, 0),
                       (2, 'b', '2026-01-05', 'home/*.md', 'home/a.md', 120, 20, 0)""")

    assert daily(tmp_path, "2026-01-08") == 1

    report = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))
    (trial,) = [t for t in report["trials"] if t["started"] == "2026-01-01"]
    assert (trial["state"], trial["verdict"]) == ("finished", "can't tell")
    assert trial["looks"] == [
        {"look": 3, "day": "2026-01-08", "verdict": "can't tell", "tasks_with": 1, "tasks_without": 1}
    ]
    (r,) = report["replays"]
    assert (r["name"], r["trusted"], r["real_rate"], r["replay_rate"]) == ("Bad words", False, 0.3, 0.1)
    assert r["change"] == pytest.approx({"value": -0.5, "low": -0.8, "high": -0.2})
    (series,) = report["sizes"]["series"]
    assert (series["label"], series["now"], series["points"][0]["words"]) == ("Rules", 120, 100)
    assert report["sizes"]["largest"] == [{"file": "home/a.md", "words": 120}]


def test_trial_starts_are_marked_but_never_move_the_before_and_after_boundary(tmp_path: Path):
    trials = tmp_path / "trials"
    trials.mkdir()
    (trials / "new.md").write_text("---\nname: New wording\nmeasures: bad-word\nstarted: 2026-01-03\n---\n")
    (trials / "kept.md").write_text("---\nstatus: settled\nmeasures: bad-word\nstarted: 2026-01-04\n---\n")

    daily(tmp_path, "2026-01-05")

    report = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))
    (bad,) = [m for m in report["mistakes"] if m["name"] == "Bad words"]
    assert bad["rule"] == {"day": "2026-01-02", "what": "rule added"}
    assert bad["after"]["from"] == "2026-01-02" and bad["after"]["tasks"] == 2
    assert bad["changes"] == [
        {"day": "2026-01-01", "what": "A plain name", "kind": "trial"},
        {"day": "2026-01-02", "what": "rule added", "kind": "rule"},
        {"day": "2026-01-03", "what": "New wording", "kind": "trial"},
    ]


def test_a_change_below_zero_is_fewer_misses_with_its_range_around_it():
    effect = cli.Effect(off=0.4, on=0.2, drop=0.5, low=0.2, high=0.7, p=0.01)

    assert cli._change(effect) == {"value": -0.5, "low": -0.7, "high": -0.2}
    assert cli._change(cli.Effect(0.0, 0.1, math.nan, math.nan, math.nan, 1.0)) is None


def test_nan_and_numpy_values_become_plain_json(tmp_path: Path):
    report = {"a": math.nan, "b": np.float64(np.inf), "c": [np.int64(3), np.bool_(True)], "d": (1.5,)}

    overview.write(tmp_path / "overview.html", report, TEMPLATE)

    assert json.loads((tmp_path / "report.json").read_text()) == {"a": None, "b": None, "c": [3, True], "d": [1.5]}


@pytest.mark.parametrize("html", ["<html>no slot</html>", TEMPLATE.replace("__REPORT__</script></html>", "</html>")])
def test_a_template_without_its_slot_leaves_both_files(tmp_path: Path, html: str):
    page, data = tmp_path / "overview.html", tmp_path / "report.json"
    page.write_bytes(b"old page")
    data.write_bytes(b"old report")

    with pytest.raises(ValueError, match="__REPORT__"):
        overview.write(page, {"day": "2026-01-02"}, html)

    assert (page.read_bytes(), data.read_bytes()) == (b"old page", b"old report")
    assert sorted(p.name for p in tmp_path.iterdir()) == ["overview.html", "report.json"]


def test_a_failed_build_leaves_yesterdays_files(tmp_path: Path, monkeypatch):
    assert daily(tmp_path) == 1
    before = [(tmp_path / n).read_bytes() for n in ("overview.html", "report.json")]
    monkeypatch.setattr(overview, "template", lambda: "<html>no slot</html>")

    assert daily(tmp_path, "2026-01-03") == 1
    assert [(tmp_path / n).read_bytes() for n in ("overview.html", "report.json")] == before

    def fails(*_):
        raise RuntimeError("made-up failure")

    monkeypatch.setattr(cli, "build", fails)
    with pytest.raises(RuntimeError):
        daily(tmp_path, "2026-01-03")

    assert [(tmp_path / n).read_bytes() for n in ("overview.html", "report.json")] == before


def test_the_packaged_dashboard_has_one_slot_for_the_report():
    assert PACKAGED().count(overview.SLOT) == 1
