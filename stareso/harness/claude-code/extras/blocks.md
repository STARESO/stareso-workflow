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

## status-run
Claude Code runs the tool while it loads the skill (a `!` command), so status answers in one turn, with no usage call: the tool takes the newest readings the panel stores.

```text
The tool already ran while this skill loaded, and its lines are just below. If the line below still shows the command itself (a session that re-read the skill), run that command once. If the session works in another folder, run it again with `--root <folder>`.

!`node <stareso>/tools/progress-graph.mjs --status --models {strong.id}/{standard.id}/{light.id}`

```

## status-panel
Claude Code shows the status in the stareso-status panel plugin (button and `/stareso-panel`), so status points to it instead of drawing a graph.

```text
`↗ panel: ◧ stareso-status or /stareso-panel`, as plain text, nothing else on the line. Never draw the graph here.
```

## build-follow
Claude Code shows a running build live in the stareso panel.

```text
the stareso panel (`◧ stareso-status` button or `/stareso-panel`) shows the slices, helpers, times and usage caps live, at no token cost.
```
