# Claude Code

The workflow was built and measured on Claude Code, so every capability here is adopted. The steps and helpers Claude Code runs are generated, self-contained files:

| Generated | From |
|---|---|
| `~/.claude/skills/stareso-*/SKILL.md` | `stareso/skills/<name>/SKILL.md` + `extras/skill-frontmatter.json` + `extras/wording.md` + `extras/blocks.md` + `models.md` |
| `~/.claude/agents/stareso-slice-builder.md`, `stareso-slice-checker.md` | `stareso/roles/<role>.md` + `extras/agent-heads.json` (tools) + `models.md` (the `tier:` line becomes `model:`) |

`node ~/.claude/stareso/tools/harness-build.mjs` writes them and prints each file's length before and after. With `--check` it writes nothing and exits 1 when a generated file differs from the core or when a mapping no longer fires. The `workflow-changed` hook runs that check whenever the repository moves, and tells the session when the generated files are stale.

**Edit the core, never the generated files.** A change to a step goes into `stareso/skills/<name>/SKILL.md` in neutral wording (tiers, `AGENTS.md`, `<stareso>`, "the browser's server start"), then the build. Claude Code wording that the core cannot carry goes into `extras/wording.md` (a phrase) or `extras/blocks.md` (a passage marked `<!-- harness:<id> -->` in the core).

## What the build guarantees
- No generated step or helper needs `capabilities/`, `harness/` or `models.md` at run time: tier words are replaced by model names, the read-guard install and the tier alias are written inline, and the manual fallbacks Claude Code does not need (helpers, browser) are left out.
- The paths stay `~/.claude/stareso/...`, as before the split.
- The generated files keep their length within about 5 % (the 2026-10-20 split: nine files identical, four grew by the canary, the retro's harness line and the tier alias).

## Install on a new machine
1. Clone the `stareso-workflow` repository as `~/.claude` (or copy `skills/stareso-*`, `agents/stareso-*` and `stareso/` into it).
2. Merge the `hooks` block of `extras/settings.hooks.json` into `~/.claude/settings.json` (user settings). Its `permissions.deny` block is the project guard that `stareso-init` copies from `stareso/templates/settings.json`, shown here for reference.
3. Open a project and type `/stareso-status`.

Capabilities, their levels and their evidence: `capabilities.md`. Models: `models.md`.
