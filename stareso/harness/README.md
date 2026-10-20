# Harnesses

A harness is the program that runs the model and its tools. The workflow has three layers, and only the last one depends on the harness:

| Layer | What it is | Depends on |
|---|---|---|
| **Process and records** | phases, `docs/` files, slice briefs, test rounds, retro, privacy rules, the Node tools | nothing: any assistant, any model, even a human team |
| **Steps and roles** | `skills/<name>/SKILL.md` (Agent Skills format: `name` and `description` only) and `roles/*.md`, plus the packs and templates | plain Markdown, with tiers instead of models and capabilities instead of products |
| **Capabilities** | helpers, read guard, automation, model tiers, browser, questions, step invocation, usage reader (`capabilities/`) | each harness, at a level from native to manual |

Each folder here says how one harness provides the capabilities (`capabilities.md`), which models stand for the tiers (`models.md`, the only files that name models), and how to set a project up (`README.md`).

| Harness | Status | Notes |
|---|---|---|
| `claude-code/` | adopted, measured | the generated files come from the core through `tools/harness-build.mjs` and `extras/` |
| `codex/` | proposed | Agent Skills, custom agents, `AGENTS.md`; no per-path read guard found in the docs |
| `cursor/` | proposed | `.cursorignore` and a `beforeReadFile` hook for the guard, hooks, subagents |
| `gemini/` | proposed | `.geminiignore`, `GEMINI.md`, experimental subagents; replaced by Antigravity CLI for some accounts since 2026-06-18 |
| `chat-only/` | proposed | discuss, grill and improve only; "never upload" is the guard |

A proposed row becomes measured after one milestone of at least five slices, or after the canary for the guard, and the retro sets it to adopted or rejected (`metrics.md`). Nothing is adopted from the documentation alone.

## Keeping the core harness-neutral
- Steps name project **commands** (`check`, `run`…) from the project instructions' Commands table, never a tool or a package manager.
- Steps name **tiers** (strong, standard, light), never a model, and briefs say `tier:` (`model:` is the old name of the field).
- Steps name a capability by its role ("a helper", "the browser pane", "the question tool", "the file-reading tool", "the harness's read guard file") and state its manual rule inline. A harness-specific passage is marked `<!-- harness:<id> -->…<!-- /harness -->` so a harness can replace it.
- Shared paths are written `<stareso>/…` (the workflow folder) and `<stareso-repo>` (the repository), and the project instructions file is `AGENTS.md`.
- Records are plain Markdown written by the tools; nothing lives only in the chat or in memory.
- After an edit, `node <stareso>/tools/harness-build.mjs` regenerates the Claude Code files, and `--check` must pass before a commit.
