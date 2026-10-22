# Usage reader

The usage metrics of the retro (turns and tokens per slice, Carried, planning cost) come from the harness's session transcripts. Tokens are reported by kind and by model or tier, never as money (`metrics.md`, "Token metrics"), and a harness may add its own summary unit (Claude Code: ≈ equiv). `tools/session-stats.mjs` is the only code that knows a transcript format, and it writes `docs/data/sessions.jsonl`.

**Manual fallback:** none for the numbers. A harness without a reader reports the usage metrics as "n/a" and keeps every records metric (build records, QUESTIONS, FEEDBACK, git), which is why `metrics.md` marks each metric's source. Porting the reader means adding a transcript parser to `session-stats.mjs`, not changing the metric definitions.
