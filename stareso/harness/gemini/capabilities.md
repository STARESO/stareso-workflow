# Gemini CLI capabilities

From geminicli.com/docs read on 2026-10-20 and from the former `PORTABILITY.md`. Nothing has been run: every row is proposed.

| Capability | Implementation | Level | Status | Evidence |
|---|---|---|---|---|
| Helpers | subagents (experimental per the docs); else mode session | to measure | proposed | to measure: one milestone of at least 5 slices |
| Read guard | `.geminiignore` with the guarded paths (tools that respect it; applied after a restart), and the `AGENTS.md` rule | partial per the docs | proposed | to measure: the canary, in a new session |
| Automation | hooks (docs page `/docs/hooks/`); workflow-changed needs an adapter | to measure | proposed | to measure |
| Model tiers | `models.md` (to measure); model choice per `/docs/cli/model/` | to measure | proposed | to measure |
| Browser | not checked in the docs; dev server in a terminal, the checker's list as a user checklist or a scripted smoke test | manual | proposed | to measure |
| Questions | one chat message with numbered questions | manual | proposed | to measure |
| Step invocation | Agent Skills (docs page `/docs/cli/skills/`), or a pasted step | to measure | proposed | to measure |
| Usage reader | none: usage metrics are "n/a" | none | proposed | — |
