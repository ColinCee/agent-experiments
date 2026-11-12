# Agent notes

Tests agent rules from session transcripts: counting, then looks and verdicts, then one overview page ([docs/architecture.md](docs/architecture.md)).

Checks: `uv run ruff format --check && uv run ruff check && uv run ty check && uv run pytest`

| Where | What |
|---|---|
| `src/agent_experiments/counting.py`, `sessions.sql` | Transcripts and the measures file into the DuckDB file |
| `src/agent_experiments/stats.py` | Shuffle p and resampled range, with SciPy |
| `src/agent_experiments/looks.py` | Tasks per group, looks, verdicts, settled rules, usual ranges |
| `src/agent_experiments/replay.py` | Past moments answered under old and new rules, through promptfoo |
| `src/agent_experiments/page.py` | The overview page |
| `src/agent_experiments/cli.py` | `agent-experiments daily`, which runs them in order, and `replay` |

- **No private data in this repo.** It is public; transcripts, the measures file and the outputs are the user's own. No home-folder paths, project or host names, measure ids or transcript text in code, tests, docs or commit messages; tests build made-up data. The CI secret scan fails on home-folder paths.
- **A look is never retaken.** `looks` is append-only and keyed by trial, its `started` date, measure and look. Changing how a look is computed applies to looks not yet taken; never delete or rewrite a row to get a different verdict.
- **Change the method only with a check.** A change to the limits, sizes or unit needs the A/A test in `tests/test_stats.py` to still pass a do-nothing rule in under 7% of 300 runs, and the method section of the architecture doc updated in the same change.
