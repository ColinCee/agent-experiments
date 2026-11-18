# Product

<!-- impeccable:product-schema 1 -->

Who the dashboard is for and what it must show first. How the data is made: [docs/architecture.md](docs/architecture.md).

## Platform

web

## Users

One person, who runs many agent sessions at once and writes the rules they follow. He does not browse the page: an agent links him to it, often to one result, and he reads it on whatever he has open, a phone or a claude.ai page as often as a desktop.

## Product Purpose

Show which rule experiments are running and which rules are active, so he can trust or question what an agent told him in a few seconds.

## Operating Context

- The page is one self-contained file, opened from disk or published as a claude.ai page, with no server.
- Agents read the same report and link to the page from replies and messages.

## Capabilities and Constraints

- First: running experiments, and active rules with whether each still works.
- Out of the way: experiments that failed or are no longer running, on another screen.
- Not on the main screens: mistake trends, mistakes with no rule yet, replays, rule and skill size.
- Words he uses: "experiment" for a trial, "active rule" for a proven rule.
- Undecided: whether the content left off the main screens stays behind a link or is removed.

## Brand Commitments

- Look: modern, minimal and technical, built from the shadcn components the dashboard already has. Clean layout, small type, hairlines; no themed or decorative styles.
- A result is drawn as a thin band across its range with a small dot at the estimate, fewer mistakes to the left of a no-change tick.

- Layout: one table of every rule with the picked rule in a card beside it, top edges level. The card never repeats what its row shows.
- No dot or other mark as a separator between two facts: each fact gets its own labelled place.

## Product Principles

- A link from an agent lands on the one thing it is about, readable on a phone.
- One screen answers one question.
- Every experiment and rule answers three questions at a glance, drawn, not written: is it working, how well, how sure.
- One picture per row, the same kind for every row; words only for names.
- What is finished or failed never competes with what is running.
