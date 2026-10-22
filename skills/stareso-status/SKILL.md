---
name: stareso-status
description: Where is this stareso project in its workflow, what is the current step, what is the next one (which skill, which model, which session), and whether a workflow review is due. Use when the user asks for the status, is coming back to the project, or asks what to do next.
---

# stareso-status

**Session:** any model, any session. Cheap: read only the files below, never the code or the milestone briefs. Talk in English unless the user switches to French.

## 1. Read
1. `docs/PLAN.md`: the `Phase:` and `Pack:` lines (and any "(open: …)" left by the grilling).
2. `docs/ROADMAP.md`: the overview tables only (milestones with Kind, done / total, tested up to; the open slices with their flags).
3. `docs/QUESTIONS.md`: open questions (which slices they block) and `[debt]` lines. `docs/IDEAS.md`: number of 💭 lines. `docs/FEEDBACK.md`: date of the newest block and whether it still has unsegmented points. `docs/BUILD-LOG.md`: last line. `docs/USAGE.md`: the Totals table and the last `### Retro` entry (its date and its "next retro" line), if the file exists.
4. `git status` (one line), the current branch; say if the folder is a worktree.
5. `node ~/.claude/stareso/tools/progress-graph.mjs --write`: one JSON (lanes, running helpers, `mode`, `ready` slices, `humanSlices`, `questions`, `pace`, `text`, `files`) from the records and `git worktree list` only. Detail: README, "The progress graph".

## 2. Work out the current step and the next one (first rule that matches)
| Situation (from the files) | Current step | Next step |
|---|---|---|
| no `docs/PLAN.md` | not a stareso project | `/stareso-init` (empty folder) or `/stareso-retrofit` (existing project): Opus, new session |
| `Phase: discussion` | discussing | `/stareso-discuss` (Opus); say "let's grill" when ready |
| `Phase: grilling` | grilling, PLAN partly filled | continue `/stareso-grill` (Opus); the walkthrough ends it |
| `Phase: setup` and no `docs/roadmap/` | plan done, no roadmap | `/stareso-setup` (Opus) |
| `Phase: build`, a milestone with open slices and no `[human]` / blocking question on all of them | building M<n> | `/stareso-build M<n>` (Sonnet, new session, no worktree, auto, eco) |
| a milestone fully done but its test marker is older than its last slice | built, untested | `/stareso-test` (Sonnet, new session) |
| FEEDBACK has a block whose points are not yet "→ slice …" | test not segmented | reopen the test session: "end test" (or `/stareso-test` and segment) |
| an open slice says "waits on /stareso-improve", or an open question blocks every remaining slice, or PLAN has "(open: …)" | a decision is missing | `/stareso-improve` (Opus, new session) |
| only `[human]` slices are open | waiting for you | the human steps, one by one (name them), then `/stareso-build` |
| every milestone before `H` done and tested, `Phase: build` | ready to publish or deliver | `/stareso-deploy` (Opus, new session) |
| `Phase: deployed` / `delivered` / `released` and nothing open | in use | `/stareso-improve` for new ideas; `/stareso-test` for feedback from phones or readers |

## 3. Retro
A retro (`/stareso-retro [quick | deep]`) runs only when the user asks for it: never suggest it after a test or from status. Mention it only if the user asks what is left to improve in the workflow.


## 4. Answer, at most twelve lines, then the graph
1. The workflow line with the current step in **bold**: `init → discuss → grill → setup → build ⇄ test → improve → deploy` (manual: `~/.claude/stareso/README.md`).
2. Phase, pack, progress (milestones done / open, open slices count), open questions and debt, what waits for you.
3. Cost so far from the USAGE Totals table (project row: sessions, turns, ≈ equiv), one line.
4. **The one next step**: the skill, the **model**, **new or same session**, **permission mode** (auto for build only), the profile for a build (eco unless speed matters), and the exact command to type, or the launch question of §5.
5. The workflow review line of step 3 when due; otherwise nothing.

