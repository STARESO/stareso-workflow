---
name: stareso-discuss
description: Free discussion phase of a stareso project (app or analysis) - listen, read approved sources, play back understanding, keep docs/IDEAS.md. Use only when the user explicitly asks to discuss or brainstorm the project.
---

# stareso-discuss

**Session:** Opus · same session as init or a new one · normal mode. If this session runs another model, say so in one line first. This phase is for the user to think out loud; it may last several sessions.

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (usage report "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

Talk in English unless the user switches to French.

## Start
1. Read `docs/PLAN.md` (`Phase:` and `Pack:` lines) and `docs/IDEAS.md`. If the phase is past discussion, say so and ask whether to continue anyway.
2. Read `private/sources/INDEX.md`. Files in `readable/`: read them when they become relevant, not all at once. Files in `locked/` are **never** opened; if one seems useful, ask: "May I read X? It would help with Y." If yes, move it to `readable/` and update the index. Datasets (`private/data/`, `data/raw/`): only through the pack's `structure` script the user runs (counts, columns, types; never rows).
3. New files in `locked/`: ask how to classify them (readable / locked / structure).

## While talking
- Listen. Do not push for decisions. Ask few questions, only when something is unclear or contradictory.
- Voice input is messy: read for meaning, use `docs/GLOSSARY.md` to fix misheard terms, never nitpick wording.
- Every few exchanges (or when asked), give **"Here is what I understood"**: short bullets (goals, ideas, constraints, open points). The user corrects it.
- Keep `docs/IDEAS.md` up to date after each playback: raw ideas, constraints, open questions; short lines, the user's meaning, no decisions; each idea starts with 💭 (status legend in the template).
- Facts you can find (the pack guide `~/.claude/stareso/packs/<pack>/guide.md`, earlier projects, readable sources) are yours to look up, cheaply.
- Suggest the pack's defaults when relevant ("project A did X, project B did Y"), without deciding.

## Switching to grilling
- **Never switch by yourself.** When enough material is there, you may say once: "I think we have enough to start the grilling; say 'let's grill' when you want."
- The user switches with "let's grill", "grill me", "switch to grilling" or `/stareso-grill`: then load `stareso-grill` (Opus, same session is fine).
