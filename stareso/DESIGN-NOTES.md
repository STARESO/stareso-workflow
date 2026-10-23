# Design notes: why the workflow is built this way

Decisions taken on 2026-10-17 while designing the workflow (in a project A session), with the reasons, so they are not re-argued later.

1. **Skills plus one shared folder.** Personal skills work in every project and load only when used. The shared material (guide, grilling rules, templates) sits in `~/.claude/stareso-app/`, which is not a skill, so it costs nothing in sessions that do not use it.
2. **Guide = defaults, not rules.** It describes the patterns of projects A and B; the grilling decides what changes per app (stack and providers included).
3. **Discussion before grilling, switch only by the user.** The user wants to think out loud first (keyboard or voice). Claude may suggest the switch, never make it. The phase is written in PLAN.md so any session resumes correctly.
4. **Grilling in rounds** (adapted from Matt Pocock's `grilling` skill, github.com/mattpocock/skills): numbered questions whose prerequisites are settled, one recommended answer each, worded so "yes" accepts; facts are Claude's job, decisions are the user's; ends when nothing is open and the user agrees. Rounds suit voice answers.
5. **Glossary and decision records** (same source): the apps mix French domain words and English code; a glossary keeps names stable. Decision records only when hard to reverse, surprising, and a real trade-off.
6. **Short CLAUDE.md with pointers** (same source, `retro`): it is loaded on every turn.
7. **Vertical slices** (Matt Pocock's "tracer bullets"): each slice goes through every layer and leaves something usable; no "all tables, then all screens". Slices small and self-contained so Sonnet (or Haiku) can build them from the brief alone.
8. **Unattended build, tested by the conductor, not by the user per slice.** The user tests per milestone ("test time"). The build stops only for human-only steps or a missing decision that blocks everything.
9. **Conductor + one helper at a time.** The conductor is the main build session (helpers cannot start helpers). One fresh helper per slice keeps contexts small and avoids the compression of long sessions. Parallel off by default (2 at most, independent slices, separate worktrees) so tokens are never spent without the user knowing. A token line per slice and a total at the end.
10. **IDEAS → PLAN → roadmap.** New ideas never go straight into the roadmap: `improve` decides them into PLAN.md first, then adds slices.
11. **Everything private by default.** All reference material and data in `private/` (git-ignored before the first commit), never published. Claude reads a file only with the user's OK; existing files are moved unread at init; datasets are seen as structure only; scripts on private data print counts, not rows.
12. **English with the user**, French only when they switch. App interface language decided per app.
13. **Deletion needs a confirmation pop-up**, not a typed word.
14. **Small context at init:** no extra connectors, memory files or plugins; one session per phase; forks only for short side trips.
15. **Testing in the Claude Code browser pane** during development; phone feedback only after `deploy`.
16. **Not taken from Matt Pocock's repo:** issue trackers, tickets, TDD as a rule, parallel implementation, PR skills. Too heavy for one maintainer and small apps. A few tests on critical rules stay possible per app (needs approving a test library).

## Added 2026-10-19 (after the review of projects A, B and C)

Measured on the transcripts: Project C cost about the same tokens as project A for two to three times the app, mostly on Sonnet; three quarters of that cost was the conductor (re-doing browser checks per slice, bookkeeping in many tool calls, micro-requests handled in a 200 k context), not the helpers (median 29 turns, 40 k context). Decisions that follow:

17. **Process is pack-independent.** Skills name project commands (`check`, `run`…) from the `CLAUDE.md` table and read conventions from `packs/<pack>/guide.md`; the stack (Next.js, Supabase, Vercel) is one pack among others. Skill names dropped "app". A new kind of work gets a pack from its first real project, never from theory.
18. **Cost = turns × context per turn.** The conductor's job is to stay small: failures only, one `slice-done` call per slice, no browser per slice. Verification moves to one checker helper per milestone and to scripted checks (access matrix, regression snapshot).
19. **Profiles, not sliders:** `eco` (sequential, default) and `fast` (parallel on independent slices). Parallel helpers cost the same inside and more around (worktree setup, conflicts at the conductor's context size, duplicates, plan window drained at once); the user chooses it knowingly. The model is chosen per slice in the brief (`opus` only with a written risk), not by the profile.
20. **Requests during a build are logged, not built.** Streams of one-line requests into a big context were the dominant cost in all three apps; they become polish slices in the next fix milestone.
21. **Independence by construction:** `after:` dependencies and module ownership in the briefs replace the `independent` flag; foundation slices first, feature slices own their module; a tidy slice closes every milestone and pays the debt while it is small.
22. **Records are generated:** `slice-done` writes the log and ticks the box; `docs-check` finds drift; finished material moves to `-DONE` files; the roadmap is an overview table plus one file per milestone (readable for the user, ~100 lines for a helper instead of 1,000). `HELPER-RULES.md` and `FUTURE.md` are gone (agent definition + CLAUDE.md; IDEAS ⏳ + QUESTIONS).
23. **One session per phase and per milestone build; test in a fresh session; `/clear` over compaction.** The files resume the work; a compaction summary costs tokens and loses detail.
24. **Grilling covers the branches that caused reworks:** the access table per screen, modes and states, and a narrated walkthrough before setup.
25. **Every skill names its session** (model, new or same, permission mode) at the start and the next step's at the end; `status` repeats the chart. The user should never have to guess which model a step deserves.
26. **An existing project is brought in by `retrofit`,** never rewritten: standard docs from what exists, a baseline, then behaviour-preserving slices with a regression safety net first.
27. **Measure.** `tools/session-stats.mjs` gives exact tokens per session and per helper; the retro changes one thing at a time and looks at the numbers.

## Added 2026-10-20 (portability)

28. **One core, many harnesses, generated where it matters.** The steps are open Agent Skills that several assistants read, so the step texts became the portable unit and name neither products nor models. Every harness-dependent feature is a capability with a manual fallback stated in the step texts, and a harness only automates or enforces that rule. Each harness row is proposed from the docs and adopted only after a measured milestone or a canary, as any other workflow change. Claude Code, where the workflow is measured, gets generated self-contained files of the same length, because a step that had to read a porting file at run time would cost turns and context in every session.

## Stage 2 plan: the repository out of `~/.claude` (not started)

1. Move the repository to its own folder (`stareso-workflow/`), with `skills/`, `roles/`, `capabilities/`, `harness/`, `packs/`, `templates/` and `tools/` at its root, and keep `~/.claude` free of tracked files.
2. One install script per harness (`harness/<harness>/install.mjs`). For Claude Code it runs `harness-build` into `~/.claude/skills` and `~/.claude/agents` and merges `settings.hooks.json` into the user settings. For Codex and Cursor it links the core skills into their skill folders and writes their agent files. A `--check` mode reports drift.
3. `<stareso>` becomes the install path written by the script, so the Claude Code output keeps absolute paths and stays the same length.
4. Rename the pack template `templates/CLAUDE.md` to `templates/AGENTS.md`, generate `CLAUDE.md` for Claude Code projects, and let the milestone template write `tier:` (Claude Code rendering it as `model:`).
5. `workflow-changed.mjs` watches the new repository path, with one hook adapter per harness that has hooks.
6. Measure before and after on one Claude Code build: conductor turns and ≈ equiv per slice must not move by more than 10 %.

## Proposed 2026-10-21 (Claude Code harness: manager session)

Applied on 2026-10-21 at the user's request, before a retro (status §5, `capabilities/invocation.md`, build's "Started by" line, the Claude Code manager-launch block and capability row). Origin: a build typed straight into the session that had just run `status` worked, but the user prefers the top session as a manager and each step in its own launched session. Raise at the next retro and measure on one build (conductor context per turn, "Carried" of the later steps).

1. **Manager pattern.** The `Session:` line of build, test and improve says: when a manager session exists (the one that runs `status`), it launches the step in a sub-session (`start_session`, or `clear_session` on an idle child then `send_message` with the command) instead of running it inline. The skill text stays valid when run directly.
2. **Status offers the launch.** In a manager, `status` ends with the exact launch (skill, model, mode, profile) as a card or a one-line offer, not only the command to type.
3. **Relay is automatic.** A build child ends with `MILESTONE DONE: M<n> · next: M<n+1>` or `RUN STOPPED: <reason>`. The manager starts the next child on the first and reports to the user on the second.
4. **One writer per checkout.** The manager never runs slice helpers in the checkout while a child owns it. Before launching a child, the manager lets an inline helper finish and merge, or stops it.
5. **Records before launch.** The manager runs `session-stats --log` and commits `docs/data/` before launching a build, so that earlier sessions are logged and the tree is clean for `slice-done`.
6. **Reuse over spawn.** An idle finished child is cleared and reused for the next milestone (same folder, model and mode), which keeps the sidebar short.
7. **Skills are user-only.** Build, test and improve are `disable-model-invocation`, so a manager cannot start them in a child by message (found on the first try). Either the user types the command in the child, or the skills allow a manager-sent launch for these three steps. Until then the manager prepares the child and hands the user the exact command and constraints.

## Added 2026-10-22 (status, panel and records)

Decided in one long working session on the workflow itself, with the user reviewing the panel on the desktop after each change. Each change has its line in `CHANGELOG.md`, and the reasons that should not be re-argued are kept here.

29. **Status is one tool call and one model turn.** The skill injects `progress-graph.mjs --status`, which applies the rule table and prints the lines, so the model only relays them with the launch question. It took about 15 seconds and three turns before. The answer names the 5-hour and weekly caps on lines of their own, because they call for different actions.
30. **The panel is the only visual.** `/stareso-usage` and the browser dashboard were retired, since the panel shows the same numbers beside the chat at no token cost. The guide to the numbers moved to `metrics.md`, and `usage-report.mjs` stays for the panel and the retro.
31. **Records are datasets only.** The tools read `docs/data/*.jsonl` and nothing older, and a project still on the old Markdown records is migrated first. Keeping both readers had doubled every change.
32. **A merged helper's worktree is removed by `slice-done`,** unless it holds uncommitted work. Worktrees left behind had grown to gigabytes in one project.
33. **ETAs learn from their misses, cheaply.** A helper's predicted merge time is kept once, on this machine only, then compared with the merge. The median ratio of the last 20 slices (at least 4) scales the next ETAs, clamped to 0.5 to 3 and measured against the raw estimate so it never compounds. Chart 7 draws each slice as a dumbbell (○ predicted, ● taken), because a bar hid the direction and the size of a miss.
34. **The desktop sets the panel's drawing rules.** A desktop draws a Button natively and drops any colour inside it, so a slice number is a plain Button after a coloured state mark. Coloured chips and button highlight boxes were tried and rejected as hard to read. Every state uses the same full square, since `□` drew smaller. A hover reaches no hook, so hover previews are cards drawn hidden and revealed by their number's scope, placed over what follows so nothing moves. Values sit in a box pushed to the right edge, because bars ending on an eighth-block glyph shifted them.
35. **The panel reads at a glance.** Both tabs open on a row of stat tiles (ETA all, ETA milestone, mode, slices done, slices running, per slice, waits on you), the running helpers come before the milestones, a slice card is short (state, branch, model, needs, unblocks) with its title in its state's colour, and dates are yyyy-mm-dd.
36. **Chats on the workflow itself are counted in no project.** Usage is read from a project's own transcript folder, so a chat in `~/.claude` reaches no project's records, status or retro. It shows only in the account's plan windows. Whether to give these chats a record of their own is open.

Open after this session: a name for the workflow that is not tied to stareso (atelier and keel were proposed), which fits with the stage 2 move, and a generic panel mode for projects without a roadmap (plan windows, chats, git and session usage work anywhere, the progress tab only with a roadmap).

## Applied 2026-10-23 (Claude Code harness: panel tile per launched step), plugin 0.6.31

Applied at the user's request, as a workflow change with a test (`register.test.tsx`), before a retro. The core skills are untouched. Two choices the proposal left open: the plugin reads the `STATUS` line from the end of an idle conductor's transcript (`list_events`, the last 15 messages) and never sends `STATUS?` itself, since that would cost the conductor a turn every minute, so the line is only as fresh as the last time the manager asked. Without one, a build's state falls back to the graph (a helper running means waiting for it, else "idle, no status line") and a test or improve to waiting on you. A tile disappears at `MILESTONE DONE` or `STEP DONE`, and `RUN STOPPED` leaves a red one. Not verified on the desktop panel when it was applied.

Originally proposed: Origin: SecuSurf, a manager session launched a test (and two builds in parallel). The panel showed the builds through the slice grid but the test only in the chats list, with no sign of what it was doing, and the milestones' Tested column stayed empty until "end test" by design.

1. **A "steps running" tile per launched session.** One tile for each session a manager started (build, test, improve), read from the sessions the harness lists as started by the manager. It shows the step, the model, the elapsed time and a state: working, waiting for a helper, waiting on you. A parallel run shows two tiles.
2. **ETA only where it is real.** A build keeps its ETA (slices left times the usual slice time, as today). A test and an improve show elapsed time and the state, never an ETA: they end when the user says so.
3. **Tested stays as is.** The `<!-- test: … -->` markers are written at "end test"; the tile says "testing, marker written at the end" so an empty Tested column is understood.
4. **A conductor's idle is not stopped.** The state comes from the `STATUS` line the build skill already defines (running, helpers working, planned next), not from the session's idle flag.
5. **Where it lives.** `harness/claude-code/plugins/stareso-status` only (the core stays harness-neutral); the build skill's `STATUS` line is the contract. No change to the core skills.
6. **Measure.** Does the user still open the chats list to find a running step, and does the tile ever disagree with the session's real state?
