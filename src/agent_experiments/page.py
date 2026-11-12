"""The overview page: one self-contained HTML file, readable offline (docs/architecture.md#overview-page)."""

import html
import math
from datetime import date
from pathlib import Path

import plotly.graph_objects as go
import plotly.io as pio

# Reference palette from the dataviz method: categorical slots 1 and 2, light and dark steps.
OFF, ON = "#2a78d6", "#eb6834"
MUTED = "#898781"

STYLE = """
:root { color-scheme: light; --bg: #f9f9f7; --card: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --line: #e1e0d9; --good: #006300; --warn: #b54708; }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; --bg: #0d0d0d; --card: #1a1a19; --ink: #f0efec; --ink-2: #c3c2b7; --line: #2c2c2a;
    --good: #0ca30c; --warn: #ec835a; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 960px; margin: 0 auto; padding: 16px; }
h1 { font-size: 1.4rem; margin: 0 0 2px; } h2 { font-size: 1.1rem; margin: 28px 0 8px; }
.sub, .note { color: var(--ink-2); margin: 0; } .note { font-size: .85rem; }
.health { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-top: 16px; }
.tile, .trial { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
.tile b { display: block; font-size: 1.6rem; } .tile span { color: var(--ink-2); font-size: .85rem; }
.trial { margin-bottom: 8px; } .trial h3 { margin: 0; font-size: 1rem; }
.facts { display: flex; flex-wrap: wrap; gap: 4px 16px; color: var(--ink-2); font-size: .9rem; margin: 4px 0; }
.status { font-weight: 600; color: var(--ink); } .status.works { color: var(--good); }
details { margin-top: 8px; } summary { cursor: pointer; color: var(--ink-2); }
table { border-collapse: collapse; width: 100%; font-size: .85rem; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--line); }
.flagged { color: var(--warn); font-weight: 600; }
.wide { overflow-x: auto; }
"""

# Plotly draws its own colours, so the page swaps them when the reader's system is dark.
SCRIPT = """
const dark = matchMedia('(prefers-color-scheme: dark)');
function theme() {
  const ink = dark.matches ? '#c3c2b7' : '#52514e', grid = dark.matches ? '#2c2c2a' : '#e1e0d9';
  for (const el of document.querySelectorAll('.js-plotly-plot'))
    Plotly.relayout(el, {'font.color': ink, 'xaxis.gridcolor': grid, 'yaxis.gridcolor': grid});
}
dark.addEventListener('change', theme);
addEventListener('load', theme);
for (const d of document.querySelectorAll('details'))
  d.addEventListener('toggle', () => d.querySelectorAll('.js-plotly-plot').forEach(el => Plotly.Plots.resize(el)));
"""


def _pct(x: float | None) -> str:
    return "n/a" if x is None or not math.isfinite(x) else f"{round(100 * x)}%"


def _short(day: str) -> str:
    d = date.fromisoformat(day)
    return f"{d.day} {d:%b}"


class _Figures:
    """Renders figures in order, with plotly.js inlined once, in the first."""

    def __init__(self) -> None:
        self.first = True

    def __call__(self, fig: go.Figure, height: int, top: int = 8) -> str:
        fig.update_layout(
            height=height,
            margin={"l": 8, "r": 8, "t": top, "b": 8},
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font={"family": "system-ui, sans-serif", "size": 12, "color": "#52514e"},
            hoverlabel={"font": {"family": "system-ui, sans-serif"}},
        )
        fig.update_xaxes(gridcolor="#e1e0d9", zeroline=False, automargin=True)
        fig.update_yaxes(gridcolor="#e1e0d9", zeroline=False, automargin=True)
        out = pio.to_html(
            fig, full_html=False, include_plotlyjs=self.first, config={"displayModeBar": False, "responsive": True}
        )
        self.first = False
        return out


def _drop_chart(effect, figure: _Figures) -> str:
    """The drop as a dot inside its 90% range, against no change and the smallest useful drop."""
    low, high = (max(-1.0, v) * 100 for v in (effect.low, effect.high))
    drop = max(-1.0, effect.drop) * 100
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=[low, high], y=[0, 0], mode="lines", line={"color": OFF, "width": 8}, hoverinfo="skip"))
    fig.add_trace(
        go.Scatter(
            x=[drop],
            y=[0],
            mode="markers",
            marker={"size": 12, "color": OFF, "line": {"color": "#fcfcfb", "width": 2}},
            hovertemplate=f"Drop {drop:.0f}%<br>90% range {low:.0f}% to {high:.0f}%<extra></extra>",
        )
    )
    for x, label in ((0, "no change"), (30, "useful")):
        fig.add_vline(x=x, line={"color": MUTED, "width": 1, "dash": "dot" if x else "solid"})
        fig.add_annotation(x=x, y=1, yref="paper", text=label, showarrow=False, yanchor="bottom", font={"size": 11})
    fig.update_layout(showlegend=False)
    fig.update_xaxes(range=[-100, 100], ticksuffix="%", title={"text": "Drop in misses", "font": {"size": 11}})
    fig.update_yaxes(visible=False, range=[-1, 1])
    return figure(fig, 130, top=28)


