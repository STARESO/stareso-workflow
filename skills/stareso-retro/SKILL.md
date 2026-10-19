---
name: stareso-retro
description: Measured review of how the stareso workflow performed on this project - reads the generated records (USAGE, BUILD-LOG, QUESTIONS, FEEDBACK), computes a few fixed metrics, compares with the previous retro, proposes at most three workflow changes and applies the accepted ones. Quick mode after each test (Sonnet); "deep" mode a few times per project (Opus, timelines only, never transcripts).
argument-hint: "[quick | deep]"
---

# stareso-retro

**Session:** quick (default): Sonnet, the test session is fine, about 10 turns. `deep`: Opus, **new session**, about 40 turns. Never read a transcript, a tool output or the code: the records are the evidence; if a number is missing, say so instead of reading more.

Talk in English unless the user switches to French. Budget: stop and report at 15 turns (quick) or 50 (deep), whatever is left undone.

## 1. Refresh and read (both modes)
1. `node ~/.claude/stareso/tools/session-stats.mjs --log` (refreshes `docs/USAGE.md`), then `node ~/.claude/stareso/tools/docs-check.mjs` (count the findings, fix nothing).
2. Read: `docs/USAGE.md` (the table and the "## Retros" section at the bottom: the previous entries are the baseline), `docs/BUILD-LOG.md` lines since the previous retro, `docs/QUESTIONS.md` (`[debt]` lines, open questions and their age), `docs/FEEDBACK.md` + `FEEDBACK-DONE.md` headings only (counts per round, "During build" blocks), `~/.claude/stareso/CHANGELOG.md` entries since the previous retro.

## 2. Metrics (compute, do not guess; write "n/a" when the records cannot give it)
| Metric | From | Reference (Scriba, 2026-10-19 review) |
|---|---|---|
| Conductor turns per merged slice | USAGE build sessions turns ÷ BUILD-LOG slices in the period | 49 before the review; target < 15 |
| ≈ equivalents per slice, conductor vs helpers | USAGE | conductor 74 % of the cost; target < 50 % |
| Helper median output and share of slices needing a fix round | USAGE helpers, BUILD-LOG results | 3.4 k · ~3 % |
| Sessions over 300 turns or more than one milestone | USAGE | 0 is the target |
| Requests logged during builds | FEEDBACK "During build" lines | the rule is "logged, not built": every one is a win; a request *built* mid-run is a miss |
| Profile used | BUILD-LOG lines | eco unless asked |
| Records drift | docs-check findings | 0 |
| Debt | `[debt]` lines open and their age; tidy slice run per milestone? | paid within one milestone |
| Reworks | slices whose title repeats an earlier one's subject (visibility, exam vs training…) | each one is a grilling branch that was skipped |

## 3. Reading (one paragraph, then one line per metric that moved)
Name the **single biggest cost** of the period and its cause in the records (a session shape, a brief shape, a skipped step). Compare with the previous retro entry; say what improved after the last accepted change (that is how the workflow learns: one change, then its number).

## 4. Proposals: at most three
Each: the change (which skill, pack guide, template or tool), the metric it should move, how much. Prefer the change that removes turns from the conductor or a decision from the build. For each one the user accepts: edit the file, add a line to `~/.claude/stareso/CHANGELOG.md`, commit the workflow repository (`git -C ~/.claude add -A && git -C ~/.claude commit -m "…"`; push only with a "yes"). Refused ones are noted in the retro entry so they are not proposed again without new evidence.

## 5. Record
Append to `docs/USAGE.md` under `## Retros` (create the heading below the usage markers if missing), one entry, ten lines at most:
`### Retro yyyy-mm-dd (quick | deep) · since <previous date or project start>` · the metrics line · the reading · the proposals with accepted / refused · the next retro ("after milestone M<n>'s test"). Commit docs.

## Deep mode only (Opus)
Between steps 2 and 3: run the deep statistics on the sessions since the previous deep retro and read **the user-message timelines only** (the `U` lines of the `.txt` files the tool writes), never the transcripts:
`node ~/.claude/stareso/tools/session-stats.mjs <scratch-dir> <the project's transcript files>` (the project's transcript folder is the one `--log` used; worktrees have their own). Look for the patterns that cost the most in the three first apps: streams of one-line requests into a long session, the same subject coming back (rework), long gaps after a usage limit, decisions taken in chat that never reached PLAN. Quote at most one timeline line per pattern. Delete the scratch files afterwards (they hold prompts).

## What this skill never does
Rewrite the workflow in one go, read code, propose a change without a metric, or spend more than its budget. The method is one measured change per retro.
