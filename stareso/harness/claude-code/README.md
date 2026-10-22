# Claude Code

The workflow was built and measured on Claude Code, so every capability here is adopted. The steps and helpers Claude Code runs are generated, self-contained files:

| Generated | From |
|---|---|
| `~/.claude/skills/stareso-*/SKILL.md` | `stareso/skills/<name>/SKILL.md` + `extras/skill-frontmatter.json` + `extras/wording.md` + `extras/blocks.md` + `models.md` |
| `~/.claude/agents/stareso-slice-builder.md`, `stareso-slice-checker.md` | `stareso/roles/<role>.md` + `extras/agent-heads.json` (tools) + `models.md` (the `tier:` line becomes `model:`) |

`node ~/.claude/stareso/tools/harness-build.mjs` writes them and prints each file's length before and after. With `--check` it writes nothing and exits 1 when a generated file differs from the core or when a mapping no longer fires. The `workflow-changed` hook runs that check whenever the repository moves, and tells the session when the generated files are stale.

**Edit the core, never the generated files.** A change to a step goes into `stareso/skills/<name>/SKILL.md` in neutral wording (tiers, `AGENTS.md`, `<stareso>`, "the browser's server start"), then the build. Claude Code wording that the core cannot carry goes into `extras/wording.md` (a phrase) or `extras/blocks.md` (a passage marked `<!-- harness:<id> -->` in the core).

## What the build guarantees
- No generated step or helper needs `capabilities/`, `harness/` or `models.md` at run time: tier words are replaced by model names, the read-guard install and the tier alias are written inline, and the manual fallbacks Claude Code does not need (helpers, browser) are left out.
- The paths stay `~/.claude/stareso/...`, as before the split.
- The generated files keep their length within about 5 % (the 2026-10-20 split: nine files identical, four grew by the canary, the retro's harness line and the tier alias).

## The live status panel (plugin `stareso-status`)

`plugins/` is a local plugin marketplace (`plugins/.claude-plugin/marketplace.json`) holding one Claude Code plugin, `stareso-status`: a panel beside the chat that shows the status of a project and refreshes it every minute while it is open, with no model call. It runs `progress-graph.mjs --panel`, reads the app's 5-hour and weekly windows when the app allows it, and raises toasts when a slice merges, a helper starts, a helper runs past twice the usual slice time, or a usage cap comes within 15 minutes. Everything is drawn with Claude Code's own elements, so the terminal draws it as well as the desktop app.

- **Brief** is the status brief as text, with a start time and an ETA for each running helper.
- **Graph** gives one row of slices per milestone, coloured by state (done, running, could start now, waits on you, waiting). Hovering a slice gives its line, and pressing it opens its card with its state, branch, model, the slices it needs and the ones it unblocks, each pressable in turn. A milestone's name opens its own card. Under the rows, the running slices, the ones that could start now and the ones that wait on you are listed as chips, and the finished milestones can be shown again.
- **Usage** gives the plan windows with the stop caps, then the four tiles and the six charts of `/stareso-usage`, from `usage-report.mjs --live --panel`: numbers read from the transcripts as they are now, with nothing written in the project. Hovering a row gives its detail under its chart, and the tables are one button away. The report is read again while the view is open once it is five minutes old or a slice has merged, and the Refresh button reads it at once.
- In a session whose folder is a stareso project, a band above the prompt gives the helpers running, the slices left and the ETA, with a **Panel** button that opens or hides the panel. While the panel is hidden, that status is read again every five minutes at most. The panel has its own Hide button.
- `/stareso-panel` opens the panel, or hides it when it is open. `/stareso-panel <project folder>` opens it on a project, remembered across sessions, and a side session that starts outside the project reads the last project any session read. `/stareso-panel graph`, `usage` or `brief` opens it on that view, and the buttons switch views.
- Graph and Usage ask for a wide dock (110 columns), and a width the person dragged wins.
- It exists only where Claude Code draws panels (desktop app, terminal, IDE extensions). Outside Claude Code, the same graph is `progress-graph.mjs --write` (an HTML page, or an Artifact).

Install once per machine, from a terminal (the desktop app has no `/plugin` command), at the user scope so it loads in every session:

```
claude plugin marketplace add ~/.claude/stareso/harness/claude-code/plugins
claude plugin install stareso-status@stareso
```

The plugin is read from this folder itself: after an edit (or a `git pull`), `/reload-plugins` in a session picks it up, with no reinstall. `claude plugin validate` and `claude plugin test` in `plugins/` check it (seven tests in `hooks/register.test.tsx`).

## Install on a new machine
1. Clone the `stareso-workflow` repository as `~/.claude` (or copy `skills/stareso-*`, `agents/stareso-*` and `stareso/` into it).
2. Merge the `hooks` block of `extras/settings.hooks.json` into `~/.claude/settings.json` (user settings). Its `permissions.deny` block is the project guard that `stareso-init` copies from `stareso/templates/settings.json`, shown here for reference.
3. Install the status panel plugin (above), if wanted.
4. Open a project and type `/stareso-status`.

Capabilities, their levels and their evidence: `capabilities.md`. Models: `models.md`.
