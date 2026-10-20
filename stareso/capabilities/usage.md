# Usage reader

The usage metrics of the retro (turns and ≈ equiv per slice, Carried, planning cost) come from the harness's session transcripts. `tools/session-stats.mjs` is the only code that knows a transcript format, and it writes `docs/USAGE.md`.

**Manual fallback:** none for the numbers. A harness without a reader reports the usage metrics as "n/a" and keeps every records metric (BUILD-LOG, QUESTIONS, FEEDBACK, git), which is why `metrics.md` marks each metric's source. Porting the reader means adding a transcript parser to `session-stats.mjs`, not changing the metric definitions.
