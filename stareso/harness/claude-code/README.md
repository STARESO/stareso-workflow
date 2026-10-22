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

- **Brief** is the status brief laid out for a narrow dock: one aligned row per milestone with a square per slice in the colour of its state and the milestone's ETA, a two-line card per running helper (slice and title, then model, start, minutes and ETA), then the pace and what waits for you, with each slice id in the colour of its state. Longer texts are cut at the panel's edge rather than wrapped, and the plan windows are left to the Usage tab. Under the helpers, the chats of the app working in the project now (a manager, a build, a side chat) are listed for information, from the app's own session list.
- **Graph** gives one row of slices per milestone, each slice number in the colour of its state (done, running, could start now, waits on you, waiting), drawn as plain text because a desktop draws its buttons natively and drops the colours inside them. Hovering a slice gives its line. A milestone's name opens its card, which lists its slices with their titles and states, and pressing a slice there opens its own card with its state, branch, model, the slices it needs and the ones it unblocks, each pressable in turn. Under the rows, the running slices, the ones that could start now and the ones that wait on you are listed as chips, and the finished milestones can be shown again.
- **Usage** gives the plan windows with the stop caps, then the four tiles and the six charts of `/stareso-usage`, from `usage-report.mjs --live --panel`: numbers read from the transcripts as they are now, with nothing written in the project. Hovering a row gives its detail under its chart, and the tables are one button away. The report is read again while the view is open once it is five minutes old or a slice has merged, and the Refresh button reads it at once.
- The panel has its own Hide button, beside Refresh.
- **Dashboard** (a button, or `/stareso-panel dashboard`) starts `tools/dashboard.mjs` for the project and opens it in the side browser of the desktop app: the progress graph (hovering a slice lights its whole chain, pressing it opens its card) and the six usage charts drawn with Chart.js as `/stareso-usage` draws them in chat. The page fetches its numbers every minute from the small local server, which reruns the tools, so it costs no tokens. The server lives while the plugin is loaded, or stops after two idle hours when started by hand (`node ~/.claude/stareso/tools/dashboard.mjs --root <project>`, then open the address it prints).
- `/stareso-panel` opens the panel, or hides it when it is open. `/stareso-panel <project folder>` opens it on a project, remembered across sessions, and a side session that starts outside the project reads the last project any session read. `/stareso-panel graph`, `usage` or `brief` opens it on that view, and the buttons switch views.
- Graph and Usage ask for a wide dock (110 columns), and a width the person dragged wins.
- It exists only where Claude Code draws panels (desktop app, terminal, IDE extensions). Outside Claude Code, the same graph is `progress-graph.mjs --write` (an HTML page, or an Artifact).

Install once per machine, from a terminal (the desktop app has no `/plugin` command), at the user scope so it loads in every session:

```
claude plugin marketplace add ~/.claude/stareso/harness/claude-code/plugins
claude plugin install stareso-status@stareso
```

The plugin is read from this folder itself: after an edit (or a `git pull`), `/reload-plugins` in a session picks it up, with no reinstall. `claude plugin validate` and `claude plugin test` in `plugins/` check it (eight tests in `hooks/register.test.tsx`).

## Install on a new machine
1. Clone the `stareso-workflow` repository as `~/.claude` (or copy `skills/stareso-*`, `agents/stareso-*` and `stareso/` into it).
2. Merge the `hooks` block of `extras/settings.hooks.json` into `~/.claude/settings.json` (user settings). Its `permissions.deny` block is the project guard that `stareso-init` copies from `stareso/templates/settings.json`, shown here for reference.
3. Install the status panel plugin (above), if wanted.
4. Open a project and type `/stareso-status`.

Capabilities, their levels and their evidence: `capabilities.md`. Models: `models.md`.
