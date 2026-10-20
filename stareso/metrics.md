# Workflow metrics

The single definition of the numbers a retro reports. Each metric is defined once here, and the retro skill points to this file instead of keeping its own table.

**Source** says where the number comes from. "records" means the project's own files (`docs/BUILD-LOG.md`, `docs/QUESTIONS.md`, `docs/FEEDBACK.md`, the roadmap and git), which any harness can read. "usage" means the session transcripts, read by `session-stats` into `docs/USAGE.md`. Only `session-stats` knows the transcript format of a harness, so a port to another harness replaces that one reader and keeps the definitions.

**Tool** names what computes the number. A retro copies tool numbers and does not recompute them. When no tool gives a number yet, the retro counts it from the records and says so. When the records cannot give it, the retro writes "n/a".

| Metric | Definition | Source | Tool | Target | Reference |
|---|---|---|---|---|---|
| Conductor turns per merged slice | Turns of the step that merged slices ÷ the `Merge slice …` commits made during it. | usage | `session-stats --log` (Steps table, Cost per slice table) | < 15 | Project C 49 before the 2026-10-19 review · project A M5 8.8 (2026-10-20) |
| ≈ equiv per slice, conductor vs helpers | ≈ equiv of the merging step ÷ slices merged, and the conductor's share of that cost (the rest is helpers). | usage | `session-stats --log` (Cost per slice, Details) | conductor < 50 % | Project C conductor 74 % (2026-10-19) · project A M5 335k per slice (2026-10-20) |
| Planning cost per planned slice | ≈ equiv of an improve or test step ÷ the slices its commits added to the roadmap (`- [ ] **<id> · …` lines, an id also removed in the same commit being a tick or a move). A commit made during a status or retro step goes back to the session's last improve or test. | usage + records (git) | `session-stats --log` (Planning cost table) | < 300k | Project C improve 576k (6 slices, 2026-10-20) · project A improve 273k and 433k (2026-10-20, the review's estimate of 875k counted fewer slices) · project C test segmentation 176k and 82k, about 110k over both rounds |
| Carried | For a session's later steps: share of the step's cost spent re-reading the context it started with **above the base**, the base being the project's median context at the first turn of its sessions (about 70–75k on 2026-10-20). It is what a new session would really have saved. | usage | `session-stats --log` (Steps table, Carried column) | < 20 % | Project C improve after a build 21 % · 58k, retro after an improve 45 % · 137k (2026-10-20) |
| Sessions over 300 turns or more than one milestone | Sessions whose turns exceed 300, or whose build ran past the milestone it started with. | usage | `session-stats --log` (Sessions table) | 0 | Project C 2 (2026-10-17) |
| Helper median output and fix rounds | Median output of the build helpers, and the share of slices that needed a fix round. | usage + records | retro, from USAGE Details and BUILD-LOG results | — | 3.4k · about 3 % (project C, 2026-10-19) |
| Conductor-built slices | BUILD-LOG slice lines with `0 tokens`, `tokens not shown` or `built in chat`, human slices (done by the user) left out: the conductor built the slice itself instead of a fresh helper. | records | `session-stats --log` (Conductor-built line, per day) | 0 | Project A 10 on 2026-10-19/20, then 0 · project C 11 on 2026-10-18, then 0 |
| Requests logged during builds | FEEDBACK "During build" lines. The rule is "logged, not built", so every logged one is a win and a request *built* mid-run is a miss (it also shows as a conductor-built slice). | records | retro, from FEEDBACK headings | 0 built | — |
| Anomalies | BUILD-LOG lines with a profile other than eco that the user did not ask for, plus `docs-check` findings. One line, because both were flat everywhere. | records | `docs-check.mjs` (findings), retro (profiles in BUILD-LOG) | 0 | 0 in projects C, A and B (eco always, docs-check 0, 2026-10-20) |
| Debt | Open `[debt]` lines in QUESTIONS and their age, and whether a tidy slice ran per milestone. | records | `docs-check.mjs` (stale debt lines), retro (age) | paid within one milestone | — |
| Reworks | Slices whose title repeats an earlier slice's subject (visibility, exam vs training…). Each one is a grilling branch that was skipped. | records | retro, from roadmap titles | 0 | — |

"≈ equiv" in the table is Claude Code's summary unit (`harness/claude-code/capabilities.md`, usage reader), and its references are Claude Code numbers. Another harness reports its own summary unit, or none, under the token rules below.

## Token metrics

Token metrics stay in tokens, per harness, with no money and no price table. The harness's usage reader (`capabilities/usage.md`) reports tokens by kind (input, cache read, cache write, output) and by model or tier, as the harness logs them. A kind that a platform does not log is "n/a".

Two rules hold everywhere:
- **Never add raw tokens of different kinds**, because a cache read and an output token differ in cost by about 50 times.
- **Never add tokens across models.**

Comparisons are made only within one harness and one tier, per slice. A harness may define one summary unit that weights its own token kinds, and it must say so in its `capabilities.md`. On a subscription, usage limits are spent rather than dollars, which is why the workflow uses no price weighting.

## Evaluating a capability on a platform

Each harness lists its capabilities in `harness/<harness>/capabilities.md` with a status (`capabilities/README.md`). A **proposed** row is evaluated once, after one milestone of at least five slices built on that harness, or after the canary for the read guard. The retro of that milestone reads the row, computes the numbers below, writes them in the row's Evidence and sets the status to **adopted** or **rejected**, with a CHANGELOG line. That is one workflow change, so it counts towards the retro's three.

Since 2026-10-20 every BUILD-LOG line carries `harness · helper mode · tier` (`slice-done`, defaults from the `Harness:` and `Helpers:` lines of the project instructions, else `claude-code · subagent`, and the brief's tier). Older lines count as `claude-code · subagent` with the tier of their model. The retro splits the records metrics by harness × helper mode × tier:

| Metric | Definition | Source |
|---|---|---|
| Fix rounds | share of slices whose result is "ok after n fix" or that failed | records (BUILD-LOG) |
| Check-fix slices | `Check fix:` slices added per milestone | records (roadmap) |
| Reworks | as in the table above | records (roadmap) |
| Conductor-built slices | as in the table above | records (BUILD-LOG) |
| Minutes per slice | median gap between consecutive BUILD-LOG times within one build run | records (BUILD-LOG) |
| Guard verified | the `Guard:` line under `Pack:` in `docs/PLAN.md` (verified, not enforced, or missing) | records (PLAN) |

Usage metrics (conductor turns and ≈ equiv per slice, Carried, planning cost) are split the same way only where the harness has a usage reader (`capabilities/usage.md`); elsewhere they are "n/a". A row is adopted when its numbers meet the targets of the table above, or stay within the Claude Code references where a target is missing. A cheaper tier or helper mode is adopted for a kind of slice only when fix rounds and check-fix slices do not rise.

## No regression after the harness split

On 2026-10-20 the steps and roles moved into a harness-neutral core, and the Claude Code files became generated (`tools/harness-build.mjs`). Nine generated files came out identical and four grew by less than about 5 %, so nothing should cost more. The next Claude Code build after the split checks it: its conductor turns per merged slice and ≈ equiv per slice are compared with project A M5 (8.8 turns, 335k, 2026-10-20) and project C M28 (19.7 turns, 990k, 6 slices, 2026-10-20), each project against its own reference. A move of more than 10 % in either number means the generated files are inspected first (`harness-build.mjs --check`, then `git diff 54eb59b -- skills agents`), before any other cause is looked for.
