# Product

<!-- impeccable:product-schema 1 -->

What the dashboard must answer, how it behaves and how it looks. How its data is made: [docs/architecture.md](docs/architecture.md).

## Platform

web

## Users

One person, who runs many agent sessions at once and writes the rules they follow. He rarely browses the page: an agent links him to one result, and he reads it on a phone, a claude.ai page or a desktop.

## Product Purpose

Did this week's rule changes work, and is any rule or skill in force slipping or unused? For every rule change being tested, at a glance: how often agents made its mistake before and since, and its verdict, or when the verdict is due. For every rule and skill in force: only those that need him. Let him check each answer without leaving the page.

## Behaviour

Each line has an end-to-end test in `dashboard/e2e`.

| When | Then |
|---|---|
| The page opens | Every rule change still awaiting a verdict, or judged in the last 7 days, is one row in Testing or Decided this week: the change in a few words (its mistake when nothing words it), its mistake rate before and after, and the days left or the verdict. |
| The page opens | Below them, the rules and skills slipping (a mistake above its usual range today, in red) or unused for 30 days. Then all rules and skills in one closed list, grouped into every-turn rules, rule changes' wording and skills, each with what its mistakes did since its rule's latest change: fewer, more, no clear change, too few tasks, or no change dated. That is not a verdict: it moves every day. |
| He opens an agent's link to a rule or skill in the closed list | The list opens, with its card. |
| A row shows | Its status is one of the four below, each with its own icon. |
| A row has no verdict yet | Rate after shows the rate so far; Days left shows the days until its verdict if each day from here has use, or before it starts, the days until it does. Testing is sorted soonest first. |
| He points at a row, or moves focus to it | Its card shows beside the table. A click keeps it open; leaving the table returns to the kept one. |
| He opens an agent's link to a rule | That rule's card is open. Below 1100px the card is the whole screen, with a way back. |
| A rule or skill's card shows | Its use over the last 30 days, then each mistake that counts it: its rate over 28 days, today against its usual range, and its last 6 weeks with each rule change and model switch marked. |
| A rule change's card shows | In one order: the change's wording and verdict; mistake rate before and since, a dot each on one axis of the share of chances broken, with its range; change in mistakes (once judged); what it rests on (days of real use, tasks each side, the replay for a rare mistake); hand to an agent. |
| No rule is picked | The card says how the numbers are made and what each mark means. |
| He clicks "Copy for an agent" | The result and the sessions behind its latest misses are copied, worded as a request. |
| A change is larger than the card's scale | Its band stops at the edge with a mark. |

| Status | Verdict |
|---|---|
| Works | `works` |
| Worse | `worse` |
| No big effect | `no big effect` |
| Verdict due | none yet |

## Look

The general rules are the [`designing-interfaces`](https://github.com/ColinCee/agents/blob/main/skills/designing-interfaces/SKILL.md) skill, which holds for every page; this one adds:

- The shadcn components the dashboard has, 13px type.
- A rate is a whole percent of chances broken; a change, in the card only, is signed. The card draws a result as a thin band across its 90% range with a dot at the estimate and a tick at no change, fewer mistakes to the left, with its range's own numbers.

## Constraints

- One self-contained file, opened from disk or published as a claude.ai page, with no server. No transcript text on the page.
- Words he uses: "rule change" for a trial, "real use" for a day he typed to an agent.
- Not on the page, though the report keeps carrying them: replays, rule and skill size.

## Checks

Before a dashboard change is shown to him, `agent-experiments daily --agents-repo` is run with the real agents repo on a copy of the real store (`--db` and `--page` on the copy, never the live files, since a verdict taken there is never retaken), and the page is checked with that data. The dev server is then left open on the change's branch (`dashboard` in `.claude/launch.json`), so he sees the change itself before it merges.
