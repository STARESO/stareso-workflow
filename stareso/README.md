# stareso workflow: user manual

A repeatable way to take a piece of work from first idea to delivered result, in small checked slices, with the expensive model deciding and cheap fresh helpers executing. Born with STARESO's small web apps (SecuSurf, BaieWatch, Scriba); the process is independent of the kind of work and of the tools: a **pack** carries what is specific (stack, conventions, verification, delivery steps).

Why it is built this way: `DESIGN-NOTES.md`. Changes to the workflow: `CHANGELOG.md`. Using it elsewhere than Claude Code: `PORTABILITY.md`.

```
init ──▶ discuss ──▶ grill ──▶ setup ──▶ build ◀──▶ test ──▶ deploy / deliver
                                           ▲          │
retrofit (existing project) ──▶ build      └ improve ◀┘         status: any time
```

## Where everything lives

| What | Where |
|---|---|
| The skills (one folder each) | `~/.claude/skills/stareso-*/SKILL.md` |
| The helper agents used by the build | `~/.claude/agents/stareso-slice-builder.md`, `stareso-slice-checker.md` |
| Shared material: this manual, grilling rules, templates, tools | `~/.claude/stareso/` |
| Packs (stack and conventions) | `~/.claude/stareso/packs/<pack>/` |

On Windows `~` is `C:\Users\aubin`. These places are one git repository rooted at `~/.claude` (whitelist `.gitignore`: only the workflow is tracked). After changing the workflow: `git -C ~/.claude add -A && git -C ~/.claude commit -m "…"`, then push to the private remote (`github.com/awoehrel/stareso-app-workflow`).

## The skills

| Skill | Start it with | Model · session · mode | What it does |
|---|---|---|---|
| `stareso-init` | `/stareso-init <name> [pack]` (typed) | Opus · new · normal | Folder structure from the pack, private guard, existing files moved unread, git, next-steps chart |
| `stareso-discuss` | `/stareso-discuss` or "let's discuss" | Opus · same or new · normal | Free talk (keyboard or voice), reads approved sources, plays back, keeps `IDEAS.md` |
| `stareso-grill` | "let's grill" / `/stareso-grill` | Opus · same · normal | Numbered rounds with recommended answers, access table, modes; writes `PLAN.md`, `GLOSSARY.md`, decisions; ends with a walkthrough |
| `stareso-setup` | `/stareso-setup` | Opus · same · normal | Short `CLAUDE.md` with the Commands table, roadmap: overview + one file per milestone of small slices |
| `stareso-build` | `/stareso-build M1 [eco\|fast]` (typed) | **Sonnet · new, no worktree · auto** | Conductor: one fresh helper per slice, `check`, `slice-done`; checker helper and tidy slice per milestone |
| `stareso-test` | `/stareso-test` / "test time" | Sonnet · new · normal | Checklist of what is new, feedback logged, segmented into fix slices at "end test", retro |
| `stareso-improve` | `/stareso-improve` / "I have a new idea" | Opus · new · normal | One idea: discussion + grilling → PLAN → new milestone file, coherence check |
| `stareso-status` | "where are we?" / `/stareso-status` | any | Phase, progress, debt, what waits for you, the next step with its model and session |
| `stareso-deploy` | `/stareso-deploy` (typed) | Opus · new · normal | Pre-flight, prepared files, `DEPLOY.md`, the pack's provider or delivery steps one at a time |
| `stareso-retrofit` | `/stareso-retrofit [pack]` (typed) | Opus · new · normal | Existing project → standard docs, Commands, PLAN from the code, a retrofit milestone of behaviour-preserving slices |

Typed-only skills (`init`, `build`, `deploy`, `retrofit`) cannot be started by Claude on its own: they create things, spend tokens or go online. Every skill opens with its **Session** line (model, new or same session, mode) and closes with the next step's; `/stareso-status` repeats it any time.

## Build profiles

| Profile | Helpers | When |
|---|---|---|
| **eco** (default) | one fresh helper at a time, in the project checkout; no browser per slice; one checker helper per milestone | you are away, no hurry: cheapest, and it never drains the plan's 5-hour window at once |
| **fast** | up to 3 helpers in parallel on independent slices (no `after:`, no shared file), each in its own worktree | you need it this afternoon; costs more (worktree setup, conflicts resolved by the conductor, duplicated code, faster limit) |

The model is chosen **per slice in the brief** (`model: haiku | sonnet | opus`), not by the profile: eco still uses Opus on a slice the brief marks as risky.

## Your routine

