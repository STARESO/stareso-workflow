---
name: stareso-app-status
description: Where is this stareso-app project in its workflow and what is the next step. Use when the user asks for the status, is coming back to the project, or asks what to do next.
---

# stareso-app-status

Cheap: read only these, never the code. Talk in English unless the user switches to French.

1. `docs/PLAN.md`: the `Phase:` line.
2. `docs/ROADMAP.md`: slices done / total per milestone, the last test marker, `[human]` slices waiting.
3. `docs/QUESTIONS.md`: open questions. `docs/IDEAS.md`: number of open ideas. `docs/FEEDBACK.md`: last test date.
4. `git status` (one line) and the current branch.

Answer in at most eight lines: phase, progress, what is waiting for the user, and **the one next step** (the skill to run, in which kind of session: Opus for discuss / grill / setup / improve, Sonnet + auto mode for build and test). If no `docs/PLAN.md` exists: this folder is not a stareso-app project yet → `/stareso-app-init`.
