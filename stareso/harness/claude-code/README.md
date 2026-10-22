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

## ↗ The live status panel (plugin `stareso-status`)

A panel beside the chat that shows a project's status and refreshes it every minute while it is open, **with no model call**.
It runs `progress-graph.mjs --panel`, reads the app's 5-hour and weekly windows, and raises a toast when a slice merges, a helper starts, a helper runs past twice the usual slice time, or a usage cap comes within 15 minutes.
It is drawn with Claude Code's own elements, so the terminal draws it as well as the desktop app.

**Open it** with the `◆ stareso-status` button at the right of the prompt footer, or `/stareso-panel`.
`/stareso-panel <folder>` opens it on a project (remembered across sessions), and `/stareso-panel progress` or `usage` opens that view.

### ▶ Progress (narrow dock)

- **Tiles:** when all is done, when the next milestone is done, the build mode, slices done, slices running, the time of one slice and what waits on you, as in the Usage tab.
- **Grid:** one row of slice numbers per milestone, each after a mark in the colour of its state (■ done green, ▶ running amber, ■ could start teal, ■ waits on you purple, ■ waiting grey). A picked slice opens its card, and the numbers not linked to it go dim.
  - **Press a number for the slice's card:** its state, branch and model, what it needs and what it unblocks. The other numbers go dim, except the ones linked to it. Hovering a number previews its card under the grid, over the open card if there is one, and the pressed card stays when the pointer leaves.
  - Press a milestone's name for its card, which lists its slices.
- **Milestones:** each milestone's ETA, then its title.
- **Helpers:** one line each (slice, ETA, title), pressable for its card.
- **Chats:** the project's chats, this chat included. A chat is **active** when it works, when a step it launched works (*managing*), or when it is the build and its helpers run (*helpers*). Chats idle for over a day are left out.
- **Pace** and **what waits for you** close the view.

### 📊 Usage (wide dock)

- Four tiles, the plan windows with the stop caps (│ marks 100 %), then **seven charts** (how to read them: `metrics.md`, "The usage report").
- Charts 2, 3, 6 and 7 fold to their latest rows. **Expand** shows every row with more in each, for example each step's type, conductor and helper cost on chart 6.
- **Chart 7** compares each ETA with what the slice took, and gives the correction factor the ETAs learned.
- Hovering a row gives its detail, dates are written yyyy-mm-dd, and the tables are one button away.
- The report is read live from the transcripts, nothing is written in the project, and it refreshes after five minutes or a merge.

Outside Claude Code, `progress-graph.mjs --write` gives the same graph as an HTML page.

### 🔧 Install and update

Once per machine, from a terminal, at the user scope:

```bash
claude plugin marketplace add ~/.claude/stareso/harness/claude-code/plugins
claude plugin install stareso-status@stareso
```

Sessions load the installed copy, not this folder. After an edit:

1. Raise `version` in `stareso-status/.claude-plugin/plugin.json`.
2. `claude plugin marketplace update stareso`, then `claude plugin update stareso-status@stareso`.
3. Sessions load it at their next start or `/reload-plugins`.

`claude plugin validate` and `claude plugin test` in `plugins/` check it (nine tests in `hooks/register.test.tsx`).
When `claude` is not on the PATH, the desktop app's own copy works the same: `%LOCALAPPDATA%\Claude-Data\<…>\claude-code\<version>\<…>\claude.exe`.

## Install on a new machine
1. Clone the `stareso-workflow` repository as `~/.claude` (or copy `skills/stareso-*`, `agents/stareso-*` and `stareso/` into it).
2. Merge the `hooks` block of `extras/settings.hooks.json` into `~/.claude/settings.json` (user settings). Its `permissions.deny` block is the project guard that `stareso-init` copies from `stareso/templates/settings.json`, shown here for reference.
3. Install the status panel plugin (above), if wanted.
4. Open a project and type `/stareso-status`.

Capabilities, their levels and their evidence: `capabilities.md`. Models: `models.md`.
