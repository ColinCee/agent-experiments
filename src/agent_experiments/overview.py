"""The overview page: `daily`'s report as `report.json`, and put into the built dashboard as `overview.html`
(docs/architecture.md#overview-page)."""

import json
import math
import os
import tempfile
from importlib.resources import files
from pathlib import Path

import numpy as np

# Matched with the tag's end, so the placeholder written anywhere else in the bundle's script is left alone.
SLOT = ">__REPORT__</script>"


def template() -> str:
    return files(__package__).joinpath("dashboard.html").read_text(encoding="utf-8")


def plain(x):
    """The report as plain JSON values: NumPy numbers become Python ones, and NaN or infinity null."""
    if isinstance(x, dict):
        return {k: plain(v) for k, v in x.items()}
    if isinstance(x, list | tuple):
        return [plain(v) for v in x]
    if isinstance(x, np.bool_):
        return bool(x)
    if isinstance(x, np.integer):
        return int(x)
    if isinstance(x, float | np.floating):
        return float(x) if math.isfinite(x) else None
    return x


def write(page: Path, report: dict, html: str | None = None) -> Path:
    """Writes `report.json` beside `page`, then `page`, each whole and only once both are ready, so a failure leaves
    the last ones. Returns the report's path."""
    text = json.dumps(plain(report), ensure_ascii=False, allow_nan=False, indent=1)
    html = template() if html is None else html
    if html.count(SLOT) != 1:
        raise ValueError(f"The dashboard template needs exactly one {SLOT!r}; found {html.count(SLOT)}.")
    # Inside a script tag, `</` could close it and `<!--` could keep it from closing; both are valid JSON escaped.
    inline = text.replace("</", "<\\/").replace("<!--", "<\\u0021--")
    data = page.with_name("report.json")
    page.parent.mkdir(parents=True, exist_ok=True)
    temps: list[Path] = []
    try:
        temps.append(_temp(data, text))
        temps.append(_temp(page, html.replace(SLOT, ">" + inline + "</script>")))
        for temp, final in zip(temps, (data, page), strict=True):
            os.replace(temp, final)
    finally:
        for temp in temps:
            temp.unlink(missing_ok=True)
    return data


def _temp(final: Path, text: str) -> Path:
    fd, name = tempfile.mkstemp(dir=final.parent, prefix=f".{final.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
            f.write(text)
    except BaseException:
        Path(name).unlink(missing_ok=True)
        raise
    return Path(name)
