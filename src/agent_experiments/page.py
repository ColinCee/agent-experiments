"""The overview page: one HTML file with charts drawn as static SVG, no script (docs/architecture.md#overview-page)."""

import html
import math
from datetime import date
from pathlib import Path

# Charts take their colours from these properties, so the page's own light and dark themes repaint them. Series
# colours are the dataviz reference palette's slots 1 and 2, each mode's own validated step.
STYLE = """
:root { color-scheme: light; --bg: #f9f9f7; --card: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --line: #e1e0d9; --good: #006300; --warn: #b54708; --s1: #2a78d6; --s2: #eb6834; }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; --bg: #0d0d0d; --card: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --line: #2c2c2a;
    --good: #0ca30c; --warn: #ec835a; --s1: #3987e5; --s2: #d95926; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 960px; margin: 0 auto; padding: 16px; }
h1 { font-size: 1.4rem; margin: 0 0 2px; } h2 { font-size: 1.1rem; margin: 28px 0 8px; }
.sub, .note { color: var(--ink-2); margin: 4px 0; } .note { font-size: .85rem; }
.health { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-top: 16px; }
.tile, .card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
.tile b { display: block; font-size: 1.6rem; } .tile span { color: var(--ink-2); font-size: .85rem; }
.card { margin-bottom: 8px; min-width: 0; } .card h3 { margin: 0; font-size: 1rem; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 8px; margin-top: 8px; }
.facts { display: flex; flex-wrap: wrap; gap: 4px 16px; color: var(--ink-2); font-size: .9rem; margin: 4px 0; }
.status { font-weight: 600; color: var(--ink); } .status.works { color: var(--good); }
details { margin-top: 8px; } summary { cursor: pointer; color: var(--ink-2); }
table { border-collapse: collapse; width: 100%; font-size: .85rem; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--line); }
.flagged { color: var(--warn); font-weight: 600; }
.wide { overflow-x: auto; }
.key { display: flex; gap: 16px; font-size: .85rem; color: var(--ink-2); margin-top: 6px; }
.key i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
svg.chart { display: block; width: 100%; max-width: 420px; height: auto; margin-top: 4px; overflow: visible; }
svg.chart text { fill: var(--ink-2); font-size: 11px; font-variant-numeric: tabular-nums; }
.grid { stroke: var(--line); } .mark { stroke: var(--muted); stroke-dasharray: 3 3; }
.s1, .s2 { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.s1 { stroke: var(--s1); } .s2 { stroke: var(--s2); } .dot { fill: var(--s1); stroke: var(--card); stroke-width: 2; }
.range { stroke: var(--s1); stroke-width: 8; stroke-linecap: round; opacity: .45; }
"""

W, H, LEFT, TOP, BOTTOM = 300, 110, 34, 14, 18  # chart size in px at 1:1, and room for the axis labels


def _pct(x: float | None) -> str:
    return "n/a" if x is None or not math.isfinite(x) else f"{round(100 * x)}%"


def plural(n: int, word: str) -> str:
    return word if n == 1 else word + "s"


def _short(day: str) -> str:
    d = date.fromisoformat(day)
    return f"{d.day} {d:%b}"


def _key(*series: tuple[str, str]) -> str:
    return (
        "<div class='key'>"
        + "".join(f"<span><i style='background:var(--{c})'></i>{n}</span>" for c, n in series)
        + "</div>"
    )


