---
name: stareso-improve
description: Turn new ideas or decisions to confirm of a stareso project into PLAN updates and roadmap slices - short discussion and grilling on one idea, then PLAN.md, GLOSSARY, decision records, a milestone file, and a coherence check. Use when the user wants to add or change something after the first plan.
---

# stareso-improve

**Session:** Opus · **new session** · normal mode. If this session runs another model, say so in one line first (this step decides things).

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (USAGE "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

Talk in English unless the user switches to French.

## 1. Pick the idea
Read `docs/QUESTIONS.md` first (open lines are decisions waiting for exactly this step: offer to settle them in the first round, with a recommended answer each; `[debt]` lines are not decisions, leave them to the tidy slice), then `docs/IDEAS.md` (open items: 💭, and 🛠 when the user asks about planned work), `docs/PLAN.md`, `docs/ROADMAP.md` (overview), and any "decision to confirm" slices in the open milestone files. If the user brings a new idea, add it to IDEAS.md first. Ask which idea (or group of linked ideas) to work on now. Every question settled here is ticked in QUESTIONS.md with `**Answer (date): …**` and its waiting slices are unblocked (their brief updated if the answer changes it).

## 2. Discuss, then grill (scoped to that idea)
- Vague wording ("mode", "gallery", "scroll menu") → one short clarifying question with a recommended reading before anything is written; wording guessed wrong costs a rework slice.
- Short free discussion: what it is for, who uses it, what it changes. Play back what you understood.
- Then grilling on that idea only (`~/.claude/stareso/grilling.md`: rounds, recommended answers, facts are yours), usually one to three rounds. Include: what it changes in existing screens, outputs and data (the access table, the modes), migration of existing data, where it fits in the order of milestones.

## 3. Write
1. `docs/PLAN.md`: update the sections concerned (the plan stays the single source of truth).
2. `docs/GLOSSARY.md` and a decision record if the grilling rules call for one.
3. Roadmap: new slices in a new or existing milestone file in `docs/roadmap/` (slice rules of `stareso-setup` §3: self-contained, module ownership, `after:`, model and risk, `check: now`, tidy slice). Data changes on a project already online or delivered: the slice writes a numbered migration (app) or a data-version bump (analysis) and is marked **[human]** for the online or real-data step.
4. `docs/IDEAS.md`: 💭 → 🛠 "(PLAN §…, slices M24.1–M24.3)" or → ✖ "(rejected: reason)".
5. **Coherence:** `node ~/.claude/stareso/tools/roadmap-overview.mjs`, then `node ~/.claude/stareso/tools/docs-check.mjs`; read only what it flags, plus a search of the old wording (the old rule, number or UI word) across `docs/` and `CLAUDE.md`: no open brief may describe the old behaviour, a replaced decision record says so in its status line, `CLAUDE.md` rules agree with PLAN. Fix in the same commit; if two docs disagree and the right version is unclear, ask.
6. Commit docs. Next: `/stareso-build M<n>` (Sonnet, new session, auto mode, eco).

## Numbering
Slice ids are `M<milestone>.<n>`. New milestones take the next free number and go before `H` and `P` (lettered, never renumbered). Ids never change once given.
