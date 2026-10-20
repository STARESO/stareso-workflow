# Claude Code capabilities

Levels and statuses are defined in `capabilities/README.md`. Every row is adopted: the workflow was built and measured here.

| Capability | Implementation | Level | Status | Evidence |
|---|---|---|---|---|
| Helpers | subagents `stareso-slice-builder` and `stareso-slice-checker` (generated from `roles/`), started by the build conductor in the foreground (mode subagent) | native | adopted | SecuSurf M5 (2026-10-20): 8.8 conductor turns and 335k ≈ equiv per slice, against Scriba's 49 turns per slice before the 2026-10-19 review |
| Read guard | deny rules in the project's `.claude/settings.json` (`templates/settings.json`, plus `data/raw/` and `data/processed/` for analysis packs), and the rule in `CLAUDE.md` and the roles | partial: the rules stop the file tools, the rule covers shell commands | adopted | canary 2026-10-20: a deny rule written during a session refused the Read tool at once, so init can verify the guard in the same session |
| Automation | hooks in the user settings (`extras/settings.hooks.json`): `workflow-changed` on SessionStart, UserPromptSubmit and PostToolUse (Agent) | partial: workflow changed is automated; records refresh and docs-check stay manual lines of build, test, improve and retro | adopted | `workflow-changed` live since 2026-10-20 (commit ed33785) |
| Model tiers | `models.md`: strong Opus, standard Sonnet, light Haiku; the agents' `model:` line; `model:` in briefs | native | adopted | SecuSurf M5 (2026-10-20): Sonnet conductor and helpers, 8.8 turns and 335k per slice |
| Browser | the desktop app's browser pane (`preview_start`, `preview_stop`, page tools), `.claude/launch.json` | native | adopted | one checker per milestone since 2026-10-19, on SecuSurf and Scriba |
| Questions | the question tool (choices as buttons) | native | adopted | init sorting, grilling rounds, the build's one start question |
| Step invocation | skills in `~/.claude/skills/`; `disable-model-invocation: true` on init, build, deploy and retrofit; `argument-hint` | native | adopted | in use since 2026-10-17 |
| Usage reader | `tools/session-stats.mjs` reads the transcripts in `~/.claude/projects/` into `docs/USAGE.md` | native | adopted | USAGE tables of Scriba, SecuSurf and BaieWatch (2026-10-20) |

## No-regression check for the split of 2026-10-20
The next Claude Code build after the split is compared with SecuSurf M5 (8.8 conductor turns and 335k ≈ equiv per slice) and Scriba M28 (19.7 turns and 990k per slice, 6 slices, 2026-10-20) on the same two numbers (`metrics.md`). A move of more than 10 % in either means the generated files are inspected before anything else changes.
