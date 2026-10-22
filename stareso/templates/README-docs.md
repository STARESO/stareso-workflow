# Docs

What each file is for and which stareso skill writes it. Doc files are named in capitals; decision records are `decisions/NNNN-slug.md`. Finished material moves to the `-DONE` files so the live files stay short.

| File | What it is for | Created by | Updated by |
|---|---|---|---|
| `../CLAUDE.md` | Short project rules, Commands table, approved dependencies | setup | improve, retrofit |
| `PLAN.md` | The decided project: single source of truth (`Phase:` and `Pack:` lines on top) | init | grill, improve |
| `GLOSSARY.md` | Domain words: UI word, meaning, code name | init | grill, improve |
| `decisions/` | Why a hard-to-reverse choice was made | grill | improve |
| `IDEAS.md` | Inbox of raw ideas, each with a status mark | init | discuss, test, improve; `slice-done` marks ✅ |
| `ROADMAP.md` | Numbering rules, slice format, the overview table and the open-slices table (generated) | setup | tools |
| `roadmap/[ID].md` | One file per milestone: intro, test marker, slice briefs | setup | improve, test; `slice-done` ticks |
| `QUESTIONS.md` | Open questions the build could not answer, `[debt]` lines | setup | build asks; improve and sessions answer |
| `FEEDBACK.md` | The newest test rounds and what became of each point | setup | test, build (requests during a run) |
| `FEEDBACK-DONE.md` | Older test rounds, moved out at the end of a test | test | test |
| `data/` | Machine records, one event per line: `sessions.jsonl` (`session-stats --log`), `builds.jsonl` (`slice-done`, `record.mjs`). Read with `usage-report.mjs` or the dashboard, never by hand | setup | tools |
| `RETROS.md` | Workflow reviews, newest at the bottom | setup | retro |
| `reports/` | Dated usage reports kept on request (`dashboard.mjs --write`, standalone HTML) | usage | usage |
| `LOGBOOK.md` (analysis pack) | Dated scientific findings and choices | init | slices, the user |
| `DEPLOY.md` (app pack) | Going-online checklist and lessons | deploy | deploy |
| `README.md` | This list | init | any skill that adds a doc |
