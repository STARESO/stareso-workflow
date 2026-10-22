# stareso workflow: user manual

A repeatable way to take a piece of work from first idea to delivered result, in small checked slices, with a strong model deciding and cheap fresh helpers executing. Born with three of STARESO's small web apps (projects A, B and C), the process is independent of the kind of work and of the assistant. A **pack** carries what is specific to the work (stack, conventions, verification, delivery steps), and a **harness** folder carries what is specific to the assistant (helpers, read guard, hooks, models).

New to AI assistants: `START-HERE.md`. Why it is built this way: `DESIGN-NOTES.md`. Changes to the workflow: `CHANGELOG.md`. Using it with another assistant: `harness/README.md`.

**Words.** A **step** is one phase of the process (init, grill, build…), written as one `SKILL.md` (Claude Code calls it a skill). A **tier** is the class of model a step or slice needs: **strong**, **standard** or **light**; each harness maps them in `harness/<harness>/models.md` (Claude Code: Opus, Sonnet, Haiku). The **project instructions** file is `AGENTS.md`, which Claude Code names `CLAUDE.md`.

```
init ──▶ discuss ──▶ grill ──▶ setup ──▶ build ◀──▶ test ──▶ deploy / deliver
                                           ▲          │
retrofit (existing project) ──▶ build      └ improve ◀┘         status: any time
```

## Where everything lives

| What | Where |
|---|---|
| The steps, harness-neutral (one folder each) | `stareso/skills/stareso-*/SKILL.md` |
| The helper roles used by the build | `stareso/roles/slice-builder.md`, `slice-checker.md` |
| The capabilities a harness provides (helpers, read guard, automation, tiers, browser, questions, invocation, usage) | `stareso/capabilities/` |
| One folder per harness: how it provides each capability, its models, its setup | `stareso/harness/<harness>/` |
| Shared material: this manual, grilling rules, metrics, templates, tools | `stareso/` |
| Packs (stack and conventions) | `stareso/packs/<pack>/` |
| Claude Code's generated copies, read at run time | `~/.claude/skills/stareso-*/SKILL.md`, `~/.claude/agents/stareso-slice-*.md` |

The steps write `<stareso>` for the `stareso/` folder and `<stareso-repo>` for the repository. In Claude Code both are inside `~/.claude` (on Windows `C:\Users\<you>\.claude`), which is the git repository: its whitelist `.gitignore` tracks only the workflow. After changing the workflow, regenerate the Claude Code files (`node ~/.claude/stareso/tools/harness-build.mjs`), then `git -C ~/.claude add -A && git -C ~/.claude commit -m "…"`, then push to the `stareso-workflow` remote.

**This repository must stay free of personal and project-private information** (it may be shared or made public): no user names or home paths (write `<you>`), no e-mail addresses, no domain names, keys, codes or account ids, no real people, no data. Project-specific facts live in each project's own repository and `private/` folder. The workflow holds only the method, the packs and the harness notes. Git commit metadata carries the author name and e-mail of whoever commits: use a work identity if the repository is ever made public.

## The steps

