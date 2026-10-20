# Codex capabilities

From the documentation read on 2026-10-20 and from the former `PORTABILITY.md`. Nothing has been run: every row is proposed until a milestone or a canary measures it.

| Capability | Implementation | Level | Status | Evidence |
|---|---|---|---|---|
| Helpers | custom agents (`.codex/agents/<name>.toml`: `name`, `description`, `developer_instructions`, optional `model` and `sandbox_mode`), started when the conductor asks; else mode session | native per the docs | proposed | to measure: one milestone of at least 5 slices |
| Read guard | the `AGENTS.md` rule; the sandbox limits edits and commands but the docs describe no per-path read refusal | manual | proposed | to measure: the canary |
| Automation | no hook found in the pages read; the steps' manual lines (workflow changed by hand, `session-stats`, `docs-check`) | manual | proposed | to measure |
| Model tiers | `models.md` (to measure); per-agent `model` field | partial | proposed | to measure |
| Browser | none found in the pages read; dev server in a terminal, the checker's list as a user checklist or a scripted smoke test | manual | proposed | to measure |
| Questions | one chat message with numbered questions | manual | proposed | to measure |
| Step invocation | Agent Skills in `.agents/skills/` and `$HOME/.agents/skills/`, started with `$name`; `agents/openai.yaml` may set `policy.allow_implicit_invocation` (a way to keep init, build, deploy and retrofit typed-only) | native per the docs | proposed | to measure |
| Usage reader | none: `session-stats` reads Claude Code transcripts only, so usage metrics are "n/a" | none | proposed | — |
