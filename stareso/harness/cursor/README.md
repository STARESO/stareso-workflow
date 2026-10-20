# Cursor

Nothing here has been run yet: every row of `capabilities.md` is proposed, from the documentation read on 2026-10-20 (cursor.com/docs: ignore file, hooks; the 2.4 changelog for subagents) and from the former `PORTABILITY.md`.

## Setting up a project
1. **Steps:** Cursor supports Agent Skills; check the skills folder in the current docs before linking `stareso/skills/stareso-*` there. Otherwise paste a step's `SKILL.md` body as the first message (`capabilities/invocation.md`).
2. **Shared material:** read `<stareso>` as the workflow's folder (`stareso/` of this repository) and `<stareso-repo>` as the repository.
3. **Project instructions:** the steps name `AGENTS.md`. The former `PORTABILITY.md` listed `.cursorrules` for this role: check which file the current version reads, start it from the pack's `templates/CLAUDE.md`, and add `Harness: cursor · Helpers: subagent` (or `session`).
4. **Read guard:** add the guarded paths of `capabilities/read-guard.md` to `.cursorignore` (gitignore syntax). The docs say it blocks the Agent, Tab, Inline Edit and @ mentions, does not block the terminal or MCP tools, and that complete protection is not guaranteed. Files in `.gitignore` are ignored by default, and `private/` is in it. A `beforeReadFile` hook in `.cursor/hooks.json` can also refuse a read (`"permission": "deny"`), fails open on a crash unless `failClosed: true`, and forum reports say it is skipped for a file open in the editor. Run the canary in any case.
5. **Automation:** hooks live in `.cursor/hooks.json` or `~/.cursor/hooks.json` (events include `sessionStart`, `beforeSubmitPrompt`, `subagentStart`, `stop`). `workflow-changed.mjs` reads Claude Code's hook input and output format, so it needs an adapter before it can run there.