def _line_chart(
    series: list[tuple[str, list[tuple[str, float | None]]]],
    marks: list[tuple[str, str, str]],
    percent: bool = True,
) -> str:
    """Lines over days on one y-axis from 0, with a dashed vertical line and short label at each mark (day, label,
    hover text). Each series is (class, points); a None point breaks its line."""
    days = sorted({d for _, points in series for d, _ in points})
    if not days:
        return ""
    first, span = date.fromisoformat(days[0]), max(1, (date.fromisoformat(days[-1]) - date.fromisoformat(days[0])).days)
    top = max([v for _, ps in series for _, v in ps if v is not None] + [0.1 if percent else 1])
    step = 10 ** math.floor(math.log10(top))
    top = math.ceil(top / step) * step

    def x(day: str) -> float:
        return LEFT + (W - LEFT - 4) * (date.fromisoformat(day) - first).days / span

    def y(v: float) -> float:
        return TOP + (H - TOP - BOTTOM) * (1 - v / top)

    out = [f"<svg class='chart' viewBox='0 0 {W} {H}' role='img'>"]
    for v in (0, top / 2, top):
        label = _pct(v) if percent else f"{v:,.0f}"
        out.append(f"<line class='grid' x1='{LEFT}' x2='{W}' y1='{y(v):.1f}' y2='{y(v):.1f}'/>")
        out.append(f"<text x='{LEFT - 4}' y='{y(v) + 4:.1f}' text-anchor='end'>{label}</text>")
    for day, anchor in dict(((days[0], "start"), (days[-1], "end"))).items():
        out.append(f"<text x='{x(day):.1f}' y='{H - 4}' text-anchor='{anchor}'>{_short(day)}</text>")
    for day, label, hover in marks:
        if days[0] <= day <= days[-1]:
            out.append(
                f"<g><title>{html.escape(hover)}</title><line class='mark' x1='{x(day):.1f}' x2='{x(day):.1f}' "
                f"y1='{TOP - 2}' y2='{H - BOTTOM}'/><text x='{x(day):.1f}' y='{TOP - 4}' text-anchor='middle'>"
                f"{html.escape(label)}</text></g>"
            )
    for cls, points in series:
        runs: list[list[str]] = [[]]
        for d, v in points:
            if v is None:
                runs.append([])
            else:
                runs[-1].append(f"{x(d):.1f},{y(v):.1f}")
        # A lone point is drawn as a zero-length line, which its round cap shows as a dot.
        out += [f"<polyline class='{cls}' points='{' '.join(r * 2 if len(r) == 1 else r)}'/>" for r in runs if r]
    return "".join(out) + "</svg>"


def _drop_chart(effect) -> str:
    """The drop as a dot inside its 90% range, against no change and the smallest useful drop."""

    def x(v: float) -> float:
        return 16 + (W - 32) * (max(-1.0, min(1.0, v)) + 1) / 2

    out = [f"<svg class='chart' viewBox='0 0 {W} 56' role='img'>"]
    for v, label, cls, anchor in ((0, "no change ", "grid", "end"), (0.3, " useful", "mark", "start")):
        out.append(f"<line class='{cls}' x1='{x(v):.1f}' x2='{x(v):.1f}' y1='12' y2='38'/>")
        out.append(f"<text x='{x(v):.1f}' y='9' text-anchor='{anchor}'>{label}</text>")
    for v in (-1, -0.5, 0.5, 1):
        out.append(f"<text x='{x(v):.1f}' y='52' text-anchor='middle'>{_pct(v)}</text>")
    out.append(f"<line class='range' x1='{x(effect.low):.1f}' x2='{x(effect.high):.1f}' y1='25' y2='25'/>")
    out.append(f"<circle class='dot' cx='{x(effect.drop):.1f}' cy='25' r='6'/>")
    return "".join(out) + "</svg>"


def _tile(value: str, label: str) -> str:
    return f'<div class="tile"><b>{html.escape(value)}</b><span>{html.escape(label)}</span></div>'


def _measure(r: dict, day: str) -> str:
    e = html.escape
    f = r["flag"]
    parts = [f"<div class='card'><h3>{e(r['name'])}</h3>"]
    if f and f["flagged"]:
        parts.append(
            f"<p class='note flagged'>Out of its usual range on {_short(day)}: {100 * f['rate']:.1f}%, usual "
            f"{100 * f['low']:.1f}% to {100 * f['high']:.1f}%</p>"
        )
    marks = [(d, "", f"{_short(d)}: {w}") for d, w in r["changes"]]
    parts.append(_line_chart([("s1", r["line"])], marks))
    if r["latest"]:
        (b, bn, since), (a, an, _) = r["before"], r["after"]
        d, what = r["latest"]
        earlier = [_short(c) for c in dict.fromkeys(c for c, _ in r["changes"] if c < d)]
        also = f" Earlier changes shown: {', '.join(earlier)}." if earlier else ""
        parts.append(
            f"<p class='note'>Changed {_short(d)}: {e(what)}. Missed {_pct(b)} before (from {_short(since)}, "
            f"{bn} {plural(bn, 'task')}), {_pct(a)} after ({an} {plural(an, 'task')}).{also}</p>"
        )
    else:
        parts.append("<p class='note'>No rule change recorded.</p>")
    return "".join(parts) + "</div>"


