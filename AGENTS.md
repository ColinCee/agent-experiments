# Agent notes

Tests agent rules from session transcripts: counting, then verdicts, then one overview page ([docs/architecture.md](docs/architecture.md)).

Checks: `uv run ruff format --check && uv run ruff check && uv run ty check && uv run pytest`; in `dashboard/`: `pnpm check && pnpm test && pnpm build && pnpm e2e`

| Where | What |
|---|---|
| `src/agent_experiments/counting.py`, `sessions.sql` | Transcripts and the measures file into the DuckDB file |
| `src/agent_experiments/stats.py` | Shuffle p and resampled range, with SciPy |
| `src/agent_experiments/verdicts.py` | Each trial's before against after on its third day of real use, usual ranges |
| `src/agent_experiments/stops.py` | Needless stops per 100 under each version of the stop rules |
| `src/agent_experiments/replay.py` | Past moments answered again under old and new rules |
| `src/agent_experiments/size.py` | Words of rule and skill files at each commit, from git |
| `src/agent_experiments/overview.py` | The overview page: the report put into the built dashboard |
| `dashboard/` | The React dashboard; `pnpm build` writes `src/agent_experiments/dashboard.html`, committed, and CI fails when it is stale |
| `PRODUCT.md` | What the dashboard must answer, its behaviours and its look; read it before changing `dashboard/` |
| `src/agent_experiments/cli.py` | `agent-experiments daily`, which runs them in order, `replay` and `size` |

- **No private data in this repo.** It is public; transcripts, the measures file and the outputs are the user's own. No home-folder paths, project or host names, measure ids or transcript text in code, tests, docs or commit messages; tests build made-up data. The CI secret scan fails on home-folder paths.
- **A verdict is never retaken.** `verdicts` is append-only and keyed by trial, its `started` date and measure (`looks` keeps the holdout era's). Changing how a verdict is computed applies to verdicts not yet taken; never delete or rewrite a row to get a different one.
- **Change the method only with a check.** A change to the limits, sizes or unit needs the do-nothing test in `tests/test_stats.py` to still call a change that does nothing `works`, and `worse`, each in under 7% of 300 runs, and the method section of the architecture doc updated in the same change.
- **Browser support:** Baseline Widely available; a Newly available feature only as progressive enhancement with a fallback.
- **Web platform work** (HTML, CSS, client-side JS in `dashboard/`): load the `modern-web-guidance` skill first and follow the guides it retrieves.
