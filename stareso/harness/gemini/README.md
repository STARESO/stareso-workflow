# Gemini CLI

Nothing here has been run yet: every row of `capabilities.md` is proposed, from geminicli.com/docs read on 2026-10-20 and from the former `PORTABILITY.md`.

The docs' banner says that for unpaid-tier and Google One users Gemini CLI was replaced by Antigravity CLI on 2026-06-18. Check which of the two a colleague runs before setting a project up, and give Antigravity its own folder here if it differs.

## Setting up a project
1. **Steps:** the docs have an Agent Skills page (`/docs/cli/skills/`): check the skills folder there before linking `stareso/skills/stareso-*`. Otherwise paste a step's `SKILL.md` body.
2. **Shared material:** read `<stareso>` as the workflow's folder and `<stareso-repo>` as the repository.
3. **Project instructions:** Gemini CLI reads `GEMINI.md` (`/docs/cli/gemini-md/`). The steps say `AGENTS.md`: use that name if the context file can be set to it, or read `AGENTS.md` as `GEMINI.md`. Start it from the pack's `templates/CLAUDE.md` and add `Harness: gemini · Helpers: subagent` (or `session`); `slice-done` also reads `GEMINI.md`.
4. **Read guard:** add the guarded paths to `.geminiignore` (gitignore syntax). The docs say tools that respect it skip the files, name the `@` command, say the files stay visible to other services such as Git, and that a session restart applies a change. Run the canary in a new session after writing it.
5. **Helpers and hooks:** the docs have a Subagents page (marked experimental) and a Hooks page. Both are to measure, and `workflow-changed.mjs` needs an adapter for the hook format.
