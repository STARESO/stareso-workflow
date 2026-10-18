# Grilling rules (shared by stareso-app-grill and stareso-app-improve)

Goal: reach a shared, complete understanding of the app (or of one idea) before anything is built. Nothing is silently assumed.

## How to ask
- Treat the topic as a **tree of decisions**: some decisions only make sense once others are settled.
- Ask in **numbered rounds**. A round holds every question whose prerequisites are already answered (usually 3 to 6). A question that depends on another one still open waits for a later round.
- Each question: a short title, the context in one or two lines, the options if useful, and **one recommended answer**, worded so that a plain "yes" accepts it.
- Start from the guide's defaults (`guide.md`): only ask where this app may differ ("Same login model as SecuSurf (roles), or one shared code like BaieWatch?").
- Answers may be short or spoken ("1 yes, 2 yes, 3 no, rather weekly"). Read voice input for meaning; if an answer is unclear, restate how you understood it in the next round.
- Wait for the answers before the next round. Then work out which questions are now open.

## Facts versus decisions
- **Facts are your job:** if a question can be answered from the guide, `docs/IDEAS.md`, the approved files in `private/sources/readable/`, or an earlier app, look it up instead of asking. Look-ups must be cheap: read the needed section, not whole folders. Never open `private/sources/locked/` or `private/data/`.
- **Decisions are the user's:** always put them as questions.

## Writing as you go
- After each round, write the settled decisions into `docs/PLAN.md` (right section, plain sentences), so nothing is lost if the session stops.
- Each domain term settled: one line in `docs/GLOSSARY.md` (UI word, meaning, code / DB name).
- A decision that is hard to reverse, would surprise a future reader, and came from a real choice between options: offer a decision record in `docs/decisions/NNNN-slug.md` (template `templates/decision.md`). Otherwise no record.
- Ideas from `docs/IDEAS.md` that got decided: switch their mark from 💭 to 🛠 "(PLAN §…)" or to ✖ "(rejected: reason)" (legend at the top of IDEAS.md).

## Branches to cover for a whole app (skip what is clearly settled)
1. Purpose, users, how many, devices, signal at the place of use.
2. What it replaces (paper, spreadsheet, old tool) and what must not get worse.
3. Screens / tabs, and what is on each, top to bottom.
4. Data: entities, key fields, what is legal or must be kept forever, what may be edited or deleted after the fact.
5. Access: one shared code, roles, guests; who may delete what.
6. Field conditions: offline needed? live sync between phones? alerts?
7. Data out: CSV, PDF, spreadsheets, backups.
8. Interface language(s) and wording style.
9. Stack and hosting: keep the defaults or change (provider, region, domain name).
10. Privacy: sensitive fields, what must never be stored.
11. Existing data to import, and how (the user runs imports).
12. First version versus later: which milestones, in which order.

## Ending
- The grilling ends when no open question is left **and** the user confirms that the plan is complete. Then: set `Phase: setup` in `docs/PLAN.md` and tell the user the next step (`/stareso-app-setup`).
- Never build anything during a grilling.
