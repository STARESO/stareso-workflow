---
name: stareso-init
description: Start a new STARESO project (web app or data analysis) in the current folder - creates the private-safe folder structure from the chosen pack, moves any existing files to private/sources/locked without reading them, sets up git. First step of the stareso workflow.
disable-model-invocation: true
argument-hint: "<name> [app-next | analysis-r]"
---

# stareso-init

**Session:** Opus · new session in the empty project folder · normal mode. If this session runs another model, say so in one line first (the user switches in the app's model menu or with `/model`).

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (USAGE "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

Talk to the user in English unless they ask for French. Shared material: `~/.claude/stareso/` (`README.md` = the manual, `templates/`, `packs/<pack>/`). Keep this step cheap: no exploring, no reading of user files.

## 1. Check the folder and choose the pack
- Run `ls -A` (names only). If it already looks like a project (`package.json`, `src/`, `R/`, `.git` with commits, `docs/PLAN.md`), stop: this is `/stareso-retrofit` (existing project) or `/stareso-status` (already a stareso project), not init.
- Name: from the argument, or ask for a short working name.
- Pack: from the argument, or ask in one question: **`app-next`** (small team web app: Next.js, Postgres/Supabase, Vercel) or **`analysis-r`** (data analysis in R, figures, HTML report). Other kinds of work: say that no pack exists yet and that the pack is written from the first project of its kind (`~/.claude/stareso/README.md` "Packs").

## 2. Protect before anything else
1. Copy `templates/settings.json` to `.claude/settings.json` (for `analysis-r` add `Read(./data/raw/**)` and `Read(./data/processed/**)` to the deny list), `packs/<pack>/templates/gitignore` to `.gitignore`, `templates/gitattributes` to `.gitattributes`, `templates/editorconfig` to `.editorconfig`.
2. If files are present: create `private/sources/locked/` and **move** every existing file and folder into it with `mv`, keeping names and sub-folders. Do **not** open, read, preview or grep them. Say that you see the file names only.

## 3. Create the structure
Core (every pack): `CLAUDE.md` (pack template, name filled in, rest left for setup) · `docs/PLAN.md` (template, `Phase: discussion`, `Pack: <pack>`) · `docs/IDEAS.md` · `docs/GLOSSARY.md` · `docs/decisions/` · `docs/README.md` (template `README-docs.md`) · `private/sources/locked/`, `private/sources/readable/`, `private/sources/INDEX.md`, `private/data/`, `private/backups/`.
Pack `app-next`: `.claude/launch.json` (port 3100 unless another app uses it).
Pack `analysis-r`: `config/paths.yml`, `main/run_all.R`, `R/helpers.R`, `.lintr` (pack templates), `data/raw/`, `data/processed/`, `outputs/`, `dev/`, `tests/toy/`, `report/`, `docs/LOGBOOK.md` (template).
ROADMAP, QUESTIONS, FEEDBACK and BUILD-LOG are created by setup. Doc files are named in capitals; decision records `NNNN-slug.md`.

## 4. Git
`git init -b main`, `git status` to check that nothing under `private/` or `data/` is listed, first commit "Initial structure". Never add a remote, never push.

## 5. Sort the existing files (if any)
Show the names and ask, per file or group (question tool): **readable** (Claude may read it), **locked** (never read: the default), or **structure** (a dataset: columns, types, counts only). Move readable → `private/sources/readable/`, structure → `private/data/` (`data/raw/` for an analysis), locked stays. Fill `private/sources/INDEX.md` (one line per file; a few words from the user, or "?").

## 6. Keep the context small
Two lines: only the connectors this project needs stay on (`+` menu → Connectors); no extra memory files or plugins: the project files are the memory.

## 7. Next steps (print this)
```
init ──▶ discuss ──▶ grill ──▶ setup ──▶ build ◀──▶ test ──▶ deploy / deliver
                                           ▲          │
                                           └ improve ◀┘      status: any time
```
Manual and skills: `~/.claude/stareso/README.md` (the `stareso-workflow` repository).
1. Put reference material in `private/sources/locked/` any time (forms, screenshots, exports, notes, data files). Tell me when you add something; I'll ask before reading it.
2. `/stareso-discuss` (Opus, this session or a new one): talk freely (keyboard or voice). Nothing is decided yet.
3. "let's grill" (Opus): the structured rounds. Ends with a walkthrough you correct.
4. `/stareso-setup` (Opus): CLAUDE.md and the roadmap of small slices.
5. New session, **Sonnet, auto mode**, in this folder without a worktree: `/stareso-build M1` (eco profile by default; `fast` when you need it this afternoon).
6. New session, Sonnet: `/stareso-test`. New ideas: `/stareso-improve` (Opus). Lost: `/stareso-status` (any model).
7. Ready to go online or to deliver: `/stareso-deploy` (Opus).
