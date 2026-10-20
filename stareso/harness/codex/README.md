# Codex (CLI and IDE)

Nothing here has been run yet: every row of `capabilities.md` is proposed, from the documentation read on 2026-10-20 (learn.chatgpt.com, which developers.openai.com/codex now redirects to). The first project on Codex measures them.

## Setting up a project
1. **Steps:** Codex reads Agent Skills from `.agents/skills/` (in the working folder, its parents up to the repository root, and the root), from `$HOME/.agents/skills/` for the user, and follows symbolic links. Link or copy `stareso/skills/stareso-*` there. A step starts with `$stareso-<step>` or from `/skills`, where the steps write `/stareso-<step>`.
2. **Shared material:** the steps write `<stareso>` for the workflow's folder (`stareso/` of this repository) and `<stareso-repo>` for the repository itself. Read them as those two paths, or replace them in your copy.
3. **Project instructions:** the steps name the project file `AGENTS.md`, which Codex reads. Start it from the pack's `templates/CLAUDE.md` and add a line `Harness: codex · Helpers: subagent` (or `session`), which `slice-done` copies into the BUILD-LOG.
4. **Helpers:** custom agents are TOML files in `~/.codex/agents/` or `.codex/agents/`, one per file, with `name`, `description` and `developer_instructions`; `model` and `sandbox_mode` are optional and inherit from the parent session. Write `stareso-slice-builder` and `stareso-slice-checker` from `stareso/roles/`. The docs say Codex starts subagents only when asked, which the build step does.
5. **Models:** `models.md` maps the tiers once they are measured. Until then, choose the models by hand, and write `tier:` in briefs.
6. **Read guard:** the sandbox modes (`read-only`, `workspace-write`) limit edits and commands, and the docs describe no per-path read refusal. Keep the `AGENTS.md` rule, keep locked material outside the workspace where possible, and run the canary (`capabilities/read-guard.md`) to record what happens.

The first build on Codex is a measurement, so keep the eco profile and one milestone of at least five slices, then run `/stareso-retro`.