def _replays(rows: list[dict]) -> str:
    e = html.escape
    parts = [f"<h2>Replays</h2><details><summary>{len(rows)} {plural(len(rows), 'replay')}</summary>"]
    if rows:
        parts.append(
            "<div class='wide'><table><tr><th>Measure</th><th>Day</th><th>Moments</th><th>Missed, old rules</th>"
            "<th>New rules</th><th>Drop (90% range)</th><th>Real against replay</th><th>Verdict</th></tr>"
        )
        for r in rows:
            parts.append(
                f"<tr><td>{e(r['name'])}</td><td>{_short(r['day'])}</td><td>{r['paired']} of {r['moments']}</td>"
                f"<td>{_pct(r['rate_old'])}</td><td>{_pct(r['rate_new'])}</td>"
                f"<td>{_pct(r['drop'])} ({_pct(r['low'])} to {_pct(r['high'])})</td>"
                f"<td>{_pct(r['real_rate'])} against {_pct(r['replay_rate'])}, {e(r['in_force'])} rules</td>"
                f"<td>{e(r['verdict'])}</td></tr>"
            )
        parts.append(
            "</table></div><p class='note'>Moments: compared, of those replayed. Real against replay: how often the "
            "real agents and the replay missed, under the rules those sessions had.</p>"
        )
    return "".join(parts) + "</details>"


def _sizes(s: dict) -> str:
    e = html.escape
    parts = ["<h2>Rule and skill size</h2><details><summary>"]
    if not s["words"]:
        return parts[0] + "Not measured: run with --agents-repo.</summary></details>"
    now: dict[str, int] = {}
    for _, pattern, words in s["words"]:
        now[pattern] = words
    parts.append(", ".join(f"{e(p)}: {w:,} words" for p, w in now.items()) + "</summary>")
    classes = dict(zip(now, ("s1", "s2"), strict=False))
    parts.append(_key(*((c, e(p)) for p, c in classes.items())))
    parts.append(
        _line_chart(
            [(c, [(d, w) for d, p, w in s["words"] if p == pattern]) for pattern, c in classes.items()], [], False
        )
    )
    parts.append("<div class='wide'><table><tr><th>Largest files now</th><th>Words</th></tr>")
    parts += [f"<tr><td>{e(f)}</td><td>{w:,}</td></tr>" for f, w in s["largest"]]
    parts.append(
        "</table></div><div class='wide'><table><tr><th>Month</th><th>Files</th><th>Changes</th>"
        "<th>Only added lines</th><th>Lines added, of all changed</th></tr>"
    )
    parts += [
        f"<tr><td>{m}</td><td>{e(p)}</td><td>{n}</td><td>{_pct(only)}</td><td>{_pct(share)}</td></tr>"
        for m, p, n, only, share in s["months"]
    ]
    parts.append(
        "</table></div><p class='note'>A change is one file in one commit that added or deleted a line; a move "
        "alone is not one. Only added lines: no line deleted, new files included. Lines added, of all changed: "
        "added / (added + deleted).</p></details>"
    )
    return "".join(parts)


