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

Each line is one end-to-end test in `dashboard/e2e`.

| When | Then |
|---|---|
| The page opens | Every running experiment and active rule is one row: name, band, signed change, status icon. Finished experiments are a third group below them. |
| A row has a result | Its status is one of four, taken from the method's verdict: works, not working, can't tell, not enough tasks. |
| A row has no answer yet | It draws no band and shows a dash. |
| He points at a row, or moves focus to it | Its card shows beside the table. A click keeps it open; leaving the table returns to the kept one. |
| He opens an agent's link to a rule | That rule's card is open. On a phone the card is the whole screen, with a way back. |
| He points at a status pill | Rows of other statuses dim. A click keeps only its rows. |
| Any card shows | Its sections come in one order: verdict, can it be trusted, change in mistakes, chances missed over time, look into it. A rule with no answer stops after the second. |
| No rule is picked | The card says how the numbers are made and what each mark means. |
| He clicks "Copy for an agent" | The result and the sessions behind its latest misses are copied, worded as a request. |
| A change is larger than the scale | Its band stops at the edge with a mark. |

## Look

- Minimal and technical, on the shadcn components the dashboard has: neutral colours, hairlines, 13px type, monospace numbers. Colour only for a result.
- A result is a thin band across its 90% range with a small dot at the estimate and a tick at no change, fewer mistakes to the left. The column header is the scale, each number over its place.
- One number format: the signed change in mistakes, in percent.
- Words only for names and verdicts. What a mark means is said once, never under each chart.
- The card never repeats what its row shows.
- No dot or other mark as a separator between two facts: each fact gets its own labelled place.
- Every chart has labelled axes with units.
- Every change of state moves, briefly and slightly; nothing moves for people who ask for reduced motion.
- The table and the card start at the same top edge.

## Constraints

- One self-contained file, opened from disk or published as a claude.ai page, with no server. No transcript text on the page.
- Words he uses: "experiment" for a trial, "active rule" for a proven rule.
- Off the page, undecided between a link and removal: mistake trends, mistakes with no rule yet, replays, rule and skill size.
- The report does not yet carry: history and miss rates for active rules, the tasks an active rule needs, the sessions behind a rule's misses.

## Checks

Before a dashboard change is shown to him, `agent-experiments daily` is run on the real store and the real agents repo, and the page is checked with that data.
