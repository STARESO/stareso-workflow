---
name: stareso-status
description: Where is this stareso project in its workflow and what is the next step (which skill, which model, which session). Use when the user asks for the status, is coming back to the project, or asks what to do next.
---

# stareso-status

**Session:** any model, any session. Cheap: read only these, never the code. Talk in English unless the user switches to French.

1. `docs/PLAN.md`: the `Phase:` and `Pack:` lines.
2. `docs/ROADMAP.md`: the overview table only (done / total per milestone, tested up to, `[human]` waiting). Do not open the milestone files.
3. `docs/QUESTIONS.md`: open questions and `[debt]` lines. `docs/IDEAS.md`: number of 💭 lines. `docs/FEEDBACK.md`: date of the newest block. `docs/BUILD-LOG.md`: last line (date of the last slice, last tidy).
4. `git status` (one line) and the current branch; say if the folder is a worktree.

Answer in at most ten lines:
- the workflow line with the current phase marked, e.g. `init → discuss → grill → setup → [build ⇄ test] → improve → deploy` with **bold** on where the project is (manual: `~/.claude/stareso/README.md`);
- phase, progress, open questions and debt, what is waiting for the user;
- **the one next step**: the skill to run, the **model** (Opus for discuss / grill / setup / improve / deploy / retrofit; Sonnet for build and test), **new or same session**, **permission mode** (auto for build only), and the profile for a build (eco unless speed matters).
If no `docs/PLAN.md` exists: an empty folder is `/stareso-init`; an existing project is `/stareso-retrofit` (both Opus).