def render(report: dict) -> str:
    """The page for one day's report, as cli.py builds it."""
    e = html.escape
    h = report["health"]
    parts = [
        f"<h1>Rule trials</h1><p class='sub'>As of {_short(report['day'])}, from session transcripts.</p>",
        '<section class="health">',
        _tile(str(h["running"]), f"{plural(h['running'], 'trial')} running"),
        _tile(str(h["verdicts"]), f"{plural(h['verdicts'], 'verdict')} in the last 7 days"),
        _tile(f"{h['stamped']} of {h['sessions']}", f"sessions with a group on {_short(report['day'])}"),
        _tile(str(h["off_course"]), f"settled {plural(h['off_course'], 'rule')} no longer helping"),
        "</section><h2>Trials</h2>",
    ]
    if not report["trials"]:
        parts.append("<p class='note'>No trials running.</p>")
    for t in report["trials"]:
        when = (
            f"starts {_short(t['started'])}"
            if t["day_n"] < 1
            else f"day {t['day_n']} of 7"
            if t["day_n"] <= 7
            else "week over"
        )
        needed = (
            f"a halving shows at about {t['needed']} tasks per group"
            if t["needed"]
            else "over 320 tasks per group to see a halving, or too little history to say"
        )
        measure = "" if t["measure"] == t["trial"] else f"<span>measure: {e(t['name'])}</span>"
        status_class = "status works" if t["status"] == "works" else "status"
        parts.append(
            f"<article class='card'><h3>{e(t['title'])}</h3>"
            f"<div class='facts'>{measure}<span>{when}</span>"
            f"<span>{t['tasks_off']} {plural(t['tasks_off'], 'task')} without, {t['tasks_on']} with</span>"
            f"<span class='{status_class}'>{e(t['status'])}</span></div>"
            f"<p class='note'>Tasks needed: {needed}; a week brings about {t['per_week']} per group.</p>"
        )
        if t["effect"] and math.isfinite(t["effect"].low):
            ef = t["effect"]
            parts.append(
                f"<p class='note'>Missed {_pct(ef.off)} without the rule and {_pct(ef.on)} with: a drop of "
                f"{_pct(ef.drop)}, 90% range {_pct(ef.low)} to {_pct(ef.high)}.</p>"
            )
            parts.append(_drop_chart(ef))
        else:
            parts.append("<p class='note'>No drop to show yet: each group needs at least two tasks.</p>")
        parts.append("<details><summary>Since the start, and looks taken</summary>")
        if any(v is not None for points in t["trend"].values() for _, v in points):
            marks = [(lk.day, str(lk.look), f"Look {lk.look}: {lk.verdict}") for lk in t["looks"]]
            parts.append(_key(("s1", "Without the rule"), ("s2", "With the rule")))
            parts.append(_line_chart([("s1", t["trend"]["off"]), ("s2", t["trend"]["on"])], marks))
            parts.append("<p class='note'>Share of chances missed over 3 days; numbered lines are looks.</p>")
        if t["looks"]:
            parts.append(
                "<div class='wide'><table><tr><th>Look</th><th>Day</th><th>Tasks without / with</th>"
                "<th>Drop (90% range)</th><th>p</th><th>Verdict</th></tr>"
            )
            for lk in t["looks"]:
                parts.append(
                    f"<tr><td>{lk.look}</td><td>{_short(lk.day)}</td><td>{lk.tasks_off} / {lk.tasks_on}</td>"
                    f"<td>{_pct(lk.drop)} ({_pct(lk.low)} to {_pct(lk.high)})</td>"
                    f"<td>{lk.p:.4f}</td><td>{e(lk.verdict)}</td></tr>"
                )
            parts.append("</table></div>")
        else:
            parts.append("<p class='note'>No looks taken yet: the first comes at 10 tasks in the smaller group.</p>")
        parts.append("</details></article>")
    for s in report["settled"]:
        ef = s["effect"]
        said = f"a drop of {_pct(ef.drop)}, 90% range {_pct(ef.low)} to {_pct(ef.high)}" if ef else "no comparison yet"
        parts.append(
            f"<p class='note'>Settled {e(s['title'])} ({e(s['name'])}) on {e(s['model'] or 'no model')}: {said}; "
            f"{s['tasks_off']} holdout {plural(s['tasks_off'], 'task')}, {s['tasks_on']} with the rule.</p>"
        )
    rows = report["measures"]
    flagged = sum(r["flagged"] for r in rows)
    parts.append(
        f"<h2>Tracked measures</h2><details><summary>{len(rows)} measures, {flagged} out of their usual range on "
        f"{_short(report['day'])}</summary>"
        "<p class='note'>Share of chances missed over 3 days, for 6 weeks; a dashed line is a rule change (hover for "
        "what). Before and after the latest change is a before-and-after comparison, not a test: anything else that "
        "changed then moves it too.</p><div class='cards'>"
    )
    parts += [_measure(r, report["day"]) for r in rows]
    parts.append("</div></details>")
    parts.append(_replays(report["replays"]))
    parts.append(_sizes(report["sizes"]))
    body = "\n".join(parts)
    return (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'><title>Rule trials</title>"
        f"<style>{STYLE}</style></head><body><main>{body}</main></body></html>"
    )


def write(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render(report), encoding="utf-8")
