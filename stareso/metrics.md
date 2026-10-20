# Workflow metrics

The single definition of the numbers a retro reports. Each metric is defined once here, and the retro skill points to this file instead of keeping its own table.

**Source** says where the number comes from. "records" means the project's own files (`docs/BUILD-LOG.md`, `docs/QUESTIONS.md`, `docs/FEEDBACK.md`, the roadmap and git), which any harness can read. "usage" means the session transcripts, read by `session-stats` into `docs/USAGE.md`. Only `session-stats` knows the transcript format of a harness, so a port to another harness replaces that one reader and keeps the definitions.

**Tool** names what computes the number. A retro copies tool numbers and does not recompute them. When no tool gives a number yet, the retro counts it from the records and says so. When the records cannot give it, the retro writes "n/a".

| Metric | Definition | Source | Tool | Target | Reference |
|---|---|---|---|---|---|
| Conductor turns per merged slice | Turns of the step that merged slices ÷ the `Merge slice …` commits made during it. | usage | `session-stats --log` (Steps table, Cost per slice table) | < 15 | Scriba 49 before the 2026-10-19 review · SecuSurf M5 8.8 (2026-10-20) |
| ≈ equiv per slice, conductor vs helpers | ≈ equiv of the merging step ÷ slices merged, and the conductor's share of that cost (the rest is helpers). | usage | `session-stats --log` (Cost per slice, Details) | conductor < 50 % | Scriba conductor 74 % (2026-10-19) · SecuSurf M5 335k per slice (2026-10-20) |
| Planning cost per planned slice | ≈ equiv of an improve or test step ÷ the slices its commits added to the roadmap (`- [ ] **<id> · …` lines, an id also removed in the same commit being a tick or a move). A commit made during a status or retro step goes back to the session's last improve or test. | usage + records (git) | `session-stats --log` (Planning cost table) | < 300k | Scriba improve 576k (6 slices, 2026-10-20) · SecuSurf improve 273k and 433k (2026-10-20, the review's estimate of 875k counted fewer slices) · Scriba test segmentation 176k and 82k, about 110k over both rounds |
| Carried | For a session's later steps: share of the step's cost spent re-reading the context it started with **above the base**, the base being the project's median context at the first turn of its sessions (about 70–75k on 2026-10-20). It is what a new session would really have saved. | usage | `session-stats --log` (Steps table, Carried column) | < 20 % | Scriba improve after a build 21 % · 58k, retro after an improve 45 % · 137k (2026-10-20) |
| Sessions over 300 turns or more than one milestone | Sessions whose turns exceed 300, or whose build ran past the milestone it started with. | usage | `session-stats --log` (Sessions table) | 0 | Scriba 2 (2026-10-17) |
| Helper median output and fix rounds | Median output of the build helpers, and the share of slices that needed a fix round. | usage + records | retro, from USAGE Details and BUILD-LOG results | — | 3.4k · about 3 % (Scriba, 2026-10-19) |
| Conductor-built slices | BUILD-LOG slice lines with `0 tokens`, `tokens not shown` or `built in chat`, human slices (done by the user) left out: the conductor built the slice itself instead of a fresh helper. | records | `session-stats --log` (Conductor-built line, per day) | 0 | SecuSurf 10 on 2026-10-19/20, then 0 · Scriba 11 on 2026-10-18, then 0 |
| Requests logged during builds | FEEDBACK "During build" lines. The rule is "logged, not built", so every logged one is a win and a request *built* mid-run is a miss (it also shows as a conductor-built slice). | records | retro, from FEEDBACK headings | 0 built | — |
| Anomalies | BUILD-LOG lines with a profile other than eco that the user did not ask for, plus `docs-check` findings. One line, because both were flat everywhere. | records | `docs-check.mjs` (findings), retro (profiles in BUILD-LOG) | 0 | 0 in Scriba, SecuSurf and BaieWatch (eco always, docs-check 0, 2026-10-20) |
| Debt | Open `[debt]` lines in QUESTIONS and their age, and whether a tidy slice ran per milestone. | records | `docs-check.mjs` (stale debt lines), retro (age) | paid within one milestone | — |
| Reworks | Slices whose title repeats an earlier slice's subject (visibility, exam vs training…). Each one is a grilling branch that was skipped. | records | retro, from roadmap titles | 0 | — |

≈ equiv is defined in the USAGE glossary: cache read × 0.1 + cache write × 1.25 + output × 5, a comparison unit and not money.