1. Empty folder, Opus session: `/stareso-init <name> app-next` (or `analysis-r`). Existing project instead: `/stareso-retrofit`.
2. Reference files into `private/sources/locked/` (data into `data/raw/` for an analysis). Claude asks before reading any of them; datasets are seen as structure only.
3. Talk (`discuss`), as long as you want. Say **"let's grill"**; answer the rounds ("1 yes, 2 yes, 3 no, rather…"); correct the walkthrough.
4. `/stareso-setup`, review the overview and the slice titles, accept.
5. **New session**, Sonnet, auto mode, in the project folder (no worktree): `/stareso-build M1`. Leave it working; anything you notice goes to FEEDBACK, not to the conductor.
6. When it reports: clear, **new session**, `/stareso-test`; test; "end test".
7. Fixes: `/stareso-build M<n>` in a new session. New ideas or decisions to confirm: `/stareso-improve` (Opus, new session).
8. Repeat 5–7 per milestone. Back after a break: `/stareso-status`.
9. Ready: `/stareso-deploy`. Feedback from phones or readers afterwards: `/stareso-test`.

## Files in each project

`docs/IDEAS.md` (inbox) → `docs/PLAN.md` (decided, single source of truth; `Phase:` and `Pack:` on top) → `docs/ROADMAP.md` (overview, generated) + `docs/roadmap/<ID>.md` (briefs) → code.
Also `docs/GLOSSARY.md`, `docs/decisions/`, `docs/QUESTIONS.md` (open questions, `[debt]`), `docs/FEEDBACK.md` (+ `FEEDBACK-DONE.md`), `docs/BUILD-LOG.md` (generated), `docs/DEPLOY.md`, (analysis) `docs/LOGBOOK.md`, `docs/README.md` (the list).
`private/` (never committed or published): `sources/locked/`, `sources/readable/`, `sources/INDEX.md`, `data/`, `backups/`; analyses also keep `data/raw/`, `data/processed/`, `outputs/` out of git.

## Tools (`~/.claude/stareso/tools/`, plain Node, no install)

| Tool | Use |
|---|---|
| `slice-done.mjs <id> --model m --tokens n --note "…"` | merges the slice branch `--no-ff`, ticks the box, flips 🛠 → ✅ in IDEAS, writes the BUILD-LOG line, regenerates the overview, commits |
| `docs-check.mjs` | coherence of the records (ticked slice without log line, stale 🛠, broken `after:`, missing `Pack:`, docs not listed, version mismatch, old files) |
| `roadmap-overview.mjs` | regenerates the overview table of `ROADMAP.md` |
| `roadmap-split.mjs` | one-off: splits an old single-file roadmap into the folder layout |
| `session-stats.mjs <out> <transcripts…>` | exact tokens, turns, context per turn and user timeline from the Claude Code transcripts (`~/.claude/projects/`): use it in every retro |

## Packs

A pack = a folder `packs/<name>/` with `README.md`, `guide.md` (conventions by numbered section, commands, verification, default roadmap), `templates/` (CLAUDE.md with the Commands table, gitignore, starting files) and, for things that go online or get delivered, `deploy.md`. `PLAN.md` names the pack; skills, helpers and briefs read only the sections they need.

| Pack | For |
|---|---|
| `app-next` | small team web app: Next.js, Postgres (Supabase), Vercel, PWA, browser-pane verification |
| `analysis-r` | data analysis in R: `config/paths.yml`, `R/` modules, `main/` steps, tests + regression snapshot, figures, Quarto HTML report |

A new kind of work (a model, a document review, another stack) gets its pack written from its first real project, as these two were: copy the closest pack, keep the section layout, change the content. The skills do not change.

## Privacy, in short
- Everything in `private/` and the data folders stays private. Reading a file sends it to the model: Claude reads only files you moved to (or approved for) `readable/`. Datasets: structure only, through a script you agree to run; development uses toy samples; you run real imports.
- A guard in each project's `.claude/settings.json` blocks Claude's reading tools on the locked folders and the env files.

## Keeping the context small
- Each phase in its own session; one build session per milestone; the files are the memory, not the chat. `/clear` + `/stareso-status` beats a compaction.
- The conductor sees reports and failures, never full tool output; helpers are fresh and read only their brief and the named guide sections.
- Human input is batched (test rounds), never streamed into a running build.
- Records are generated by the tools, in one format; finished material moves to `-DONE` files; a tidy slice closes every milestone.

## Changing the workflow
Edit the skill, pack or template, then add a line to `CHANGELOG.md`. The test retro proposes such changes; you accept them one by one. Measure before and after with `session-stats.mjs`.
