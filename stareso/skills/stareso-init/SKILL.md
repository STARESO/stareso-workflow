---
name: stareso-init
description: Start a new STARESO project (web app, data analysis or game) in the current folder - creates the private-safe folder structure from the chosen pack, moves any existing files to private/sources/locked without reading them, sets up git. First step of the stareso workflow.
---

# stareso-init

**Session:** strong tier · new session in the empty project folder · normal mode. If this session runs another model, say so in one line first (the user switches in the harness's model picker).

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (USAGE "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

Talk to the user in English unless they ask for French. Shared material: `<stareso>/` (`README.md` = the manual, `templates/`, `packs/<pack>/`). Keep this step cheap: no exploring, no reading of user files.

## 1. Check the folder and choose the pack
- Run `ls -A` (names only). If it already looks like a project (`package.json`, `src/`, `R/`, `project.godot`, `.git` with commits, `docs/PLAN.md`), stop: this is `/stareso-retrofit` (existing project) or `/stareso-status` (already a stareso project), not init.
- Name: from the argument, or ask for a short working name.
- Pack: from the argument, or ask in one question: **`app-next`** (small team web app: Next.js, Postgres/Supabase, Vercel) or **`analysis-r`** (data analysis in R, figures, HTML report) or **`godot-game`** (2D game in Godot 4 for PC and tablets). Other kinds of work: say that no pack exists yet and that the pack is written from the first project of its kind (`<stareso>/README.md` "Packs").

## 2. Protect before anything else
1. <!-- harness:read-guard-install -->Read guard: make the harness deny reading `private/sources/locked/`, `private/data/`, `private/backups/` and `.env*` (for `analysis-r` also `data/raw/` and `data/processed/`); a harness without a guard keeps only the `AGENTS.md` rule. Copy <!-- /harness -->`packs/<pack>/templates/gitignore` to `.gitignore`, `templates/gitattributes` to `.gitattributes`, `templates/editorconfig` to `.editorconfig` (for `godot-game` append `packs/godot-game/templates/gitattributes-extra` to `.gitattributes`).
2. If files are present: create `private/sources/locked/` and **move** every existing file and folder into it with `mv`, keeping names and sub-folders. Do **not** open, read, preview or grep them. Say that you see the file names only.

## 3. Create the structure
Core (every pack): `AGENTS.md` (pack template, name filled in, rest left for setup) · `docs/PLAN.md` (template, `Phase: discussion`, `Pack: <pack>`) · `docs/IDEAS.md` · `docs/GLOSSARY.md` · `docs/decisions/` · `docs/README.md` (template `README-docs.md`) · `private/sources/locked/`, `private/sources/readable/`, `private/sources/INDEX.md`, `private/data/`, `private/backups/`.
Pack `app-next`: the browser's launch file (port 3100 unless another app uses it).
Pack `analysis-r`: `config/paths.yml`, `main/run_all.R`, `R/helpers.R`, `.lintr` (pack templates), `data/raw/`, `data/processed/`, `outputs/`, `dev/`, `tests/toy/`, `report/`, `docs/LOGBOOK.md` (template).
Pack `godot-game`: the folders of guide §3, `tools/` from `packs/godot-game/templates/tools/` (the gate and the off-screen wrappers), `docs/PLAYTEST.md` (pack template), and the Godot console binary path in `AGENTS.md` (ask for it, and for the Godot version and renderer, in one question). The project itself (`project.godot`, `screenshot.gd`, the test runner) is built by the M0 scaffold slices, which end with `verify-offscreen` passing.
ROADMAP, QUESTIONS, FEEDBACK and BUILD-LOG are created by setup. Doc files are named in capitals; decision records `NNNN-slug.md`.
**Canary:** create `private/backups/CANARY` (one word), read it with the file-reading tool and expect a refusal. Under `Pack:` in `docs/PLAN.md` write `Guard: verified (<harness>, yyyy-mm-dd)`, or `Guard: not enforced (<harness>, yyyy-mm-dd)` and tell the user.

## 4. Git
`git init -b main`, `git status` to check that nothing under `private/` or `data/` is listed, first commit "Initial structure". Never add a remote, never push.

## 5. Sort the existing files (if any)
Show the names and ask, per file or group (question tool): **readable** (the assistant may read it), **locked** (never read: the default), or **structure** (a dataset: columns, types, counts only). Move readable → `private/sources/readable/`, structure → `private/data/` (`data/raw/` for an analysis), locked stays. Fill `private/sources/INDEX.md` (one line per file; a few words from the user, or "?").

## 6. Keep the context small
Two lines: only the connectors this project needs stay on (in the connector settings); no extra memory files or plugins: the project files are the memory.

## 7. Next steps (print this)
```
init ──▶ discuss ──▶ grill ──▶ setup ──▶ build ◀──▶ test ──▶ deploy / deliver
                                           ▲          │
                                           └ improve ◀┘      status: any time
```
Manual and skills: `<stareso>/README.md` (the `stareso-workflow` repository).
1. Put reference material in `private/sources/locked/` any time (forms, screenshots, exports, notes, data files). Tell me when you add something; I'll ask before reading it.
2. `/stareso-discuss` (strong tier, this session or a new one): talk freely (keyboard or voice). Nothing is decided yet.
3. "let's grill" (strong tier): the structured rounds. Ends with a walkthrough you correct.
4. `/stareso-setup` (strong tier): AGENTS.md and the roadmap of small slices.
5. New session, **standard tier, auto mode**, in this folder without a worktree: `/stareso-build M1` (eco profile by default; `fast` when you need it this afternoon).
6. New session, standard tier: `/stareso-test`. New ideas: `/stareso-improve` (strong tier). Lost: `/stareso-status` (any model).
7. Ready to go online or to deliver: `/stareso-deploy` (strong tier).
