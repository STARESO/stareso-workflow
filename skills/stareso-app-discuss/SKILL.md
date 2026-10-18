---
name: stareso-app-discuss
description: Free discussion phase of a stareso-app project - listen, read approved sources, play back understanding, keep docs/IDEAS.md. Use only when the user explicitly asks to discuss or brainstorm the app.
---

# stareso-app-discuss

Talk in English unless the user switches to French. This phase is for the user to think out loud; it may last several sessions.

## Start
1. Read `docs/PLAN.md` (phase line) and `docs/IDEAS.md`. If the phase is past discussion, say so and ask whether to continue anyway.
2. Read `private/sources/INDEX.md`. For files in `readable/` not yet read, read them when they become relevant (not all at once). Files in `locked/` are **never** opened; if one seems useful, ask: "May I read X? It would help with Y." If yes, move it to `readable/` and update the index. Datasets in `private/data/`: only through a structure script the user approved (guide §3b).
3. If new files appear in `locked/`, ask how to classify them (readable / locked / structure).

## While talking
- Listen. Do not push for decisions. Ask few questions, only when something is unclear or contradictory.
- Voice input is messy: read for meaning, use `docs/GLOSSARY.md` to fix misheard terms, never nitpick wording.
- Every few exchanges (or when asked), give **"Here is what I understood"**: short bullets (goals, ideas, constraints, open points). The user corrects it.
- Keep `docs/IDEAS.md` up to date after each playback: raw ideas, constraints, open questions. Short lines, the user's meaning, no decisions; each idea line starts with 💭 (status legend in the template).
- Facts you can find (the guide, earlier apps, readable sources) are yours to look up, cheaply.
- Suggest the guide's defaults when relevant ("SecuSurf did X; BaieWatch did Y"), without deciding.

## Switching to grilling
- **Never switch by yourself.** When enough material is there, you may say once: "I think we have enough to start the grilling; say 'let's grill' when you want."
- The user switches with words like "let's grill", "grill me", "switch to grilling" or `/stareso-app-grill`: then load `stareso-app-grill`.
