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

Each line has an end-to-end test in `dashboard/e2e`, except "Copy for an agent", which waits on the report (Constraints).

| When | Then |
|---|---|
| The page opens | Every running or scheduled experiment and every active rule is one row: name, band, signed change, status icon. Finished experiments are a third group below them. |
| A row shows | Its status is one of the four below, each with its own icon. |
| A row's status is "not enough tasks" | It draws no band and shows a dash, so a running experiment never shows a lead. |
| He points at a row, or moves focus to it | Its card shows beside the table. A click keeps it open; leaving the table returns to the kept one. |
| He opens an agent's link to a rule | That rule's card is open. Below 1100px the card is the whole screen, with a way back. |
| He points at a status pill | Rows of other statuses dim. A click keeps only its rows. |
| Any card shows | Its sections come in one order: verdict, can it be trusted, change in mistakes, mistake rate over time, hand to an agent. A rule with not enough tasks stops after the second. |
| No rule is picked | The card says how the numbers are made and what each mark means. |
| He clicks "Copy for an agent" (waits on the report) | The result and the sessions behind its latest misses are copied, worded as a request. |
| A change is larger than the scale | Its band stops at the edge with a mark. |

| Status | An experiment's verdict | An active rule's check |
|---|---|---|
| Works | `works` | `working` |
| Not working | `no useful effect` | `slipping` |
| Can't tell | `can't tell` | |
| Not enough tasks | none, or `no verdict yet` | `waiting`, `nothing` |

## Look

- Minimal and technical, on the shadcn components the dashboard has: neutral colours, hairlines, 13px type, monospace numbers. Colour only for a result.
- A result is a thin band across its 90% range with a small dot at the estimate and a tick at no change, fewer mistakes to the left. The column header is the scale, each number over its place.
- One number format: the signed change in mistakes, in percent.
- Words only for names and verdicts. What a mark means is said once, never under each chart.
- The card adds to its row and never restates it: beside the table it leaves out the row's number, and the band returns only at full width with its range's own numbers.
- No dot or other mark as a separator between two facts: each fact gets its own labelled place.
- Every chart has labelled axes with units.
- Every change of state moves, briefly and slightly; nothing moves for people who ask for reduced motion.
- The table and the card start at the same top edge.

## Constraints

- One self-contained file, opened from disk or published as a claude.ai page, with no server. No transcript text on the page.
- Words he uses: "experiment" for a trial, "active rule" for a proven rule.
- Not on the rebuilt page, though the report keeps carrying them: mistake trends, mistakes with no rule yet, replays, rule and skill size. Whether they return behind a link is undecided.
- The report must gain three things the card needs. Until it does, an active rule's card has no chart and holds it to the fewest tasks a side can be judged on, and no card has "Copy for an agent": history and miss rates for active rules, the tasks an active rule needs, and the sessions behind a rule's misses.

## Checks

Before a dashboard change is shown to him, `agent-experiments daily --agents-repo` is run on the real store and the real agents repo, and the page is checked with that data. The dev server is then left open on the change's branch (`dashboard` in `.claude/launch.json`), so he sees the change itself before it merges.
