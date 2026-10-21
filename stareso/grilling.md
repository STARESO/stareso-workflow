# Grilling rules (shared by stareso-grill, stareso-improve and stareso-retrofit)

Goal: reach a shared, complete understanding of the project (or of one idea) before anything is built. Nothing is silently assumed.

## How to ask
- Treat the topic as a **tree of decisions**: some decisions only make sense once others are settled.
- Ask in **numbered rounds**. A round holds every question whose prerequisites are already answered (usually 3 to 6). A question that depends on another one still open waits for a later round.
- Each question: a short title, the context in one or two lines, the options if useful, and **one recommended answer**, worded so that a plain "yes" accepts it.
- **Ask through the question tool** (`capabilities/questions.md`): each question of the round becomes one tool question with its options as buttons, the recommended one first, the context in the option descriptions. Write at most three lines of chat before the call. Fall back to a numbered message only without a question tool or for free-text answers.
- Start from the pack's defaults (`packs/<pack>/guide.md`): only ask where this project may differ ("Same login model as project A (roles), or one shared code like project B?").
- Answers may be short or spoken ("1 yes, 2 yes, 3 no, rather weekly"). Read voice input for meaning; if an answer is unclear, restate how you understood it in the next round.
- Wait for the answers before the next round. Then work out which questions are now open.

## Facts versus decisions
- **Facts are your job:** if a question can be answered from the guide, `docs/IDEAS.md`, the approved files in `private/sources/readable/`, the structure of the data, or an earlier project, look it up instead of asking. Look-ups must be cheap: read the needed section, not whole folders. Never open `private/sources/locked/`, `private/data/` or `data/raw/`.
- **Decisions are the user's:** always put them as questions.

## Writing as you go
- After each round, write the settled decisions into `docs/PLAN.md` (right section, plain sentences), so nothing is lost if the session stops.
- Each domain term settled: one line in `docs/GLOSSARY.md` (UI word, meaning, code / DB name).
- A decision that is hard to reverse, would surprise a future reader, and came from a real choice between options: offer a decision record in `docs/decisions/NNNN-slug.md` (template `templates/decision.md`). Otherwise no record.
- Ideas from `docs/IDEAS.md` that got decided: switch their mark from 💭 to 🛠 "(PLAN §…)" or to ✖ "(rejected: reason)" (legend at the top of IDEAS.md).

## Branches to cover for a whole project (skip what is clearly settled)
1. Purpose, users, how many, devices or readers, conditions at the place of use.
2. What it replaces (paper, spreadsheet, old tool, previous analysis) and what must not get worse.
3. Screens or outputs, and what is on each, top to bottom.
4. Data: entities, key fields, what is legal or must be kept forever, what may be edited or deleted after the fact; for analyses, the structure of each source (from the `structure` run) and the hypotheses of the protocol.
5. **Access as a table:** for each screen or output, who sees / edits / deletes, per role (admin, member, guest, reader…). Written into PLAN §5 as a table; the access-matrix test and the briefs read it. Skipping this branch caused the costliest reworks so far (project C: sheet visibility, twice).
6. **Modes and states:** training vs evaluation, draft vs closed, demo vs real, data version 1 vs 2; what each role sees in each state; what is locked when.
7. Field or delivery conditions: offline needed? live sync between phones? alerts? For analyses: report readers, formats, deadline, review.
8. Data out: CSV, PDF, spreadsheets, figures, backups.
9. Interface or report language(s) and wording style.
10. Pack, tools and hosting: keep the pack defaults or change (provider, region, domain name, R packages).
11. Privacy: sensitive fields, what must never be stored or printed, real names in figures.
12. Existing data to import, and how (the user runs imports; versions of the raw files).
13. First version versus later: which milestones, in which order.

## Ending
- The grilling ends when no open question is left **and** the user confirms that the plan is complete.
- **Walkthrough before setup:** narrate "a day with it" in three short paragraphs, one per role (or per reader of an analysis), from the PLAN as written; the user corrects; write the corrections into PLAN. This one turn catches wrong mental models before twenty slices are built on them.
- Then set `Phase: setup` in `docs/PLAN.md` and tell the user the next step: `/stareso-setup` (Opus; same session is fine).
- Never build anything during a grilling.
