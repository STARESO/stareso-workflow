# Claude Code capabilities

Levels and statuses are defined in `capabilities/README.md`. Every row is adopted: the workflow was built and measured here.

| Capability | Implementation | Level | Status | Evidence |
|---|---|---|---|---|
| Helpers | subagents `stareso-slice-builder` and `stareso-slice-checker` (generated from `roles/`), started by the build conductor in the foreground (mode subagent) | native | adopted | Project A M5 (2026-10-20): 8.8 conductor turns and 335k ≈ equiv per slice, against project C's 49 turns per slice before the 2026-10-19 review |
| Read guard | deny rules in the project's `.claude/settings.json` (`templates/settings.json`, plus `data/raw/` and `data/processed/` for analysis packs), and the rule in `CLAUDE.md` and the roles | partial: the rules stop the file tools, the rule covers shell commands | adopted | canary 2026-10-20: a deny rule written during a session refused the Read tool at once, so init can verify the guard in the same session |
| Automation | hooks in the user settings (`extras/settings.hooks.json`): `workflow-changed` on SessionStart, UserPromptSubmit and PostToolUse (Agent) | partial: workflow changed is automated; records refresh and docs-check stay manual lines of build, test, improve and retro | adopted | `workflow-changed` live since 2026-10-20 (commit ed33785) |
| Model tiers | `models.md`: strong Opus, standard Sonnet, light Haiku; the agents' `model:` line; `model:` in briefs | native | adopted | Project A M5 (2026-10-20): Sonnet conductor and helpers, 8.8 turns and 335k per slice |
| Browser | the desktop app's browser pane (`preview_start`, `preview_stop`, page tools), `.claude/launch.json` | native | adopted | one checker per milestone since 2026-10-19, on projects A and C |
| Questions | the question tool (choices as buttons) | native | adopted | init sorting, grilling rounds, the build's one start question |
| Step invocation | skills in `~/.claude/skills/`; `disable-model-invocation: true` on init, build, deploy and retrofit; `argument-hint` | native | adopted | in use since 2026-10-17 |
| Usage reader | `tools/session-stats.mjs` reads the transcripts in `~/.claude/projects/` into `docs/USAGE.md`: tokens by kind (input, cache read, cache write, output) and by model, turns per model, and the frozen ≈ equiv summary (below) | native | adopted | USAGE tables of projects C, A and B (2026-10-20) |

## Usage reader and the "≈ equiv" unit
`tools/session-stats.mjs --log` reads the transcripts of the project's sessions and their helpers in `~/.claude/projects/` and writes `docs/USAGE.md`. It logs the four token kinds of Claude Code (input, cache read, cache write, output): all four per model in the "Tokens per model" table, and output, cache read and cache write per session in the Details table. It also counts turns per model.

Its summary unit is **≈ equiv** = cache read × 0.1 + cache write × 1.25 + output × 5 (uncached input is left out, as it always was). The weights are frozen. They are a fixed exchange rate between token kinds, taken once from the standard tier's ratios, and they never change with prices or currencies, so a number such as project A M5's 335k per slice stays comparable. ≈ equiv is not money and not a core concept: it exists only in Claude Code's records, and the token rules of `metrics.md` still apply to the raw kinds.

## No-regression check for the split of 2026-10-20
The next Claude Code build after the split is compared with project A M5 (8.8 conductor turns and 335k ≈ equiv per slice) and project C M28 (19.7 turns and 990k per slice, 6 slices, 2026-10-20) on the same two numbers (`metrics.md`). A move of more than 10 % in either means the generated files are inspected before anything else changes.
