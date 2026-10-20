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
