---
name: stareso-app-grill
description: Structured grilling of a stareso-app project in numbered rounds with recommended answers, writing PLAN.md, GLOSSARY.md and decision records. Use only when the user explicitly switches to grilling ("let's grill", "grill me").
---

# stareso-app-grill

Talk in English unless the user switches to French.

## Start
1. Mark the switch clearly: a chapter mark "Grilling" if the tool is available, and a first line **"— Grilling —"**.
2. Set `Phase: grilling` in `docs/PLAN.md`.
3. Read `~/.claude/stareso-app/grilling.md` and follow it exactly. Read `docs/IDEAS.md`, `docs/PLAN.md`, `docs/GLOSSARY.md`. Open guide sections only when a question needs them.
4. Give a one-line overview of the branches you will cover, then the first round.

## Rules
- Rounds, recommended answers, facts versus decisions, writing as you go, ending: as in `grilling.md`.
- If the user goes back to free talk, follow them (that is discussion); return to the rounds when they say so.
- A grilling can span sessions: PLAN.md is updated after each round, so a new session resumes from the files.

## End
When no question is left and the user confirms: `Phase: setup`, summarise the plan in about ten lines, and point to `/stareso-app-setup`.
