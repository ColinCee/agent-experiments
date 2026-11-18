# Product

<!-- impeccable:product-schema 1 -->

What the dashboard must answer, how it behaves and how it looks. How its data is made: [docs/architecture.md](docs/architecture.md).

## Platform

web

## Users

One person, who runs many agent sessions at once and writes the rules they follow. He rarely browses the page: an agent links him to one result, and he reads it on a phone, a claude.ai page or a desktop.

## Product Purpose

For every rule, answer three questions at a glance, drawn and not written: is it working, how well, how sure. Then let him check that answer without leaving the page.

## Behaviour

Each line has an end-to-end test in `dashboard/e2e`.

| When | Then |
|---|---|
| The page opens | Every running or scheduled experiment and every active rule is one row: name, band, signed change, status icon. Finished experiments are a third group below them. |
| A row shows | Its status is one of the four below, each with its own icon. |
| A row's status is "not enough tasks" | It draws no band and shows a dash, so a running experiment never shows a lead. |
| He points at a row, or moves focus to it | Its card shows beside the table. A click keeps it open; leaving the table returns to the kept one. |
| He opens an agent's link to a rule | That rule's card is open. Below 1100px the card is the whole screen, with a way back. |
| He points at a status pill | Rows of other statuses dim. A click keeps only its rows, and hides the skills. |
| The page opens | Below the rules, each tracked skill is one row, most missed first: name, its rate over 28 days with its range, no status, since a rate alone is no verdict. |
| A skill's card shows | How often it is missed, its rate over time with a dashed line where each version was first loaded, each version's rate (none under 10 tasks), and its latest misses to hand to an agent. |
| Any card shows | Its sections come in one order: verdict, can it be trusted, change in mistakes, mistake rate over time, hand to an agent. A rule with not enough tasks stops after the second. |
| No rule is picked | The card says how the numbers are made and what each mark means. |
| He clicks "Copy for an agent" | The result and the sessions behind its latest misses are copied, worded as a request. |
| A change is larger than the scale | Its band stops at the edge with a mark. |

| Status | An experiment's verdict | An active rule's check |
|---|---|---|
| Works | `works` | `working` |
| Not working | `no useful effect` | `slipping` |
| Can't tell | `can't tell` | |
| Not enough tasks | none, or `no verdict yet` | `waiting`, `nothing` |

## Look

The general rules are the [`designing-interfaces`](https://github.com/ColinCee/agents/blob/main/skills/designing-interfaces/SKILL.md) skill, which holds for every page; this one adds:

- The shadcn components the dashboard has, 13px type.
- A result is a thin band across its 90% range with a small dot at the estimate and a tick at no change, fewer mistakes to the left. The column header is the scale, each number over its place.
- The one number format is the signed change in mistakes, in percent.
- Beside the table the card leaves out the row's number; the band returns only at full width, with its range's own numbers.

## Constraints

- One self-contained file, opened from disk or published as a claude.ai page, with no server. No transcript text on the page.
- Words he uses: "experiment" for a trial, "active rule" for a proven rule.
- Not on the rebuilt page, though the report keeps carrying them: mistake trends, mistakes with no rule yet, replays, rule and skill size. Whether they return behind a link is undecided.

## Checks

Before a dashboard change is shown to him, `agent-experiments daily --agents-repo` is run with the real agents repo on a copy of the real store (`--db` and `--page` on the copy, never the live files, since a look taken there is never retaken), and the page is checked with that data. The dev server is then left open on the change's branch (`dashboard` in `.claude/launch.json`), so he sees the change itself before it merges.
