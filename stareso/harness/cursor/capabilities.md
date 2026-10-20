# Cursor capabilities

From the documentation read on 2026-10-20 and from the former `PORTABILITY.md`. Nothing has been run: every row is proposed.

| Capability | Implementation | Level | Status | Evidence |
|---|---|---|---|---|
| Helpers | custom subagents (2.4 changelog; definition format to check in the docs); else mode session | native per the docs | proposed | to measure: one milestone of at least 5 slices |
| Read guard | `.cursorignore` with the guarded paths (Agent, Tab, Inline Edit and @ mentions; not the terminal or MCP tools), `.gitignore` defaults, optionally a `beforeReadFile` hook with `failClosed: true`; the `AGENTS.md` rule for the rest | partial | proposed | to measure: the canary |
| Automation | hooks (`.cursor/hooks.json`); workflow-changed needs an adapter for Cursor's hook format | partial per the docs | proposed | to measure |
| Model tiers | `models.md` (to measure) | to measure | proposed | to measure |
| Browser | not checked in the docs; dev server in a terminal, the checker's list as a user checklist or a scripted smoke test | manual | proposed | to measure |
| Questions | one chat message with numbered questions | manual | proposed | to measure |
| Step invocation | Agent Skills (folder to check in the docs), or a pasted step | partial | proposed | to measure |
| Usage reader | none: usage metrics are "n/a" | none | proposed | — |