def _trend_chart(trend: dict[str, list[tuple[str, float]]], figure: _Figures) -> str:
    fig = go.Figure()
    for group, colour, name in (("off", OFF, "Without the rule"), ("on", ON, "With the rule")):
        points = trend.get(group, [])
        fig.add_trace(
            go.Scatter(
                x=[d for d, _ in points],
                y=[100 * r for _, r in points],
                name=name,
                mode="lines+markers",
                line={"color": colour, "width": 2},
                marker={"size": 8},
                hovertemplate="%{x}: %{y:.0f}% missed<extra>" + name + "</extra>",
            )
        )
    fig.update_layout(legend={"orientation": "h", "y": 1.15, "x": 0}, hovermode="x unified")
    fig.update_yaxes(ticksuffix="%", rangemode="tozero", title={"text": "Missed", "font": {"size": 11}})
    return figure(fig, 220)


def _measures_chart(rows: list[dict], figure: _Figures) -> str:
    names = [r["measure"] for r in rows][::-1]
    fig = go.Figure()
    for key, colour, name in (("before", MUTED, "21 days before"), ("recent", OFF, "Last 7 days")):
        fig.add_trace(
            go.Scatter(
                x=[100 * r[key] if r[key] is not None else None for r in rows][::-1],
                y=names,
                name=name,
                mode="markers",
                marker={"size": 10, "color": colour},
                hovertemplate="%{y}: %{x:.0f}% missed<extra>" + name + "</extra>",
            )
        )
    fig.update_layout(legend={"orientation": "h", "y": 1.02, "yanchor": "bottom", "x": 0})
    fig.update_xaxes(ticksuffix="%", range=[-3, 105], title={"text": "Share of chances missed", "font": {"size": 11}})
    return figure(fig, 120 + 28 * len(rows))


def _tile(value: str, label: str) -> str:
    return f'<div class="tile"><b>{html.escape(value)}</b><span>{html.escape(label)}</span></div>'


def render(report: dict) -> str:
    """The page for one day's report, as cli.py builds it."""
    figure = _Figures()
    e = html.escape
    h = report["health"]
    parts = [
        f"<h1>Rule trials</h1><p class='sub'>As of {_short(report['day'])}, from session transcripts.</p>",
        '<section class="health">',
        _tile(str(h["running"]), "trials running"),
        _tile(str(h["verdicts"]), "verdicts in the last 7 days"),
        _tile(f"{h['stamped']} of {h['sessions']}", "sessions with a group yesterday"),
        _tile(str(h["off_course"]), "settled rules off course"),
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
        measure = "" if t["measure"] == t["trial"] else f"<span>measure {e(t['measure'])}</span>"
        status_class = "status works" if t["status"] == "works" else "status"
        parts.append(
            f"<article class='trial'><h3>{e(t['trial'])}</h3>"
            f"<div class='facts'>{measure}<span>{when}</span>"
            f"<span>{t['tasks_off']} tasks without, {t['tasks_on']} with</span>"
            f"<span class='{status_class}'>{e(t['status'])}</span></div>"
            f"<p class='note'>Tasks needed: {needed}; a week brings about {t['per_week']} per group.</p>"
        )
        if t["effect"] and math.isfinite(t["effect"].low):
            ef = t["effect"]
            parts.append(
                f"<p class='note'>Missed {_pct(ef.off)} without the rule and {_pct(ef.on)} with: a drop of "
                f"{_pct(ef.drop)}, 90% range {_pct(ef.low)} to {_pct(ef.high)}.</p>"
            )
            parts.append(_drop_chart(ef, figure))
        else:
            parts.append("<p class='note'>No drop to show yet: each group needs at least two tasks.</p>")
        parts.append("<details><summary>Daily trend and looks taken</summary>")
        if any(t["trend"].values()):
            parts.append(_trend_chart(t["trend"], figure))
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
            f"<p class='note'>Settled {e(s['trial'])} ({e(s['measure'])}) on {e(s['model'] or 'no model')}: {said}; "
            f"{s['tasks_off']} holdout tasks, {s['tasks_on']} with the rule.</p>"
        )
    rows = report["measures"]
    flagged = sum(r["flagged"] for r in rows)
    parts.append(
        f"<h2>Tracked measures</h2><details><summary>{len(rows)} measures, {flagged} out of their usual range on "
        f"{_short(report['day'])}</summary>"
    )
    if rows:
        parts.append(_measures_chart(rows, figure))
        parts.append(
            "<div class='wide'><table><tr><th>Measure</th><th>Missed, last 7 days</th><th>21 days before</th>"
            "<th>Latest day</th></tr>"
        )
        for r in rows:
            f = r["flag"]
            day = (
                "too little history"
                if f is None
                else f"<span class='flagged'>out of range: {_pct(f['rate'])}, usual {_pct(f['low'])} to {_pct(f['high'])}</span>"
                if f["flagged"]
                else f"{_pct(f['rate'])}, usual"
            )
            parts.append(
                f"<tr><td>{e(r['measure'])}</td><td>{_pct(r['recent'])} of {r['recent_n']}</td>"
                f"<td>{_pct(r['before'])} of {r['before_n']}</td><td>{day}</td></tr>"
            )
        parts.append("</table></div><p class='note'>Each cell: share of chances missed, of how many chances.</p>")
    parts.append("</details>")
    body = "\n".join(parts)
    return (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'><title>Rule trials</title>"
        f"<style>{STYLE}</style></head><body><main>{body}</main><script>{SCRIPT}</script></body></html>"
    )


def write(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render(report), encoding="utf-8")
