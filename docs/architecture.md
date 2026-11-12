# Architecture

How a rule trial goes from session transcripts to a verdict on one page.

![Trial files and a hook give each task a group; counting reads transcripts and the private measures file into one DuckDB file; looks and verdicts read it, append looks, and write the overview page](architecture.svg)

Everything dashed in the picture is the user's own data and stays under `~/.claude/keep-going/` or `~/.claude/projects/`, never in this repository.

## Hook

A trial is a file in the agents repo's `home/trials/` (format: that repo's `docs/keep-going.md`); an optional `name:` line is what the page calls it (else the name of a measure it shares its file name with), and a file with no `started:` date is reported and skipped. Its hook, at each session and subagent start, puts the rule's `On` or `Off` wording in the session's context and writes one line that lands in the transcript as a `hook_additional_context` attachment:

```
Rule trials: <trial>=on|off ... holdout=yes|no task=<8 hex> rules=<7 hex>
```

The group comes from a hash of the trial's name and the task, so a task keeps its group across restarts and two trials split tasks independently. A `settled` trial is on for every task except the holdout tenth.

## Counting

`counting.py` runs [`sessions.sql`](../src/agent_experiments/sessions.sql) over every transcript, then the measures file, and replaces three tables in the DuckDB file:

| Table | One row per |
|---|---|
| `sessions` | session and day: project, entrypoint, model, effort, replies, typed messages, tokens, root session, stamps |
| `stamps` | stamp the hook gave a session, with its time |
| `chances` | moment a rule could be broken (`measure, session, day, ts, uuid, miss`), as the measures file defines them |

A continued session copies its parent's entries under its own id; each entry counts once, for the session that started first, which is the continuation's root. A measures file is SQL that creates a temp table `chances` from the temp tables `texts`, `calls` and `typed`; `sessions.sql` names their columns. It may also create `measure_names(measure, name)`, and the page then shows those names in place of measure ids. A full rebuild takes about 8 s on 2 GB of transcripts.

`looks` and `replays` are never rebuilt: a look is written once, and a replay's row changes only when that replay is rerun.

## Looks

[`looks.py`](../src/agent_experiments/looks.py) turns chances into tasks per group, then into looks.

- **Unit.** A task is the stamp's `task=` token, else the root session. A session counts for a trial only when every stamp it and its root got agrees on its group, and only its chances after the first stamp that named the trial, so a trial added mid-task does not claim earlier replies. Sessions nobody typed in (scheduled runs, scripted calls) are left out; sessions with no stamp are left out and counted on the page.
- **When.** A trial is looked at when its smaller group reaches 10, 20 and 40 tasks, and a last time 7 days after `started`, whatever its size. A look is due only past every look already taken under that trial name and `started` date, so a restarted trial starts again; none follows `works` or the last look.
- **Verdict.** An early look says `works` or `no verdict yet`. The last says `works`, `no useful effect` (the 90% range of the drop rules out a 30% drop) or `can't tell`. Fewer than 5 tasks in a group is always `can't tell`.
- **Settled rules.** Holdout tasks against the rest over the last 28 days, on the model with the most replies in the last 7, so a model that no longer needs a rule shows. It is no longer helping when its range rules out a 30% drop.
- **Usual range.** For each measure, the latest day's miss rate against the middle 98% of rates from the same number of tasks drawn from the 28 days before.

## Replays

[`replay.py`](../src/agent_experiments/replay.py) tests a rule's wording in hours: a model writes the agent's next message at past moments under the old rules file and under the new, and the misses are compared.

