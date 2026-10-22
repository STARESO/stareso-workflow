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

- **Progress** (the Brief and Graph tabs made one) is laid out for a narrow dock. It opens with the all-done time as a heading and the build mode. Then come one row of slice numbers per milestone, each number in the colour of its state (done green, running amber, could start now teal, waits on you purple, waiting grey) and drawn as plain text because a desktop draws its buttons natively and drops the colours inside them. The rows hold the numbers alone, so they fit a narrow dock, and a Milestones list under them gives each milestone's title and ETA, as the helpers are listed. Hovering a number gives the slice's line, and a milestone's name opens its card, which lists its slices, each pressable for its own card (state, branch, model, the slices it needs and the ones it unblocks). The finished milestones fold into one line with a Show button. Under the graph, each running helper is folded to one line (slice, title, ETA) and opens its card when pressed. The app's chats in the project (a manager, a build, a side chat) are listed for information, working or idle, those idle for over a day left out, from the app's own session list. The pace and what waits for you follow, each slice id in the colour of its state. Longer texts are cut at the panel's edge rather than wrapped, and the plan windows are left to the Usage tab.
- **Usage** gives the plan windows with the stop caps, then the four tiles and the six charts of `/stareso-usage`, from `usage-report.mjs --live --panel`: numbers read from the transcripts as they are now, with nothing written in the project. Each chart's bars take the width its labels and values leave, the values are right-aligned in columns, chart 4 shows the last 12 sessions with a button for all of them, hovering a row gives its detail under its chart, and the tables are one button away. The report is read again while the view is open once it is five minutes old or a slice has merged, and the Refresh button reads it at once.
- The panel opens with a title block, the project's name in a large size and the brief's head line under it (phase, pack, branch, ideas, debt). Its own Hide button sits beside Refresh.
- **Dashboard ↗** is a button in the panel's header. The panel starts `tools/dashboard.mjs` for the project when it opens, and the button opens the page in the app's side browser when the app lets a plugin reach it, else in the system's browser (a link to a local address did nothing on a click in the desktop app). `/stareso-panel dashboard` does the same. The page shows the progress graph (hovering a slice lights its whole chain, pressing it opens its card) and the six usage charts drawn with Chart.js as `/stareso-usage` draws them in chat. The page fetches its numbers every minute from the small local server, which reruns the tools, so it costs no tokens. The server lives while the plugin is loaded, or stops after two idle hours when started by hand (`node ~/.claude/stareso/tools/dashboard.mjs --root <project>`, then open the address it prints). `dashboard.mjs --write [file.html]` writes the same page as one standalone file with the data inlined, which any browser opens without Claude or the server (in the temp folder by default, under `docs/reports/` when a dated usage report is kept).
- **◧ stareso**, a button among the mode labels at the right of the prompt footer, opens the panel or hides it, so the command need not be typed. `/stareso-panel` does the same. `/stareso-panel <project folder>` opens it on a project, remembered across sessions, and a side session that starts outside the project reads the last project any session read. `/stareso-panel progress` or `usage` opens it on that view (`graph` and `brief` open Progress), and the buttons switch views.
- Usage asks for a wide dock (110 columns), Progress is laid out for a narrow one, and a width the person dragged wins.
- It exists only where Claude Code draws panels (desktop app, terminal, IDE extensions). Outside Claude Code, the same graph is `progress-graph.mjs --write` (an HTML page, or an Artifact).

Install once per machine, from a terminal (the desktop app has no `/plugin` command), at the user scope so it loads in every session:

```
claude plugin marketplace add ~/.claude/stareso/harness/claude-code/plugins
claude plugin install stareso-status@stareso
```

Sessions load the installed copy in `~/.claude/plugins/cache/stareso/stareso-status/<version>/`, not this folder: after an edit (or a `git pull`), raise `version` in `stareso-status/.claude-plugin/plugin.json`, then run `claude plugin marketplace update stareso` and `claude plugin update stareso-status@stareso`. Every session, side sessions and subchats included, loads the new copy at its next start or `/reload-plugins`. Without the version step, they keep the old copy. `claude plugin validate` and `claude plugin test` in `plugins/` check it (nine tests in `hooks/register.test.tsx`).

## Install on a new machine
1. Clone the `stareso-workflow` repository as `~/.claude` (or copy `skills/stareso-*`, `agents/stareso-*` and `stareso/` into it).
2. Merge the `hooks` block of `extras/settings.hooks.json` into `~/.claude/settings.json` (user settings). Its `permissions.deny` block is the project guard that `stareso-init` copies from `stareso/templates/settings.json`, shown here for reference.
3. Install the status panel plugin (above), if wanted.
4. Open a project and type `/stareso-status`.

Capabilities, their levels and their evidence: `capabilities.md`. Models: `models.md`.
