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
- Sort each point into `docs/FEEDBACK.md` under "Test yyyy-mm-dd (slices NN–NN)":
  - **bug** → a fix slice appended to the roadmap (milestone "Fixes" or the current one), brief in the usual format;
  - **change** to existing behaviour → a slice, same format; if it changes a decision, note "updates PLAN §…" and update PLAN.md after confirming with the user;
  - **new idea** → a line in `docs/IDEAS.md` starting with 💭 (not a slice) and suggest `/stareso-app-improve` later.
  - **decision to confirm** → a point that contradicts a rule in `CLAUDE.md` or a decision in PLAN.md (who sees what, a protected rule, a decision record): say so at once, quote the rule, log it as "change (decision to confirm)", and append its slice marked "waits on /stareso-app-improve". Do not edit CLAUDE.md or PLAN.md for it during the test.
- Restate each point in one line so the user can correct you.

## 3. End ("end test", "done testing")
1. Summary: bugs, changes, ideas, decisions to confirm, and the new slices created.
2. Add a new marker `<!-- test: yyyy-mm-dd, up to slice NN -->` after the last tested slice. Every doc must agree with the others. Re-read what changed and check, for each decision or term touched: `CLAUDE.md` rules, `docs/PLAN.md`, `docs/GLOSSARY.md`, `docs/decisions/` (a replaced record says so in its status line), the open slice briefs in `docs/ROADMAP.md` (no brief still describes the old behaviour), `docs/HELPER-RULES.md` (copies of CLAUDE.md rules), `docs/IDEAS.md` status marks, `docs/QUESTIONS.md` (answered ones ticked), `docs/FUTURE.md` and `docs/README.md` (list of docs). A quick search for the old wording (e.g. the old rule, the old number, the old UI word) across `docs/` and `CLAUDE.md` finds leftovers. Fix them in the same commit; if two docs disagree and the right version is unclear, ask. Commit docs.
3. **Retro, short:** at most three suggestions to improve the workflow itself (a slice brief that was unclear, a check that would have caught a bug, a guide section to add or fix). For each one the user accepts, edit the relevant file (`~/.claude/stareso-app/guide.md`, a template, or a skill) and add a line to `~/.claude/stareso-app/CHANGELOG.md`.
4. Next step: if any decision to confirm or rule change was logged, `/stareso-app-improve` first (new Opus session) so CLAUDE.md, PLAN.md and the briefs agree before building; otherwise `/stareso-app-build` on the fix slices (same session is fine), and `/stareso-app-improve` later for the ideas.
