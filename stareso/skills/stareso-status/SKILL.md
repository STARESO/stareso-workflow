---
name: stareso-status
description: Where is this stareso project in its workflow and what to do next (which skill, which model, new or same session, which permission mode, the exact command), in a few short lines, with the pointer to the stareso panel. Use when the user asks for the status, is coming back to the project, or asks what to do next.
---

# stareso-status

**Session:** any model, any session. Status is the most used step, so it stays tiny: one tool call, a few reads, three to five lines of answer. It never prints the progress brief, because the panel shows it. Talk in English unless the user switches to French.

## 1. Read (the few important facts only)
Argument: none. An old `graph` or `dashboard` argument only means that the `↗` line of §4 names the dashboard.
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

## 4. Answer: 3 to 5 short lines, nothing more
Plain lines, each under about 60 characters so none wraps, a symbol first: ▶ next, ⚠ blocker, □ waits on you, ↗ panel. No code block, table, heading, bold, `·` chains of facts (the head line excepted), ids lists or counts the panel already shows (ideas, debt, done milestones, helpers, pace, rates). Everything else is in the panel, so leave it out.
1. **Head**: project, the step, the current mode, the one number that matters. For a build: milestone done/total, the profile in use (`eco`, `fast`, `night` or `day`, from the brief's Helpers line or the newest merge) and the end time.
2. **`⚠`**, only when it changes what to do now: a blocker, or the usage cap the run reaches first (window, percent, time). One line at most.
3. **`□`**, only when something waits on the user: the counts alone.
4. **`▶`**: the command to type, then in brackets the model and new or same session, plus the permission mode only when it is not the default (auto for a build) and, for a build, the profile chosen (eco unless speed matters). The only code span of the answer. When this session can launch it, the launch question of §5 instead.
5. **`↗`**: <!-- harness:status-panel -->this harness has no panel: `node <stareso>/tools/progress-graph.mjs --write` writes the progress page.<!-- /harness -->

Example (a build is running):
```
proj · build M11 7/13 · fast · ends ≈ 21:18
⚠ weekly cap 95 % ≈ 03:13
□ 9 human slices, 12 questions wait on you
▶ after M11: `/stareso-test` (Sonnet, new session)
↗ panel: ◧ stareso or /stareso-panel
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