- **Moments.** A measure's stored chances in sessions someone typed in. Sessions are taken in random order, each one's first chance and then others, at most 3 per session. The conversation before a moment becomes text: what the user typed, what the agent wrote, each tool call and how its result began, the last 24,000 characters.
- **Replies.** promptfoo's Claude Agent SDK provider, on the user's Claude subscription: the rules file inside a short frame is the whole system prompt, with no tools, settings, MCP servers or saved session, and one turn. Claude Code still adds the user's email and the folder, platform and date. npx fetches the pinned promptfoo, Agent SDK and Node, so a machine needs Node with npm and a signed-in Claude Code. Picks and replies are saved in the output folder as they come, so a rerun continues, `--rescore` makes no model calls, and running out of quota stops the run with what it wrote kept.
- **Scoring.** Each reply goes through the measures file as the one text of a session of its own, with nothing called or typed, so one definition of a measure counts both real sessions and replays. Only measures on reply text can be replayed.
- **Check.** Under the rules the sessions really had (`--in-force`), the replay must miss within 1.5 times the real rate or within 5 points of it; otherwise the verdict is `replay can't test this`. On the user's first replay, 198 moments, the real agents missed 30% and the replay 10%.
- **Verdict.** Moments where both replies had a chance, compared by session (Method): `works` at one-sided p < 0.05 with fewer misses under the new rules, `no useful effect` when the 90% range rules out a 30% drop, else `can't tell`. One row per output folder goes in `replays`.

## Rule and skill size

[`size.py`](../src/agent_experiments/size.py) shows whether agents only append to rules and skills. From the agents repo's `git log --numstat -M` and each file's text at each commit, it fills `sizes`: one row per file a commit changed, with its words after the commit and the lines added and deleted. A file renamed away or deleted drops to 0 words. `daily --agents-repo` refreshes it for `home/*.md`, the every-turn rules, and `skills/*/SKILL.md`. The every-turn files held 559 words in the repo's first commit on 14 October 2026 and 1,917 on 12 November; 22% of their changes in that time deleted no line.

## Method

[`stats.py`](../src/agent_experiments/stats.py) uses SciPy for both tests.

- **Why tasks.** Misses clump within a task: one agent that ignores a rule ignores it all session. Counting chances as independent would make every trial look sure. So tasks are shuffled between groups and resampled whole, and the rate is a ratio of sums (all misses over all chances in a group), which weights a task by its chances. Counting misses over chances found a real halving 3 to 5 times as often as counting tasks with any miss.
- **p.** `scipy.stats.permutation_test` over task indices, one-sided: the rule's group misses less. Real looks use 99,999 shuffles, since the first limit needs steps of p well below 0.0003.
- **Range.** `scipy.stats.bootstrap`, percentile, 90%: the drop `1 - on/off`, resampling tasks within each group. A resample with no misses without the rule has no drop and is left out.
- **Replays.** The same moments answered under the old and the new wording: shuffles swap the two answers within a session, and the bootstrap draws whole sessions.
- **Limits.** One-sided O'Brien-Fleming-style limits for the three looks: p < 0.0003, 0.0071 and 0.0225. An independent check on these sessions found p < 0.02 at each look passed a do-nothing rule about 6% of the time, and these limits 3.6%; on made-up tasks they passed 3.0% in 1,000 runs. `tests/test_stats.py` fails if that rises past 7% in 300.
- **Power.** For each running trial the page shows the tasks per group at which one look at 0.0225 finds a true halving 80% of the time, simulated from that measure's own tasks over the last 28 days (tasks drawn with replacement, the rule's group's misses thinned by half), next to how many tasks a week brings. Sizes tried are 10 to 320, doubling. On the user's sessions up to 11 November 2026, it said 20 for the commonest miss, 40 for two measures, 80 for two and 160 or 320 for four (one more had too little history), while a week brings 5 to 19 tasks per group. So a week often cannot decide, and a trial that can't tell gets a commoner measure or a bolder change, not a longer run.

## Overview page

[`page.py`](../src/agent_experiments/page.py) writes one HTML file with plotly.js inlined once, so it works offline. On top, four numbers: trials running, verdicts in the last 7 days, sessions with a group on the day reported, settled rules no longer helping. Then a row per trial: its day, tasks per group, status, tasks needed, and the drop with its 90% range against a "no change" line. Folded below: each trial's daily miss rates and looks taken, and the tracked measures, last 7 days against the 21 before, flagged ones first; the replays; and rule and skill size: each pattern's words over time, the largest files now, and per month the share of changes that deleted no line (new files included) and the share of changed lines that were added. A trial that fails is left off, and `daily` prints why and exits 1 after writing the page.
