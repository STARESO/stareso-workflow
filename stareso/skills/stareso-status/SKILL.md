---
name: stareso-status
description: Where is this stareso project in its workflow and what to do next (which skill, which model, new or same session, which permission mode, the exact command), in a few short lines, with the pointer to the stareso panel. Use when the user asks for the status, is coming back to the project, or asks what to do next.
---

# stareso-status

**Session:** any model, any session. Status is the most used step, so it stays tiny: one tool call, a few reads, a few lines of answer. It never prints the progress brief, because the panel shows it. Talk in English unless the user switches to French.

## 1. Read (the few important facts only)
Argument: none. An old `graph` or `dashboard` argument only means that the panel line of §4 names the dashboard first.
1. <!-- harness:status-usage -->When the harness shows the usage windows, read them first.<!-- /harness -->
2. `node <stareso>/tools/progress-graph.mjs --brief`, with `--five <pct>@<reset>` and `--week <pct>@<reset>` from step 1 when there are readings, and `--caps <start>/<pause>/<weekly>` only when the user gave stop caps in this conversation. It reads records and git only, in well under a second, and gives facts to read, not to print: the head line (project, Phase, Pack, branch and tree, 💭 ideas, debt), the milestone lines, the helpers running, the usage and caps, the pace, what waits for you, what could start now.
3. Only when the rule table needs it: the newest block of `docs/FEEDBACK.md` (points without "→ slice") and the Tested column of the overview in `docs/ROADMAP.md`. Say if the folder is a worktree. Never read the code, the milestone briefs or the cost reports.

## 2. Work out the current step and the next one (first rule that matches)
| Situation (from the facts) | Current step | Next step |
|---|---|---|
| no `docs/PLAN.md` | not a stareso project | `/stareso-init` (empty folder) or `/stareso-retrofit` (existing project): strong tier, new session |
| `Phase: discussion` | discussing | `/stareso-discuss` (strong tier); say "let's grill" when ready |
| `Phase: grilling` | grilling, PLAN partly filled | continue `/stareso-grill` (strong tier); the walkthrough ends it |
| `Phase: setup` and no `docs/roadmap/` | plan done, no roadmap | `/stareso-setup` (strong tier) |
| helpers or a build session run on the project | building | nothing to launch (one writer per folder): wait, or follow it in the panel |
| `Phase: build`, a milestone with open slices and no `[human]` / blocking question on all of them | building M<n> | `/stareso-build M<n>` (standard tier, new session, no worktree, auto, eco) |
| a milestone fully done but its test marker is older than its last slice | built, untested | `/stareso-test` (standard tier, new session) |
| FEEDBACK has a block whose points are not yet "→ slice …" | test not segmented | reopen the test session: "end test" (or `/stareso-test` and segment) |
| an open slice says "waits on /stareso-improve", or an open question blocks every remaining slice, or PLAN has "(open: …)" | a decision is missing | `/stareso-improve` (strong tier, new session) |
| only `[human]` slices are open | waiting for you | the human steps, one by one (name them), then `/stareso-build` |
| every milestone before `H` done and tested, `Phase: build` | ready to publish or deliver | `/stareso-deploy` (strong tier, new session) |
| `Phase: deployed` / `delivered` / `released` and nothing open | in use | `/stareso-improve` for new ideas, `/stareso-test` for feedback from phones or readers |

## 3. Retro
A retro (`/stareso-retro [quick | deep]`) runs only when the user asks for it: never suggest it from status.

## 4. Answer: 5 to 8 short lines of plain text
No code block, no table, no heading, no copy of the brief, no workflow line. One fact per line, a small symbol first, at most about 100 characters a line, numbers instead of sentences. The symbols: ▶ the next step, ■ done, □ waiting, ⚠ a blocker, ↗ the panel, 💭 ideas.
1. **Head**: project, the current step in **bold**, and the one number that matters.
2. **Blockers and waits**, only those that exist: `⚠` a blocker, or a usage cap that comes within the hour (window, percent, time), `□` what waits for you (count and a few ids), `💭` the ideas count when there are any, `■` what just finished when it matters.
3. **`▶ Next`**: the skill, the **model** (the tier of §2), **new or same session**, the **permission mode** (auto for build only) and the profile of a build (eco unless speed matters), then the exact command to type in a code span, or the launch question of §5 when this session can launch it. The one next step only, never a menu.
4. **`↗ Panel`**: <!-- harness:status-panel -->this harness has no panel: `node <stareso>/tools/progress-graph.mjs --write` writes the progress page and `usage-report.mjs` the usage report.<!-- /harness --> One line says what the panel holds, so that nothing of it is repeated above: milestones with their times, helpers, pace and what waits for you (Progress), the plan windows and six usage charts (Usage), and the charts in a browser on request (dashboard).

Example, written as plain lines (a build is running, a cap is in sight):
```
proj · **build** M11 7/13 · 3 helpers · all done ≈ 21:13
⚠ 5-hour window 41 % (+20 %/h): the pause cap comes ≈ 23:02
□ waits on you: 9 [human] slices (H.1 …), 12 questions, none blocking · 💭 19
▶ Next: wait for the build, then `/stareso-test` (Sonnet, new session, default mode)
↗ Panel: ◧ stareso button or `/stareso-panel` (Progress, Usage), `/stareso-panel dashboard` for browser charts
```

## 5. Launch from this session (manager)
The session that runs status can act as the project's manager: it stays open, and each step runs in its own new session. This applies to build, test and improve. Init, retrofit and deploy stay typed by the user in a session they open.
1. End the `▶ Next` line with the question: launch it in a new session? For a build, the same question offers the relay (start the test, then the next milestone, without asking again).
2. Before launching a build, refresh the records (`node <stareso>/tools/session-stats.mjs --log`, commit `docs/data/`), so that earlier sessions are logged and the tree is clean for `slice-done`.
3. One writer per checkout: never launch a step while another session or a helper works in the same folder.
4. On the user's yes, start the step in the project folder without a worktree, with the step's tier and permission mode. The launch message names the step and its arguments and says that the manager launched it on the user's go. It carries nothing else, because the step reads the files.
5. An idle child that finished its step is reused for the next one when the folder, tier and mode are the same, which keeps the list of sessions short.
6. When a child ends with `MILESTONE DONE` or `STEP DONE`, tell the user in one line, and launch the step it names only when the user accepted the relay. On `RUN STOPPED`, report the reason and launch nothing.
7. <!-- harness:manager-launch -->When the harness cannot start sessions, stop at the command to type: the user opens a new session and types it.<!-- /harness -->
8. A child that says its own permission check refused something that the manager relayed: the manager cannot grant it for the child. Give the user the exact sentence to type into that child session, and do not retry.
9. In `day` mode the idle gate holds the windowed shots while the user chats with the manager. Say so before launching, and when the user wants speed offer the profiles of the pack's `mode.available` that fit (`night` or `fast`).
10. When a launch needs an improve branch merged into main, merge only when the main folder is clean and on main (no slice branch checked out, no running engine). The datasets in `docs/data/` merge by union (both sides kept). In ROADMAP conflicts keep both sides, then regenerate the overview with `roadmap-overview.mjs`.
11. A reference photo or any other binary file the user sends in chat goes to a git-ignored folder of the project (add the ignore first). Pass it to the build session by path and description, never inline.