Then these lines, **one line each and only when the data exists** (they count in the twelve):
- **Running now:** the helpers of `running` (slice ids) and the build `mode` (`label`: profile and helper count, the profiles the pack allows are in `mode.available`), plus the other sessions working in the folder.
- **Usage:** the 5-hour and weekly windows (`get_usage`: percent used and reset time), next to the stop caps the user gave for the build (a time limit, a percent of a window).
- **Pace:** from `pace`, for example "17 min per merged slice, about 9 h for 31 slices in a row, the longest chain alone 3.4 h". Chains cannot be parallelised, so more helpers shorten the run only across independent slices.
- **Waits for you:** `humanSlices`, the blocking `questions`, the number of open ones, and anything only the user can do.
- **Could start now:** the `ready` slices that have no helper. When none is ready and helpers run, say that everything waits on a chain.

**The graph** is an addition, not counted in the twelve lines. Draw it, in this order. (1) With `mcp__visualize__show_widget` (load `mcp__visualize__read_me` once first): pass the content of `files.widget` as `widget_code`, title `build_progress`, with no text of its own inside the widget. (2) Otherwise, with the Artifact tool: publish `files.html` as a page, and give its link. (3) Otherwise print the `text` lines of the JSON in a code block (one line per lane, ■ done, ▶ a helper is running, □ waiting). The sessions of the project come from `list_sessions`.

## 5. Launch from this session (manager)
The session that runs status can act as the project's manager: it stays open, and each step runs in its own new session. This applies to build, test and improve. Init, retrofit and deploy stay typed by the user in a session they open.
1. End the answer with one question: launch the next step in a new session? For a build, the same question offers the relay (start the test, then the next milestone, without asking again).
2. Before launching a build, refresh the records (`node ~/.claude/stareso/tools/session-stats.mjs --log`, commit `docs/USAGE.md`), so that earlier sessions are logged and the tree is clean for `slice-done`.
3. One writer per checkout: never launch a step while another session or a helper works in the same folder.
4. On the user's yes, start the step in the project folder without a worktree, with the step's tier and permission mode. The launch message names the step and its arguments and says that the manager launched it on the user's go. It carries nothing else, because the step reads the files.
5. An idle child that finished its step is reused for the next one when the folder, tier and mode are the same, which keeps the list of sessions short.
6. When a child ends with `MILESTONE DONE` or `STEP DONE`, tell the user in one line, and launch the step it names only when the user accepted the relay. On `RUN STOPPED`, report the reason and launch nothing.
7. In Claude Code, start the child with `start_session`: `initiation` "user_asked", `context` "fresh", `use_worktree` false, `model` from the step's tier, `permission_mode` "auto" for a build and "default" otherwise, a short `name` such as `build-m3`, `wake_when_done` true. The `prompt` is the launch message, for example "Run the skill stareso-build with arguments `M3 eco`. Launched by the manager session on the user's go.", and `background` names the project folder and the step. A child gets at most the manager's model and permission mode: when the manager runs a cheaper model than the step's tier, or a lower mode than auto for a build, start the child anyway and show the card that raises it (`set_session_permission_mode`, `set_session_model`), or give the command to type when the card is refused. To reuse an idle child, `clear_session`, then `SendMessage` with the same launch message.
8. A child that says its own permission check refused something that the manager relayed: the manager cannot grant it for the child. Give the user the exact sentence to type into that child session, and do not retry.
9. In `day` mode the idle gate holds the windowed shots while the user chats with the manager. Say so before launching, and when the user wants speed offer the profiles of the pack's `mode.available` that fit (`night` or `fast`).
10. When a launch needs an improve branch merged into main, merge only when the main folder is clean and on main (no slice branch checked out, no running engine). In BUILD-LOG and ROADMAP conflicts keep both log lines, then regenerate the overview with `roadmap-overview.mjs`.
11. A reference photo or any other binary file the user sends in chat goes to a git-ignored folder of the project (add the ignore first). Pass it to the build session by path and description, never inline.
