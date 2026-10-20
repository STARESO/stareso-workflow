---
name: stareso-retrofit
description: Bring an existing project (an app or an analysis built before or outside the stareso workflow) into the workflow - inventory, pack and Commands table, standard docs written from what exists, short AGENTS.md, then a retrofit milestone of small slices for the code, built later by stareso-build. Never a rewrite in one go.
---

# stareso-retrofit

**Session:** strong tier · new session in the project folder (no worktree) · normal mode. This step judges what the project *is* and writes its plan from what exists; the code changes it produces are slices built later on the standard tier. If this session runs another model, say so first.

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (USAGE "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

Talk in English unless the user switches to French. Read `<stareso>/README.md` "Files in each project" and the pack's README; nothing else of the workflow unless a step names it.

## 0. Safety
- `git status` clean (or ask to commit); create the branch `retrofit`. Everything below happens on it; `main` stays untouched until the user merges.
- A project in real use (online app, delivered report): nothing here touches an online database, hosting, or real data. Say it in the first message.
- Behaviour must not change in this step: no code edits beyond moving files that nothing imports (scripts, docs). Code changes are slices (step 5).

## 1. Inventory (cheap: names, sizes, headers, never data)
- Tree (`git ls-files` plus untracked names), sizes of the largest source files, `package.json` scripts or the R `main/` and `R/` lists, existing docs (`AGENTS.md`, `README`, `docs/*`, roadmaps, journals, guides), tests, CI, env example, git log shape (branches, merges, dates).
- Pack: from the argument or obvious from the stack; otherwise ask. Private material: any file that looks like data or a reference document goes to `private/` (or `data/raw/`) by name, unread; ask the user to classify (readable / locked / structure) as `stareso-init` does.
- Write the inventory as a 20-line summary in the chat and keep it for step 3; do not write it to a doc.

## 2. Standard files (no behaviour change)
- the harness's read guard file (private guard), `.gitattributes`, `.editorconfig` from the templates; `.gitignore` merged with the pack's (never drop an existing rule).
- **Canary:** create `private/backups/CANARY` (one word), read it with the file-reading tool and expect a refusal. Under `Pack:` in `docs/PLAN.md` write `Guard: verified (<harness>, yyyy-mm-dd)`, or `Guard: not enforced (<harness>, yyyy-mm-dd)` and tell the user.
- `AGENTS.md`: rewrite to the pack template shape: one paragraph, status, rules, stack differences, **Commands table** mapped onto the existing scripts (if a command has no script yet, say "missing: slice M1.x"), approved dependencies from the lock file. Everything descriptive that was in the old AGENTS.md (how the app works, data model, screens) moves to `docs/PLAN.md`; keep the old file as `docs/PLAN.md` input, then delete it (git keeps the history).
- `docs/PLAN.md` from the template: `Phase: build`, `Pack:`; sections filled from the old spec and the inventory, in plain sentences; the **access table** (§5) and **modes** (§6) written from the code's actual rules (read the auth / role checks and state fields, not every screen). Mark anything uncertain with "(to confirm)".
- `docs/GLOSSARY.md` (domain words found in the UI strings, DB columns, column names), `docs/decisions/` (one short record per hard-to-reverse choice already made: stack, auth model, data model, hosting; status "taken before the workflow, yyyy-mm"), `docs/IDEAS.md` (every "not built yet", TODO, "later" and journal wish as 💭 lines; built features are not listed), `docs/QUESTIONS.md` (the "(to confirm)" items, plus `[debt]` lines from step 4), `docs/FEEDBACK.md`, `docs/BUILD-LOG.md` (one line: "retrofit baseline yyyy-mm-dd: <n> commits before the workflow"), `docs/README.md`, (analysis) `docs/LOGBOOK.md` with the old journal entries moved in, dated.
- Roadmap: `docs/ROADMAP.md` from the template; `docs/roadmap/M0.md` = **Baseline**: what exists, as a short list of ticked lines (not slices) so the overview shows it done; old roadmaps and journals: keep their text at the bottom of `M0.md` under "Old roadmap (verbatim)" or in `docs/roadmap/notes.md`, then delete the old files.

## 3. Grilling, short
Rounds as in `grilling.md`, only on what the inventory could not settle: the "(to confirm)" items, the access table, which Commands are missing, what the user wants changed first. Two rounds at most. Then the walkthrough (one paragraph per role) to confirm the PLAN reads true.

## 4. Debt inventory (reading, not fixing)
List, with file names: duplicated components / functions / scripts, files over ~500 lines, scripts without shared helpers, hand-written records that drift (old logs in several formats), missing tests on the rules AGENTS.md states (access, conservation of totals), CRLF files, dead code, secrets or real names in committed files (stop and tell the user at once), orphan files. Each item becomes a `[debt]` line in QUESTIONS.md or a slice in step 5.

## 5. Retrofit milestone
`docs/roadmap/M1.md` "Retrofit": small slices in the usual format, each keeping behaviour identical (its "done when" includes "`check` passes and <the existing test / build / run> still passes"):
- Commands: the missing scripts (`check`, `test`, `rebuild` / `run`, `structure`) · regression safety net first (app: the access-matrix test from the PLAN table, `build` passing; analysis: `tests/regression/snapshot.csv` of the current outputs before anything moves) · shared code into modules (`scripts/lib-*.mjs`, `R/<module>.R`), one slice per family · records (old logs into one format, generated by `slice-done` from now on) · line endings · the tidy slice.
- `tier: strong` and `check: now` on anything touching auth, locked records, migrations or statistics.
Run `roadmap-overview` and `docs-check`; commit on `retrofit` ("Retrofit: standard docs and plan").

## 6. Hand over
Tell the user, in five lines: what was written, what is `(to confirm)`, and the next step:
> Review `docs/PLAN.md` and `docs/roadmap/M1.md`, merge `retrofit` into `main` (`git merge --no-ff retrofit`), then a **new session, standard tier, auto mode**, no worktree: `/stareso-build M1` (eco). Test with `/stareso-test` after it.
