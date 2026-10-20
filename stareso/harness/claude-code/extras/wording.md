# Claude Code wording

`tools/harness-build.mjs` replaces each core phrase on the left with the Claude Code phrase on the right, longest first, in every step and role. Model names never appear here: tier words are mapped from `../models.md` after this table. A phrase that no longer occurs in the core makes the build warn, so this table cannot drift silently.

| Core | Claude Code |
|---|---|
| <stareso-repo> | ~/.claude |
| <stareso> | ~/.claude/stareso |
| AGENTS.md | CLAUDE.md |
| (<harness>, | (claude-code, |
| the assistant | Claude |
| a worktree folder | `.claude/worktrees/` |
| the browser's launch file | `.claude/launch.json` |
| the browser's server start | `preview_start` |
| the browser's server stop | `preview_stop` |
| the file-reading tool | the Read tool |
| the file-editing tool | the Edit tool |
| the harness's read guard file | `.claude/settings.json` |
| the harness's model picker | the app's model menu or with `/model` |
| (in the connector settings) | (`+` menu → Connectors) |
| the usage window | the plan's 5-hour window |
| tier from the brief | model from the brief |
| · <model> · 42k | · {standard.id} · 42k |
