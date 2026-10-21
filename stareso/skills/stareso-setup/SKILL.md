---
name: stareso-setup
description: After the grilling of a stareso project - write the short AGENTS.md (rules, Commands table) and the roadmap of small self-contained vertical slices grouped in milestones, one file per milestone. Use when the user asks for the setup step or accepts the end of a grilling.
---

# stareso-setup

**Session:** strong tier · same session as the grilling or a new one · normal mode. If this session runs another model, say so first: the quality of the briefs decides how well the cheap models build.

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (USAGE "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

Talk in English unless the user switches to French.

## 1. Read
`docs/PLAN.md` (`Pack:` line first), `docs/GLOSSARY.md`, `docs/decisions/`, then the pack guide `<stareso>/packs/<pack>/guide.md`: the sections on structure, commands, verification and the default roadmap (app-next: §2, §3, §18–20; analysis-r: §3, §9–12; godot-game: §3, §4, §10, §15–17); others only when a slice needs them. If PLAN.md has gaps that block the roadmap, list them and ask (grilling style). If the walkthrough of `grilling.md` was not done, do it now.

## 2. AGENTS.md
Fill `<stareso>/packs/<pack>/templates/CLAUDE.md`: short, rules plus pointers, the **Commands table** (names `check`, `test`, `dev`/`run`, `rebuild`/`step`, `build`/`render`, `structure`: the skills and helpers only ever use these names), approved dependencies, differences from the pack decided in PLAN §10. Do not copy the plan into it.

## 3. Roadmap
- `docs/ROADMAP.md` from `templates/ROADMAP.md` (numbering rules, slice format, the overview markers).
- One file per milestone `docs/roadmap/M1.md`, `M2.md`… from `templates/roadmap-milestone.md` (`Kind:` line: feature | fixes | tidy | security | release; a title that says what the user gets), starting from the pack's default milestones adapted to the plan. `H.md` (Kind: human) for slices waiting on human input, `P.md` (Kind: after-delivery) for after the first delivery; `Q.md` (Kind: queue) only when the plan foresees `night` builds (a creative queue of small slices, at least five); no other lettered milestones.
- **Milestones** each end with something worth testing (a screen that works, a figure family, a report section, a playable build of the game).
- **Slices** small enough for a standard-tier model from the brief alone: at most one table, one route and one screen change (app) or one step, one module and one figure family (analysis) or one scene, its script and one data file (game, plus the zone scene and the translation keys); usually 1 to 5 files. Game briefs name their `kind:` (system, content, tune, spike, art, facts: guide §10) in the title line. Split anything bigger.
- Each brief is **self-contained**: goal, files, 2 to 5 steps, "done when", guide sections. No "as discussed": write the fact.
- **Module ownership:** Files names the module to extend or create (one feature = one module); two open slices never both edit the same file unless one says `after:` the other.
- `after: M3.1` when a slice needs another merged first (shared file or data). No `independent:` flag: independence is derived from `after:` and Files.
- `tier: light` for trivial slices (copy, config, a token); `standard` by default; `strong` only with a real risk written in the brief (security, legal records, migrations on real data, a statistical method); such slices also get `check: now`.
- Slices that need the user (secrets, accounts, online database, a real data file, a library not yet approved) are marked **[human]**, with what the user must do.
- Every milestone ends with its **tidy slice** (`M<n>.tidy`, from the template).
- Also create `docs/QUESTIONS.md` (template, then one `(grilling)` line per "(open: …)" point of PLAN, each with the slices it blocks), `docs/FEEDBACK.md`, `docs/BUILD-LOG.md`, `docs/USAGE.md` from the templates, (godot-game) `docs/PLAYTEST.md` if init did not create it, and (app-next) the access-matrix test skeleton named in the Commands table if the pack guide asks for it.
- Run `node <stareso>/tools/roadmap-overview.mjs` to fill the overview table, then `node <stareso>/tools/docs-check.mjs`.

## 4. Review with the user
Show the overview table and the slice titles only (not the briefs) and ask for changes. When accepted: `Phase: build` in PLAN.md, commit ("Plan, roadmap and AGENTS.md"), and tell the user:
> Next: open a **new session** in this folder (no worktree), choose **standard tier**, permission mode **auto**, and run `/stareso-build M1` (eco profile; add `fast` for parallel helpers).
