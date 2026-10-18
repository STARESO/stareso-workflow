---
name: stareso-app-init
description: Start a new STARESO-style app in the current folder - creates the private-safe folder structure, moves any existing files to private/sources/locked without reading them, sets up git. First step of the stareso-app workflow.
disable-model-invocation: true
---

# stareso-app-init

Talk to the user in English unless they ask for French. Shared material: `~/.claude/stareso-app/` (`README.md` = the workflow, `templates/`). Keep this step cheap: no exploring, no reading of user files.

## 1. Check the folder
- Run `ls -A` (names only). If it already looks like a project (`package.json`, `src/`, `.git` with commits, `docs/PLAN.md`), stop and ask: maybe this is the wrong folder, or `/stareso-app-status` is what they want.
- If the user gave an app name as argument, use it; otherwise ask for a short working name (it can change later).

## 2. Protect before anything else
1. Copy `templates/gitignore` to `.gitignore` and `templates/settings.json` to `.claude/settings.json`.
2. If files are present: create `private/sources/locked/` and **move** every existing file and folder into it with `mv`, keeping their names and sub-folders. Do **not** open, read, preview or grep them. Say that you can see the file names (only the names).

## 3. Create the structure
```
.claude/settings.json  .claude/launch.json (from templates, port 3100 unless another app uses it)
CLAUDE.md              (templates/CLAUDE.md, app name filled in, rest left for setup)
docs/IDEAS.md  docs/PLAN.md (Phase: discussion)  docs/GLOSSARY.md  docs/decisions/
private/sources/locked/  private/sources/readable/  private/sources/INDEX.md
private/data/  private/backups/
```
ROADMAP, FEEDBACK, QUESTIONS and BUILD-LOG are created later by the skills that need them. Also create `docs/README.md` from the template (list of the docs and what each is for). Doc files in `docs/` are named in capitals (`PLAN.md`, `ROADMAP.md`, `BUILD-LOG.md`…); only decision records use `NNNN-slug.md`.

## 4. Git
`git init -b main`, then `git status` to check that nothing under `private/` is listed, then a first commit ("Initial structure"). Never add a remote, never push.

## 5. Sort the existing files (if any)
Show the list of names and ask the user, per file or by group (use the question tool, several files per question): **readable** (Claude may read it), **locked** (never read: the default), or **structure** (a dataset: Claude sees columns, types and counts only). Then:
- readable → move to `private/sources/readable/`;
- structure → move to `private/data/`;
- locked → stays.
Fill `private/sources/INDEX.md` (one line per file; ask the user for a few words on what each one is, or leave "?").

## 6. Keep the context small
Remind the user, in two lines, that for this project:
- only the connectors the app really needs should stay on (the `+` menu → Connectors; turning one off also turns it off for new sessions);
- no extra memory files or plugins are needed: the project files are the memory.

## 7. Next steps (print this checklist)
1. Put reference material in `private/sources/locked/` any time (paper forms, screenshots, old exports, notes). Tell me when you add something; I'll ask before reading it.
2. `/stareso-app-discuss`: talk freely about the app (keyboard or voice). Nothing is decided yet.
3. Say "let's grill" (or `/stareso-app-grill`) when you are ready for the structured questions.
4. `/stareso-app-setup`: CLAUDE.md and the roadmap of small slices.
5. New session (Sonnet, auto mode): `/stareso-app-build`, then "test time" in the same session.
6. New ideas any time: `/stareso-app-improve`. Lost? `/stareso-app-status`.
7. Ready to go online: `/stareso-app-deploy`.

Prerequisites for the build later (check only if asked): Node.js LTS, Git, a local PostgreSQL.
