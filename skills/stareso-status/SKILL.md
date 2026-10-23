---
name: stareso-status
description: Where is this stareso project in its workflow and what to do next (which skill, which model, new or same session, which permission mode, the exact command), in a few short lines, with the pointer to the stareso panel. Use when the user asks for the status, is coming back to the project, or asks what to do next.
allowed-tools: Bash(node ~/.claude/stareso/tools/progress-graph.mjs:*)
---

# stareso-status

**Session:** any model, any session. Status is the most used step, so it costs one turn: the tool computes the answer, the model only passes it on. It never prints the progress brief, because the panel shows it. Talk in English unless the user switches to French.

## 1. The status lines
Argument: none, a project folder (then add `--root <folder>`), or a title the user wants on the first line (then add `--title "<title>"`, or replace the first line when the tool already ran). The first line is the folder name by default. An old `graph` argument is ignored.
The tool already ran while this skill loaded, and its lines are just below. If the line below still shows the command itself (a session that re-read the skill), run that command once. If the session works in another folder, run it again with `--root <folder>`.

!`node ~/.claude/stareso/tools/progress-graph.mjs --status --models opus/sonnet/haiku`

The tool reads PLAN, the roadmap, QUESTIONS, the newest FEEDBACK block, the build records, git and the newest stored usage readings (the panel stores them while it is open), in about half a second, applies the table of §2 and prints the answer. Read nothing else, and never the code, the briefs or the cost reports, unless the user asks a question the lines do not answer.

## 2. The rule table (the tool applies it, first rule that matches)
| Situation (from the facts) | Current step | Next step |
|---|---|---|
| no `docs/PLAN.md` | not a stareso project | `/stareso-init` (empty folder) or `/stareso-retrofit` (existing project): Opus, new session |
| `Phase: discussion` | discussing | `/stareso-discuss` (Opus); say "let's grill" when ready |
| `Phase: grilling` | grilling, PLAN partly filled | continue `/stareso-grill` (Opus); the walkthrough ends it |
| `Phase: setup` and no `docs/roadmap/` | plan done, no roadmap | `/stareso-setup` (Opus) |
| helpers run on the project (slice branches) | building | nothing to launch (one writer per folder): wait, or follow it in the panel |
| `Phase: build`, a milestone with open slices and no `[human]` / blocking question on all of them | building M<n> | `/stareso-build M<n>` (Sonnet, new session, no worktree, auto, eco) |
| a milestone fully done but its test marker is older than its last slice | built, untested | `/stareso-test` (Sonnet, new session) |
| FEEDBACK has a block whose points are not yet "→ slice …" | test not segmented | reopen the test session: "end test" (or `/stareso-test` and segment) |
| an open slice says "waits on /stareso-improve", or an open question blocks every remaining slice, or PLAN has "(open: …)" | a decision is missing | `/stareso-improve` (Opus, new session) |
| only `[human]` slices are open | waiting for you | the human steps, one by one (name them), then `/stareso-build` |
| every milestone before `H` done and tested, `Phase: build` | ready to publish or deliver | `/stareso-deploy` (Opus, new session) |
| `Phase: deployed` / `delivered` / `released` and nothing open | in use | `/stareso-improve` for new ideas, `/stareso-test` for feedback from phones or readers |

## 3. Retro
A retro (`/stareso-retro [quick | deep]`) runs only when the user asks for it: never suggest it from status.

## 4. Answer: the tool's lines, then one line
1. Print the tool's lines as they are, as plain lines (no code block, no bold, nothing added or reworded): the project name alone on the first line, then the head (step, build mode, the number that matters) on the line under it, `⚠` a slice blocked by a question, then one line per usage window (5-hour, weekly) when a cap matters now, `□` what waits on you, `▶` the next step with its model, session and permission mode.
2. When `▶` names `/stareso-build`, `/stareso-test` or `/stareso-improve`, this session can start sessions and is not itself running a step (§5), end that line with "launch it in a new session?" (§5).
3. Then the `↗` line: `↗ panel: ◆ stareso-status or /stareso-panel`, as plain text, nothing else on the line. Never draw the graph here.
4. Say nothing more. When the name line says "(worktree)", add that a build must run in the main folder.

