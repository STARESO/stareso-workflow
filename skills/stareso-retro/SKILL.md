---
name: stareso-retro
description: Measured review of how the stareso workflow performed on this project - reads the generated records (USAGE, BUILD-LOG, QUESTIONS, FEEDBACK), computes a few fixed metrics, compares with the previous retro, and ends with a summary and a usage analysis; it proposes (at most three) workflow changes only when the user wants changes. Quick mode after each test (Sonnet); "deep" mode a few times per project (Opus, timelines only, never transcripts).
argument-hint: "[quick | deep]"
---

# stareso-retro

**Session:** quick (default): Sonnet, the test session is fine, about 10 turns. `deep`: Opus, **new session**, about 40 turns. Never read a transcript, a tool output or the code: the records are the evidence; if a number is missing, say so instead of reading more.

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (USAGE "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

Talk in English unless the user switches to French. Budget: stop and report at 15 turns (quick) or 50 (deep), whatever is left undone.

## 1. Refresh and read (both modes)
1. `node ~/.claude/stareso/tools/session-stats.mjs --log` (refreshes `docs/USAGE.md`), then `node ~/.claude/stareso/tools/docs-check.mjs` (count the findings, fix nothing).
2. Read: `docs/USAGE.md` (the table and the "## Retros" section at the bottom: the previous entries are the baseline), `docs/BUILD-LOG.md` lines since the previous retro, `docs/QUESTIONS.md` (`[debt]` lines, open questions and their age), `docs/FEEDBACK.md` + `FEEDBACK-DONE.md` headings only (counts per round, "During build" blocks), `~/.claude/stareso/CHANGELOG.md` entries since the previous retro, `~/.claude/stareso/harness/<harness>/capabilities.md` (the `Harness:` line of `CLAUDE.md`, else claude-code): rows `proposed` are evaluated as `metrics.md` says.

## 2. Metrics (compute, do not guess; write "n/a" when the records cannot give it)
The metrics, their definitions, sources, tools, targets and reference values are in `~/.claude/stareso/metrics.md`. Read it and report every line of its table. Copy the numbers the tools print (USAGE tables, `docs-check`) and count by hand only the ones the table assigns to the retro.

## 3. Reading (one paragraph, then one line per metric that moved)
Name the **single biggest cost** of the period and its cause in the records (a session shape, a brief shape, a skipped step). Compare with the previous retro entry; say what improved after the last accepted change (that is how the workflow learns: one change, then its number).

## 4. Proposals: at most three, only when changes are wanted
By default the retro ends with the summary and the usage analysis (where the tokens went, per step and per slice, against the targets), and proposes nothing. Write the proposals only when the user asked for workflow changes in their request (or answers yes to a one-line offer after the summary); otherwise list the candidate changes in one line of the retro entry as "not proposed" so a later retro can pick them up.
Each: the change (which skill, pack guide, template or tool), the metric it should move, how much. Prefer the change that removes turns from the conductor or a decision from the build. For each one the user accepts: edit the file, add a line to `~/.claude/stareso/CHANGELOG.md`, commit the workflow repository (`git -C ~/.claude add -A && git -C ~/.claude commit -m "…"`; push only with a "yes"). Refused ones are noted in the retro entry so they are not proposed again without new evidence.

## 5. Record
Append to `docs/USAGE.md` under `## Retros` (create the heading below the usage markers if missing), one entry, ten lines at most:
`### Retro yyyy-mm-dd (quick | deep) · since <previous date or project start>` · the metrics line · the reading · the proposals with accepted / refused · the next retro ("after milestone M<n>'s test"). Commit docs.

## Deep mode only (Opus)
Between steps 2 and 3: run the deep statistics on the sessions since the previous deep retro and read **the user-message timelines only** (the `U` lines of the `.txt` files the tool writes), never the transcripts:
`node ~/.claude/stareso/tools/session-stats.mjs <scratch-dir> <the project's transcript files>` (the project's transcript folder is the one `--log` used; worktrees have their own). Look for the patterns that cost the most in the three first apps: streams of one-line requests into a long session, the same subject coming back (rework), long gaps after a usage limit, decisions taken in chat that never reached PLAN. Quote at most one timeline line per pattern. Delete the scratch files afterwards (they hold prompts).

## End of a project (deep mode, when PLAN says `Phase: deployed`, `delivered` or `released`)
Also:
- Compare this project's USAGE totals and per-slice costs with the previous projects' `docs/USAGE.md` (the user names the folders); one table, three to five rows.
- Read the pack guide's section list and the project's `CLAUDE.md` Stack / Commands and `docs/decisions/`: what this project did that the pack does not describe becomes a proposal to add to the pack guide (that is how the guides were born: from projects A and B); what the pack describes and the project did otherwise becomes a question (project exception or outdated default?).
- List the CHANGELOG entries made during the project and, for each, whether a later retro measured its effect; unmeasured ones are the first thing the next project should watch.
- Write the entry under `## Retros` as "Project retro" and, in `~/.claude/stareso/DESIGN-NOTES.md`, one dated paragraph only if a decision of the workflow changed.

## What this skill never does
Rewrite the workflow in one go, read code, propose a change without a metric, or spend more than its budget. The method is one measured change per retro.
