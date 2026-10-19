# Using the workflow outside Claude Code

The workflow is three layers; only the thinnest one is tied to Claude Code.

| Layer | What it is | Tied to |
|---|---|---|
| **Process and records** | phases, `docs/` files, slice briefs, test rounds, retro, privacy rules, the Node tools | nothing: any assistant, any model, even a human team |
| **Skill texts** | the `SKILL.md` files: instructions for one phase, plus the pack guides and templates | plain Markdown; the frontmatter (`name`, `description`, `disable-model-invocation`) is Claude Code's |
| **Harness features** | `/skill` invocation, the helper agents (`agents/*.md` started by the conductor), the browser pane tools, the `.claude/settings.json` read guard, `launch.json`, memory | Claude Code |

## What a colleague on another assistant does

- **Codex CLI / Cursor / Gemini CLI / Aider:** put the pack's `CLAUDE.md` content in the tool's project file (`AGENTS.md`, `.cursorrules`, `GEMINI.md`…); keep `docs/` exactly as is; run a phase by pasting the matching `SKILL.md` body as the first message ("follow these instructions") or by saving it as the tool's custom command / prompt file. The Node tools run unchanged (`node ~/.claude/stareso/tools/…`, or copy `tools/` into the project). The read guard has no equivalent everywhere: the rule in `CLAUDE.md` ("never read `private/`") remains, enforced by the user's attention and by keeping locked files out of the tool's folder when possible.
- **ChatGPT / Claude.ai in a browser (no file access):** the discussion and grilling phases work as pure conversation: paste `grilling.md` and `templates/PLAN.md`, answer rounds, paste the resulting PLAN back into the repository by hand. Build and test need a coding tool.
- **Helpers (the conductor + fresh helper split):** tools without sub-agents run the conductor's loop in one session, one slice at a time, clearing the context between slices (`/clear` or a new chat) and reading the brief again: the per-slice cost is the same, the loop is just not unattended. Tools with sub-agents (Codex, Cursor background agents) map `stareso-slice-builder.md` onto their agent definition file.
- **Verification:** replace the browser-pane checker by the tool's own browser or by a Playwright smoke script for apps; the analysis pack's verification (`run`, `check`, figures as files) needs no harness feature.

## What to keep harness-neutral when editing the workflow
- Skills name project **commands** (`check`, `run`…) from the `CLAUDE.md` table, never a tool or a package manager.
- Skills refer to harness features by role ("the helper agent", "the browser pane", "the question tool") with a plain-text fallback ("otherwise do it in this session", "otherwise ask in chat").
- Records are plain Markdown written by the tools; nothing lives only in the chat or in memory.
