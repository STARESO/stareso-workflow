# Design notes: why the workflow is built this way

Decisions taken on 2026-10-17 while designing the workflow (in a SecuSurf session), with the reasons, so they are not re-argued later.

1. **Skills plus one shared folder.** Personal skills work in every project and load only when used. The shared material (guide, grilling rules, templates) sits in `~/.claude/stareso-app/`, which is not a skill, so it costs nothing in sessions that do not use it.
2. **Guide = defaults, not rules.** It describes SecuSurf and BaieWatch patterns; the grilling decides what changes per app (stack and providers included).
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
