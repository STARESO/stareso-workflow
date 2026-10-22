---
name: stareso-status
description: Where is this stareso project in its workflow, what is the current step, what is the next one (which skill, which model, which session), and whether a workflow review is due. Use when the user asks for the status, is coming back to the project, or asks what to do next.
---

# stareso-status

**Session:** any model, any session. Cheap: read only the files below, never the code or the milestone briefs. Talk in English unless the user switches to French.

## 1. Read (fast: status is the most used step)
Argument: none (fast status, a text graph) or `graph` (the same, plus the drawn graph of §4).
1. <!-- harness:status-usage -->When the harness shows the usage windows, read them first.<!-- /harness -->
2. `node <stareso>/tools/progress-graph.mjs --brief` with `--five <pct>@<reset>` and `--week <pct>@<reset>` from step 1 when there are readings, and `--caps <start>/<pause>/<weekly>` only when the user gave stop caps in this conversation (a build writes its own in BUILD-LOG). It prints the brief: the head line (project, Phase, Pack, branch and tree, 💭 ideas, debt, open points of PLAN), then short sections: Progress (the text graph, one line per milestone with open slices), Helpers (one line each), Usage (burn rate, when each cap is reached, resets), Pace, Waits for you, Could start now. Records and git only. Detail: README, "The progress graph".
3. Only what the brief does not give, and only when the rule table needs it: `docs/FEEDBACK.md` (date of the newest block, points without "→ slice"), the overview's Tested column in `docs/ROADMAP.md`, the Totals row and the last `### Retro` of `docs/USAGE.md`. Say if the folder is a worktree.

## 2. Work out the current step and the next one (first rule that matches)
| Situation (from the files) | Current step | Next step |
|---|---|---|
| no `docs/PLAN.md` | not a stareso project | `/stareso-init` (empty folder) or `/stareso-retrofit` (existing project): strong tier, new session |
| `Phase: discussion` | discussing | `/stareso-discuss` (strong tier); say "let's grill" when ready |
| `Phase: grilling` | grilling, PLAN partly filled | continue `/stareso-grill` (strong tier); the walkthrough ends it |
| `Phase: setup` and no `docs/roadmap/` | plan done, no roadmap | `/stareso-setup` (strong tier) |
| `Phase: build`, a milestone with open slices and no `[human]` / blocking question on all of them | building M<n> | `/stareso-build M<n>` (standard tier, new session, no worktree, auto, eco) |
| a milestone fully done but its test marker is older than its last slice | built, untested | `/stareso-test` (standard tier, new session) |
| FEEDBACK has a block whose points are not yet "→ slice …" | test not segmented | reopen the test session: "end test" (or `/stareso-test` and segment) |
| an open slice says "waits on /stareso-improve", or an open question blocks every remaining slice, or PLAN has "(open: …)" | a decision is missing | `/stareso-improve` (strong tier, new session) |
| only `[human]` slices are open | waiting for you | the human steps, one by one (name them), then `/stareso-build` |
| every milestone before `H` done and tested, `Phase: build` | ready to publish or deliver | `/stareso-deploy` (strong tier, new session) |
| `Phase: deployed` / `delivered` / `released` and nothing open | in use | `/stareso-improve` for new ideas; `/stareso-test` for feedback from phones or readers |

## 3. Retro
A retro (`/stareso-retro [quick | deep]`) runs only when the user asks for it: never suggest it after a test or from status. Mention it only if the user asks what is left to improve in the workflow.


## 4. Answer: the brief, then at most six lines
1. **The brief** in a code block, exactly as the tool printed it: the head line, then the sections Progress (the text graph), Helpers (one line each: slice, model, minutes, title), Usage, Pace, Waits for you, Could start now. Never recompute or reword it, and drop nothing.
2. Then, under it, at most six lines:
   - the workflow line with the current step in **bold**: `init → discuss → grill → setup → build ⇄ test → improve → deploy` (manual: `<stareso>/README.md`);
   - what the brief cannot say, one line each and only when it applies: a FEEDBACK block not yet segmented, a milestone built but untested, the cost so far from the USAGE Totals row, the workflow review line of §3;
   - **the one next step**: the skill, the **model**, **new or same session**, **permission mode** (auto for build only), the profile for a build (eco unless speed matters), and the exact command to type, or the launch question of §5.
**With the argument `graph`** only: <!-- harness:status-graph -->also write the page with `--write` and give its path.<!-- /harness -->

## 5. Launch from this session (manager)
The session that runs status can act as the project's manager: it stays open, and each step runs in its own new session. This applies to build, test and improve. Init, retrofit and deploy stay typed by the user in a session they open.
1. End the answer with one question: launch the next step in a new session? For a build, the same question offers the relay (start the test, then the next milestone, without asking again).
2. Before launching a build, refresh the records (`node <stareso>/tools/session-stats.mjs --log`, commit `docs/USAGE.md`), so that earlier sessions are logged and the tree is clean for `slice-done`.
3. One writer per checkout: never launch a step while another session or a helper works in the same folder.
4. On the user's yes, start the step in the project folder without a worktree, with the step's tier and permission mode. The launch message names the step and its arguments and says that the manager launched it on the user's go. It carries nothing else, because the step reads the files.
5. An idle child that finished its step is reused for the next one when the folder, tier and mode are the same, which keeps the list of sessions short.
6. When a child ends with `MILESTONE DONE` or `STEP DONE`, tell the user in one line, and launch the step it names only when the user accepted the relay. On `RUN STOPPED`, report the reason and launch nothing.
7. <!-- harness:manager-launch -->When the harness cannot start sessions, stop at the command to type: the user opens a new session and types it.<!-- /harness -->
8. A child that says its own permission check refused something that the manager relayed: the manager cannot grant it for the child. Give the user the exact sentence to type into that child session, and do not retry.
9. In `day` mode the idle gate holds the windowed shots while the user chats with the manager. Say so before launching, and when the user wants speed offer the profiles of the pack's `mode.available` that fit (`night` or `fast`).
10. When a launch needs an improve branch merged into main, merge only when the main folder is clean and on main (no slice branch checked out, no running engine). In BUILD-LOG and ROADMAP conflicts keep both log lines, then regenerate the overview with `roadmap-overview.mjs`.
11. A reference photo or any other binary file the user sends in chat goes to a git-ignored folder of the project (add the ignore first). Pass it to the build session by path and description, never inline.
