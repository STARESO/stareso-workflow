# Claude Code blocks

A core step marks a harness-dependent passage as `<!-- harness:<id> -->neutral text<!-- /harness -->`. Other harnesses read the neutral text as it is. `tools/harness-build.mjs` replaces the whole passage with the fenced text of the section named `<id>` below (an empty fence removes it). `{tier-map}` and `{<tier>.id}` are filled from `../models.md`.

## read-guard-install
The deny rules of the project's settings file are Claude Code's read guard (`capabilities/read-guard.md`).

```text
Copy `templates/settings.json` to `.claude/settings.json` (for `analysis-r` add `Read(./data/raw/**)` and `Read(./data/processed/**)` to the deny list), 
```

## tier-alias
Briefs written on another harness say `tier:`. The conductor maps it to the subagent's model.

```text
; a `tier:` line: {tier-map}
```

## helpers-fallback
Claude Code has subagents (`capabilities/helpers.md`, mode subagent), so the build step does not carry the manual fallback.

```text
```

## browser-fallback
Claude Code has the browser pane, so the checker does not carry the manual fallback.

```text
```

## manager-launch
Claude Code starts and reuses sessions from the app, so status carries the exact calls.

```text
In Claude Code, start the child with `start_session`: `initiation` "user_asked", `context` "fresh", `use_worktree` false, `model` from the step's tier, `permission_mode` "auto" for a build and "default" otherwise, a short `name` such as `build-m3`, `wake_when_done` true. The `prompt` is the launch message, for example "Run the skill stareso-build with arguments `M3 eco`. Launched by the manager session on the user's go.", and `background` names the project folder and the step. A child gets at most the manager's model and permission mode: when the manager runs a cheaper model than the step's tier, or a lower mode than auto for a build, start the child anyway and show the card that raises it (`set_session_permission_mode`, `set_session_model`), or give the command to type when the card is refused. To reuse an idle child, `clear_session`, then `SendMessage` with the same launch message.
```

## status-usage
Claude Code reads the plan limits through the session tool `get_usage`.

```text
the 5-hour and weekly windows (`get_usage`: percent used and reset time),
```

## status-graph
Claude Code draws the graph with the visualize tool, and falls back to a page or to text.

```text
Draw it, in this order. (1) With `mcp__visualize__show_widget` (load `mcp__visualize__read_me` once first): pass the content of `files.widget` as `widget_code`, title `build_progress`, with no text of its own inside the widget. (2) Otherwise, with the Artifact tool: publish `files.html` as a page, and give its link. (3) Otherwise print the `text` lines of the JSON in a code block (one line per lane, ■ done, ▶ a helper is running, □ waiting). The sessions of the project come from `list_sessions`.
```
