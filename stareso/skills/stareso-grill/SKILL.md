---
name: stareso-grill
description: Structured grilling of a stareso project in numbered rounds with recommended answers, writing PLAN.md, GLOSSARY.md and decision records, ending with a narrated walkthrough. Use only when the user explicitly switches to grilling ("let's grill", "grill me").
---

# stareso-grill

**Session:** strong tier · same session as the discussion or a new one · normal mode. If this session runs another model, say so in one line first (decisions deserve the strongest model).

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (USAGE "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

Talk in English unless the user switches to French.

## Start
1. Mark the switch: a chapter mark "Grilling" if the tool is available, and a first line **"— Grilling —"**.
2. Set `Phase: grilling` in `docs/PLAN.md`.
3. Read `<stareso>/grilling.md` and follow it exactly. Read `docs/IDEAS.md`, `docs/PLAN.md`, `docs/GLOSSARY.md`. Open pack guide sections (`<stareso>/packs/<pack>/guide.md`) only when a question needs them.
4. Give a one-line overview of the branches you will cover, then the first round.

## Rules
- Rounds, recommended answers, facts versus decisions, writing as you go, the access table (branch 5), modes and states (branch 6), the walkthrough and the ending: as in `grilling.md`.
- If the user goes back to free talk, follow them (that is discussion); return to the rounds when they say so.
- A grilling can span sessions: PLAN.md is updated after each round, so a new session resumes from the files.

## End
When no question is left, after the walkthrough, and when the user confirms: `Phase: setup`, summarise the plan in about ten lines, and point to `/stareso-setup` (strong tier; same session is fine). A point the user could not settle ("ask the manager", "depends on the data") is not a blocker: write it in PLAN as "(open: …)" so setup turns it into a `(grilling)` line of `docs/QUESTIONS.md` and a `[human]` or waiting slice.
