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
5. **Records before launch.** The manager runs `session-stats --log` and commits `docs/USAGE.md` before launching a build, so that earlier sessions are logged and the tree is clean for `slice-done`.
6. **Reuse over spawn.** An idle finished child is cleared and reused for the next milestone (same folder, model and mode), which keeps the sidebar short.
7. **Skills are user-only.** Build, test and improve are `disable-model-invocation`, so a manager cannot start them in a child by message (found on the first try). Either the user types the command in the child, or the skills allow a manager-sent launch for these three steps. Until then the manager prepares the child and hands the user the exact command and constraints.