Example (a build is running):
```
proj
build M11 7/13 · fast · ends ≈ 21:18
⚠ 5-hour 53 %: helper-start cap 85 % ≈ 23:18
⚠ weekly 82 %: cap 95 % ≈ 03:57 tomorrow
□ 9 human slices, 12 questions wait on you
▶ after M11: `/stareso-test` (sonnet, new session)
↗ panel: ◆ stareso-status or /stareso-panel
```

## 5. Launch from this session (general manager)
Status can be asked in any session, a conductor's included, and **does not make that session a manager**. A session becomes the project's **general manager** by launching a step: either the user accepts the launch offered by status in a session that is free to launch, or the user types build, test or improve in a session that already carries another step or a long chat (the Hand-over paragraph of those skills; the typed command is then the go and nothing is asked). A session that is itself running a step (a conductor, a test or improve session) answers status with the lines only: no launch offer, since one writer owns the folder. Each step it launches is a **conductor** (the build, test or improve session), which runs helpers. The usage records keep the step type `manager`. The general manager stays open, and each step runs in its own new session. This applies to build, test and improve. Init, retrofit and deploy stay typed by the user in a session they open.
1. End the `▶ Next` line with the question: launch it in a new session? For a build, the same question offers the relay (start the test, then the next milestone, without asking again).
2. Before launching a build, refresh the records (`node ~/.claude/stareso/tools/session-stats.mjs --log`, commit `docs/data/`), so that earlier sessions are logged and the tree is clean for `slice-done`.
3. One writer per checkout: never launch a step while another session or a helper works in the same folder.
4. On the user's yes (or the typed command), start the step in the project folder without a worktree, with the step's tier and permission mode. The launch message names the step and its arguments and says that the manager launched it on the user's go. It carries nothing else, because the step reads the files.
5. An idle child that finished its step is reused for the next one when the folder, tier and mode are the same, which keeps the list of sessions short.
6. To check a conductor, never read its flag "idle" as stopped, since it waits for a helper. Send it `STATUS?` (`SendMessage`) and relay its one-line `STATUS` reply (build's "Status reply") in one short line: running or stopped, helpers working, helpers planned next. Do not read its transcript.
6b. When a child ends with `MILESTONE DONE` or `STEP DONE`, tell the user in one line, and launch the step it names only when the user accepted the relay. On `RUN STOPPED`, report the reason and launch nothing.
7. In Claude Code, start the child with `start_session`: `initiation` "user_asked", `context` "fresh", `use_worktree` false, `model` from the step's tier, `permission_mode` "auto" for a build and "default" otherwise, a short `name` such as `build-m3`, `wake_when_done` true. The `prompt` is the launch message, for example "Run the skill stareso-build with arguments `M3 eco`. Launched by the manager session on the user's go.", and `background` names the project folder and the step. A child gets at most the manager's model and permission mode: when the manager runs a cheaper model than the step's tier, or a lower mode than auto for a build, start the child anyway and show the card that raises it (`set_session_permission_mode`, `set_session_model`), or give the command to type when the card is refused. To reuse an idle child, `clear_session`, then `SendMessage` with the same launch message.
8. A child that says its own permission check refused something that the manager relayed: the manager cannot grant it for the child. Give the user the exact sentence to type into that child session, and do not retry.
9. In `day` mode the idle gate holds the windowed shots while the user chats with the manager. Say so before launching, and when the user wants speed offer the profiles of the pack's `mode.available` that fit (`night` or `fast`).
10. When a launch needs an improve branch merged into main, merge only when the main folder is clean and on main (no slice branch checked out, no running engine). The datasets in `docs/data/` merge by union (both sides kept). In ROADMAP conflicts keep both sides, then regenerate the overview with `roadmap-overview.mjs`.
11. A reference photo or any other binary file the user sends in chat goes to a git-ignored folder of the project (add the ignore first). Pass it to the build session by path and description, never inline.
12. Clear the manager at each milestone end. Its cost per turn is mostly the cache reads of its own growing context, and all the state is in the files, so a cleared session that runs status again loses nothing. When a milestone is done, say so in the line that reports it and suggest clearing this session (or a new one) before the next launch. The usage records count this work, the status call that opened it included, as the `manager` step type.
