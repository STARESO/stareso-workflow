---
name: stareso-app-improve
description: Turn new ideas of a stareso-app project into decisions and roadmap slices - short discussion and grilling on one idea, then update PLAN.md and the roadmap. Use when the user wants to add or change a feature after the first plan.
---

# stareso-app-improve

Talk in English unless the user switches to French. Best run on the strongest model, in a fresh session.

## 1. Pick the idea
Read `docs/IDEAS.md` (open items only: 💭, and 🛠 when the user asks about planned work), `docs/PLAN.md`, and the roadmap headings. If the user brings a new idea, add it to IDEAS.md first. Ask which idea (or group of linked ideas) to work on now.

## 2. Discuss, then grill (scoped to that idea)
- Short free discussion: what it is for, who uses it, what it changes. Play back what you understood.
- Then grilling on that idea only, following `~/.claude/stareso-app/grilling.md` (rounds, recommended answers, facts are yours). Usually one to three rounds. Include: what it changes in existing screens and data, migration of existing data, and where it fits in the order of milestones.

## 3. Write
1. `docs/PLAN.md`: update the sections concerned (the plan stays the single source of truth).
2. `docs/GLOSSARY.md` and a decision record if the grilling rules call for one.
3. `docs/ROADMAP.md`: new slices in the usual self-contained format (see `stareso-app-setup` step 3 for the slice rules), placed in an existing or a new milestone. Data changes on an app already online: the slice writes a numbered migration in `db/migrations/` and is marked **[human]** for running it online.
4. `docs/IDEAS.md`: change the idea's status mark: 💭 → 🛠 with "(PLAN §…, slices NN–NN)", or → ✖ with "(rejected: reason)". If the file has no status legend yet, add it (template `~/.claude/stareso-app/templates/IDEAS.md`) and tag every line.
5. **Coherence check (before committing):** every doc must agree with the others. Re-read what changed and check, for each decision or term touched: `CLAUDE.md` rules, `docs/PLAN.md`, `docs/GLOSSARY.md`, `docs/decisions/` (a replaced record says so in its status line), the open slice briefs in `docs/ROADMAP.md` (no brief still describes the old behaviour), `docs/HELPER-RULES.md` (copies of CLAUDE.md rules), `docs/IDEAS.md` status marks, `docs/QUESTIONS.md` (answered ones ticked), `docs/FUTURE.md` and `docs/README.md` (list of docs). A quick search for the old wording (e.g. the old rule, the old number, the old UI word) across `docs/` and `CLAUDE.md` finds leftovers. Fix them in the same commit; if two docs disagree and the right version is unclear, ask.
6. Commit docs. Next: `/stareso-app-build` on the new slices (new session, Sonnet, auto mode).
