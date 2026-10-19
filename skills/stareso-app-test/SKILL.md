---
name: stareso-app-test
description: Test time for a stareso-app project - open the app in the browser pane, list what changed since the last test, collect the user's feedback (text or voice) into FEEDBACK.md and turn it into fix slices or ideas. Use only when the user says "test time" or asks to test.
---

# stareso-app-test

Talk in English unless the user switches to French. Mark the switch: chapter "Test" if available, first line **"— Test time —"**.

## 1. Prepare
1. In `docs/ROADMAP.md`, find the last `<!-- test: … -->` marker: the slices ticked after it are what is new.
2. Never rebuild the dev database during a test with the bare reset: use the project's `dev:rebuild` (guide §10) or replay every import, dev server stopped. Start the dev server with the preview tool (`dev` from `.claude/launch.json`) and open the app in the browser pane. If a login is needed, say where the local test code is (`.env.example` / README), never type a real code yourself unless it is a local test code from the project files.
3. Give the user a short checklist: for each new screen or behaviour, where to go and what should happen (one line each). Mention the size and theme controls (phone width, dark / light) if layout changed.

## 2. Collect feedback
- The user clicks around and talks (text or voice, free form). Read voice input for meaning.
- When they point at something, use the page tools to find the element and reproduce the problem; read console errors. Fix nothing yet, except an obvious one-line fix the user asks for right away.
- **Log only, do not plan yet.** Append each point to `docs/FEEDBACK.md` under "Test yyyy-mm-dd (slices M19.1–M19.4)" as one short line in the user's words, tagged **[bug]**, **[change]**, **[idea]** or **[decision to confirm]** (a point that contradicts a rule in `CLAUDE.md` or a decision in PLAN.md: quote the rule at once). Screenshots: note what they show. Do not write slices, edit the roadmap, PLAN.md or IDEAS.md during the test: the points are only grouped into slices at the end, because related points are better done together and later points often replace earlier ones.
- Restate each point in one line so the user can correct you.

## 3. End ("end test", "done testing")
1. **Segment the log into slices.** Read the whole FEEDBACK block: drop points superseded later in the same test; then group points by screen or component so that points touching the same files become **one** slice (a slice stays small: one screen or component, usually 1 to 5 files; split a bigger group); order slices so that those sharing files run one after the other (the brief says "run after M23.5") and mark `independent: yes` only for slices sharing no file with another pending one. Ask the user **one** question listing every point whose meaning is unclear, each with your recommended reading; do not guess. Then write the slices in the roadmap (milestone "Fixes after the Nth test", usual brief format; a bug slice says how to reproduce), **ideas** as 💭 lines in `docs/IDEAS.md`, and for every **decision to confirm** a slice marked "waits on /stareso-app-improve" (CLAUDE.md and PLAN.md are not edited without the user's confirmation).
2. Summary: bugs, changes, ideas, decisions to confirm, and the slices created (which points each one covers).
3. Add a new marker `<!-- test: yyyy-mm-dd, up to slice M19.3 -->` after the last tested slice. Every doc must agree with the others. Re-read what changed and check, for each decision or term touched: `CLAUDE.md` rules, `docs/PLAN.md`, `docs/GLOSSARY.md`, `docs/decisions/` (a replaced record says so in its status line), the open slice briefs in `docs/ROADMAP.md` (no brief still describes the old behaviour), `docs/HELPER-RULES.md` (copies of CLAUDE.md rules), `docs/IDEAS.md` status marks, `docs/QUESTIONS.md` (answered ones ticked), `docs/FUTURE.md` and `docs/README.md` (list of docs). A quick search for the old wording (e.g. the old rule, the old number, the old UI word) across `docs/` and `CLAUDE.md` finds leftovers. Fix them in the same commit; if two docs disagree and the right version is unclear, ask. Commit docs.
4. **Retro, short:** at most three suggestions to improve the workflow itself (a slice brief that was unclear, a check that would have caught a bug, a guide section to add or fix). For each one the user accepts, edit the relevant file (`~/.claude/stareso-app/guide.md`, a template, or a skill) and add a line to `~/.claude/stareso-app/CHANGELOG.md`.
5. Next step: if any decision to confirm or rule change was logged, `/stareso-app-improve` first (new Opus session) so CLAUDE.md, PLAN.md and the briefs agree before building; otherwise `/stareso-app-build` on the fix slices (same session is fine), and `/stareso-app-improve` later for the ideas. When there is no decision to confirm, offer to build the new fix milestone straight away (`/stareso-app-build <milestone>`, defaults), and to reopen test mode after it.