| Step | Start it with | Tier · session · mode | What it does |
|---|---|---|---|
| `stareso-init` | `/stareso-init <name> [pack]` (typed) | strong · new · normal | Folder structure from the pack, private guard and its canary, existing files moved unread, git, next-steps chart |
| `stareso-discuss` | `/stareso-discuss` or "let's discuss" | strong · same or new · normal | Free talk (keyboard or voice), reads approved sources, plays back, keeps `IDEAS.md` |
| `stareso-grill` | "let's grill" / `/stareso-grill` | strong · same · normal | Numbered rounds with recommended answers, access table, modes; writes `PLAN.md`, `GLOSSARY.md`, decisions; ends with a walkthrough |
| `stareso-setup` | `/stareso-setup` | strong · same · normal | Short project instructions with the Commands table, roadmap: overview + one file per milestone of small slices |
| `stareso-build` | `/stareso-build M1 [eco\|fast]` (typed) | **standard · new, no worktree · auto** | Conductor: one fresh helper per slice, `check`, `slice-done`; checker helper and tidy slice per milestone |
| `stareso-test` | `/stareso-test` / "test time" | standard · new · normal | Checklist of what is new, feedback logged, segmented into fix slices at "end test" |
| `stareso-improve` | `/stareso-improve` / "I have a new idea" | strong · new · normal | One idea: discussion + grilling → PLAN → new milestone file, coherence check |
| `stareso-status` | "where are we?" / `/stareso-status` | any | Phase, progress, debt, what waits for you, the next step with its tier and session, the build mode, the helpers running, the pace, and a graph of the build |
| `stareso-deploy` | `/stareso-deploy` (typed) | strong · new · normal | Pre-flight, prepared files, `DEPLOY.md`, the pack's provider or delivery steps one at a time |
| `stareso-retrofit` | `/stareso-retrofit [pack]` (typed) | strong · new · normal | Existing project → standard docs, Commands, PLAN from the code, the guard canary, a retrofit milestone of behaviour-preserving slices |
| `stareso-retro` | `/stareso-retro [quick|deep]` | quick: standard · test session · normal; deep: strong · new | Measured review from the generated records: fixed metrics, comparison with the previous retro, the harness's proposed capabilities, at most three workflow changes, entry in `docs/USAGE.md` |

`/stareso-<step>` means "start the step named stareso-<step>", and each harness has its own way (`capabilities/invocation.md`). Typed-only steps (`init`, `build`, `deploy`, `retrofit`) are never started by the assistant on its own, because they create things, spend tokens or go online. Every step opens with its **Session** line (tier, new or same session, mode) and closes with the next step's. `/stareso-status` repeats it any time.

## Build profiles

| Profile | Helpers | When |
|---|---|---|
| **eco** (default) | one fresh helper at a time, in the project checkout; no browser per slice; one checker helper per milestone | you are away, no hurry: cheapest, and it never drains the usage window at once |
| **fast** | up to 3 helpers in parallel on independent slices (no `after:`, no shared file), each in its own worktree | you need it this afternoon; costs more (worktree setup, conflicts resolved by the conductor, duplicated code, faster limit) |
| **night** `<limit>` | fast's helpers for a long unattended run: deadline and wrap-up time, paced on the usage window, never stops early, takes slices from milestone `Q` (Kind: queue) when its range is done | you sleep and want the whole usage window used; born with project E's overnight runs |

The tier is chosen **per slice in the brief** (`tier: light | standard | strong`, which Claude Code briefs write as `model: haiku | sonnet | opus`), not by the profile: eco still uses the strong tier on a slice the brief marks as risky. A harness without helpers runs each slice in a fresh session instead (`capabilities/helpers.md`, mode session).

## Your routine

1. Empty folder, strong-tier session: `/stareso-init <name> app-next` (or `analysis-r`). Existing project instead: `/stareso-retrofit`.
2. Reference files into `private/sources/locked/` (data into `data/raw/` for an analysis). The assistant asks before reading any of them, and datasets are seen as structure only.
3. Talk (`discuss`), as long as you want. Say **"let's grill"**, answer the rounds ("1 yes, 2 yes, 3 no, rather…") and correct the walkthrough.
4. `/stareso-setup`, review the overview and the slice titles, accept.
5. **New session**, standard tier, auto mode, in the project folder (no worktree): `/stareso-build M1`. Leave it working. Anything you notice goes to FEEDBACK, not to the conductor.
6. When it reports: clear, **new session**, `/stareso-test`, test, "end test".
7. Fixes: `/stareso-build M<n>` in a new session. New ideas or decisions to confirm: `/stareso-improve` (strong tier, new session).
8. Repeat 5–7 per milestone. `/stareso-retro` when asked (10 turns, measured, never part of the test). Back after a break: `/stareso-status`.
9. Ready: `/stareso-deploy`. Feedback from phones or readers afterwards: `/stareso-test`.

## Files in each project, and when they enter the workflow

