---
name: stareso-app-setup
description: After the grilling of a stareso-app project - write the short CLAUDE.md and the roadmap of small self-contained vertical slices grouped in milestones. Use when the user asks for the setup step or accepts the end of a grilling.
---

# stareso-app-setup

Talk in English unless the user switches to French. Run this on the strongest model available: the quality of the slice briefs decides how well smaller models build.

## 1. Read
`docs/PLAN.md`, `docs/GLOSSARY.md`, `docs/decisions/`, then `~/.claude/stareso-app/guide.md` sections 2, 3, 17, 18 (others only when a slice needs them). If PLAN.md has gaps that block the roadmap, list them and ask (grilling style: numbered, with recommended answers).

## 2. CLAUDE.md
Fill `CLAUDE.md` from `~/.claude/stareso-app/templates/CLAUDE.md`: short, rules plus pointers. Do not copy the plan into it. Fill the approved dependencies and any stack difference from PLAN §9.

## 3. Roadmap
Write `docs/ROADMAP.md` from `templates/ROADMAP.md`, starting from guide §18 and adapted to the plan:
- **Milestones** that each end with something worth testing in the browser.
- **Slices** small enough for a Sonnet-class model working from the brief alone: at most one table, one route and one screen change; usually 1 to 5 files. Split anything bigger.
- Each brief is **self-contained**: goal, files, 2 to 5 steps, "done when", guide sections to read. No reference to "the discussion" or "as agreed": write the actual fact.
- `model: haiku` only for trivial slices (copy, config, a token); otherwise `sonnet`.
- `independent: yes` only when the slice touches no file another pending slice touches (needed for parallel builds).
- Slices that need the user (secrets, accounts, online database, a library not yet approved) are marked **[human]**, with what the user must do.
- Also create `docs/QUESTIONS.md`, `docs/FEEDBACK.md`, `docs/BUILD-LOG.md` from the templates.

## 4. Review with the user
Show the milestones and slice titles only (not the full briefs) and ask for changes. When accepted: `Phase: build` in PLAN.md, commit ("Plan, roadmap and CLAUDE.md"), and tell the user:
> Next: open a **new session** in this folder, choose **Sonnet**, permission mode **auto**, and run `/stareso-app-build M1` (or a slice range).