The flow: `IDEAS.md` (inbox) → `PLAN.md` (decided) → `ROADMAP.md` + `roadmap/<ID>.md` (slices) → code. `FEEDBACK.md` feeds the next milestone, `QUESTIONS.md` holds what nobody could decide yet, and `BUILD-LOG.md` and `USAGE.md` record what was done and what it cost. Nothing lives only in the chat.

| File | Enters at | Written by | Read by | Kept coherent by | Leaves / archives |
|---|---|---|---|---|---|
| the harness's guard file (Claude Code: `.claude/settings.json`), `.gitattributes`, `.editorconfig` | init / retrofit | init, retrofit | the harness, git | the canary (`Guard:` line in PLAN) | never |
| `AGENTS.md` (Claude Code: `CLAUDE.md`) | init (name), **setup** (rules, Commands, dependencies) | setup, improve, retrofit, deploy (status line) | every session and helper, on every turn | improve's old-wording search; `docs-check` (Pack line in PLAN) | never; stays short |
| `private/sources/INDEX.md` | init | init, discuss (classification) | discuss, grill | — | never |
| `docs/PLAN.md` | init (`Phase`, `Pack`, `Guard`) | grill (each round), improve, retrofit, deploy (`Phase`) | setup, build (conductor), improve, status, checker (access table) | improve's coherence step; the walkthrough; `docs-check` (header lines) | never: single source of truth |
| `docs/IDEAS.md` | init | discuss, test (💭), improve (💭 → 🛠 / ✖), retrofit | discuss, grill, improve, status | `slice-done` (🛠 → ✅), `docs-check` (stale 🛠) | lines change status, never deleted |
| `docs/GLOSSARY.md` | init | grill, improve, retrofit | discuss (voice), setup, helpers through the briefs | improve's old-wording search | never |
| `docs/decisions/` | grill (first hard choice) | grill, improve, retrofit | improve, anyone asking "why" | a replaced record says so in its status line | never |
| `docs/ROADMAP.md` | **setup** | tools only (`roadmap-overview`, `slice-done`) | status, build start, improve, test, the user | generated | never |
| `docs/roadmap/<ID>.md` | setup; test and improve add milestones | setup, test, improve, retrofit; `slice-done` ticks | build (one file per run), helpers (their brief), checker (done-when lines) | `docs-check` (`after:` targets, log lines) | stays; done milestones show as done in the overview |
| `docs/QUESTIONS.md` | **setup** (grilling leftovers) | build (blocked decisions), test (undecidable points), retrofit (`[debt]`), tidy slices (`[debt]`); answered by improve, build, any session | **improve (first thing)**, build (skips what a question blocks), status | `docs-check` (open but unblocked, ticked without answer) | lines are ticked with their answer, never deleted |
| `docs/FEEDBACK.md` | setup | test (points), build (requests during a run) | test's "end test" segmentation, improve (decisions to confirm) | `docs-check` (more than two blocks) | older blocks → `FEEDBACK-DONE.md` at the end of a test |
| `docs/BUILD-LOG.md` | setup | `slice-done` only (one line per slice, with harness, helper mode and tier) | status, retros | `docs-check` (ticked slice without a line) | never |
| `docs/USAGE.md` | setup | `session-stats --log` at the end of build and test (harnesses with a usage reader) | status (totals), retros | regenerated | never |
| `docs/LOGBOOK.md` (analysis) | init | slices (one line), the user | report writing, improve | — | never |
| `docs/DEPLOY.md` (app) | **deploy** | deploy | deploy, the user when publishing | lessons copied to the pack's `deploy.md` | never |
| `docs/README.md` | init | any step that adds a doc | newcomers | `docs-check` (unlisted file) | never |
| `private/`, `data/raw`, `data/processed`, `outputs/` | init | the user, import scripts | nobody reads rows | read guard | never committed |

Rule of thumb: a step that touches a decision runs the coherence pair (`roadmap-overview`, `docs-check`) before committing, and `improve` also searches the old wording across `docs/` and the project instructions, because tools check structure, not meaning.

## Tools (`<stareso>/tools/`, plain Node, no install)

| Tool | Use |
|---|---|
| `slice-done.mjs <id> --model m --tokens n --note "…"` | merges the slice branch `--no-ff`, ticks the box, flips 🛠 → ✅ in IDEAS, writes the BUILD-LOG line (with `--harness`, `--helper` and `--tier`, which default to the `Harness:` and `Helpers:` lines of the project instructions, else claude-code and subagent, and to the brief's tier), regenerates the overview, commits |
| `docs-check.mjs` | coherence of the records (ticked slice without log line, stale 🛠, broken `after:`, missing `Pack:`, docs not listed, version mismatch, old files) |
| `roadmap-overview.mjs` | regenerates the overview (milestones with their Kind, then the open slices) of `ROADMAP.md` |
| `roadmap-split.mjs` | one-off: splits an old single-file roadmap into the folder layout |
| `progress-graph.mjs [--brief] [--write] [--widget]` | the graph of the build advancement and its data, from the records and `git worktree list` only (see "The progress graph" below); writes only outside the project |
| `session-stats.mjs --log` | the usage reader (Claude Code transcripts): from inside a project, regenerates `docs/USAGE.md` (tokens by kind and by model, never as money; every session of the project and its worktrees, kind, active hours, models, turns, user messages, compactions, context per turn, output and cache tokens, helpers; retro sessions apart; forks counted once; glossary, totals, highlights line, cost per slice from the `Merge slice` commits, turns-per-model table). Build and test run it at the end |
| `session-stats.mjs <out> <transcripts…>` | deep retro: per-transcript header and the user-message timeline |
| `harness-build.mjs [--check]` | generates the Claude Code skills and agents from `skills/`, `roles/` and `harness/claude-code/`, printing each file's length before and after; `--check` exits 1 on drift |
| `workflow-changed.mjs` | Claude Code hook, not run by hand: tells a running session that the workflow repository changed (commits, changed steps, packs, helper definitions, stale generated files) so it re-reads the step it is running. Install once per machine from `harness/claude-code/extras/settings.hooks.json`. Silent while nothing changed. |

## The progress graph

`/stareso-status` calls `progress-graph.mjs`, which reads `docs/roadmap/*.md`, `docs/ROADMAP.md`, `docs/QUESTIONS.md`, `docs/BUILD-LOG.md`, `docs/PLAN.md`, `docs/IDEAS.md` and `git worktree list`, and never the code. It works for every pack and runs in well under a second. `--brief` is the fast status, printed in a code block as it is: a head line, then short sections that read at a glance, Progress (the text graph, one line per milestone with open slices, ■ done, ▶ running, □ waiting), Helpers (one line per running helper with its slice, model, minutes and title), Usage, Pace, Waits for you and Could start now. The same items exist as single lines in the JSON (`lines`). Without a flag it prints the same data as one compact JSON, `--text` prints the text graph alone, `--widget` prints the SVG for a chat widget, and `--write [dir]` writes `progress.svg` (standalone, light and dark, a tooltip on every node), `progress-widget.svg` and `progress.html`, in the system temp folder by default and never inside the project. Status draws the SVG only when asked (`/stareso-status graph`), because the drawn graph costs a few thousand tokens and status runs often.

- **Lanes.** One lane per milestone with open slices, each slice a small node labelled with its short id (`11.2`, `tidy`) and colored teal (done), amber (a helper is running on it) or gray (waiting), with a dashed outline when the slice is for the user and a small dot when it runs on the strong tier (Opus, the costly slices). A thin line joins a slice to the next one when that one's `after:` names it. Lettered milestones (`H`, `P`, `Q`) are one block each, never slice by slice, and the first one that waits on the user also counts the open questions and those that block a slice. Finished milestones collapse into one banner (`M1 to M5, M8, M9, M10 · every slice done`), and `--max-lanes` (default 8) caps the lanes, the rest being named in a line.
- **Running.** A helper is a worktree (or the project folder) on a branch `slice/<id>-…` whose slice is still open, with the minutes since its folder was made. The newest `Merge slice` commits come back as `recentMerges`.
- **Mode.** The indicator beside the banner shows the profile of the newest logged merge (`eco`, `fast`, `night` or `day`) and the number of helpers running now. `mode.available` lists the profiles the project's pack allows, because they vary by pack (`night` and `day` come with `godot-game`).
- **Ready, human, questions.** `ready` holds the open slices of numbered milestones whose `after:` slices are done, that no helper runs and no open question blocks (a tidy slice waits for the rest of its milestone). `humanSlices` are the open `[human]` slices, and `questions` counts the open ones and lists those that block a slice.
- **Pace.** The time one slice takes is the median gap between two consecutive merges of serial runs (`eco`, `day`) in BUILD-LOG, gaps over 90 minutes being left out. The helpers running now share the open slices of numbered milestones, but the longest chain of open slices stays serial, so the ETA is the larger of the two figures, and the line says which one binds. Run one after the other, the same slices give the upper bound. Without serial merges in the log, the recent gap between merges stands in, undivided, since it already holds the parallelism of that run.
- **Usage and caps.** Status passes the usage windows the host shows (`--five <pct>@<reset>`, `--week <pct>@<reset>`). The tool keeps the readings of the same window from the last three hours in `usage.json` next to the graph files, works out the burn rate from the oldest of them (or from the average since the window opened when there is one reading), and says when each stop cap will be reached at that rate, or that the window resets first. The caps come from the newest `caps` line of BUILD-LOG, which a build writes when it starts with caps (`- yyyy-mm-dd HH:mm · caps · helper start 85 % · pause 90 % · weekly 95 % · deadline 18:30`), or from `--caps 85/90/95` when the user gave them in the conversation.

## Packs

A pack = a folder `packs/<name>/` with `README.md`, `guide.md` (conventions by numbered section, commands, verification, default roadmap), `templates/` (the project instructions with the Commands table, gitignore, starting files) and, for things that go online or get delivered, `deploy.md`. `PLAN.md` names the pack, and steps, helpers and briefs read only the sections they need.

| Pack | For |
|---|---|
| `app-next` | small team web app: Next.js, Postgres (Supabase), Vercel, PWA, browser-pane verification |
| `analysis-r` | data analysis in R: `config/paths.yml`, `R/` modules, `main/` steps, tests + regression snapshot, figures, Quarto HTML report |
| `godot-game` | 2D game in Godot 4 for PC and tablets: data-driven entities, the gate (`check.sh`), off-screen and silent windowed runs, content recipes, tunables and the playtest checklist, slice kinds (spike, tune, content, art), release steps |

A new kind of work (a model, a document review, another stack) gets its pack written from its first real project, as these two were: copy the closest pack, keep the section layout, change the content. The steps do not change.

## Privacy, in short
- Everything in `private/` and the data folders stays private. Reading a file sends it to the model, so the assistant reads only files you moved to (or approved for) `readable/`. Datasets are seen as structure only, through a script you agree to run. Development uses toy samples, and you run real imports.
- The rule is in the project instructions and in every helper role. Where the harness can enforce it (Claude Code: deny rules in `.claude/settings.json`; other harnesses: `harness/<harness>/capabilities.md`), init and retrofit install the guard and check it with a canary file, and the result is the `Guard:` line of `docs/PLAN.md`. In a chat window, never upload a private file.

## Keeping the context small
- Each phase in its own session, one build session per milestone: the files are the memory, not the chat. `/clear` + `/stareso-status` beats a compaction.
- The conductor sees reports and failures, never full tool output. Helpers are fresh and read only their brief and the named guide sections.
- Human input is batched (test rounds), never streamed into a running build.
- Records are generated by the tools, in one format. Finished material moves to `-DONE` files, and a tidy slice closes every milestone.

## Changing the workflow
Edit the step in `skills/`, the role in `roles/`, the pack or the template, in harness-neutral wording (`harness/README.md`, "Keeping the core harness-neutral"). Run `tools/harness-build.mjs` and check that `--check` passes, then add a line to `CHANGELOG.md`. The retro proposes such changes, and you accept them one by one. Measure before and after with `session-stats.mjs`, and evaluate a capability on a new harness as `metrics.md` says.
