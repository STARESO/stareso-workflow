# stareso workflow

Steps, helper roles and shared material used at STARESO to take a piece of work (a small web app, a data analysis) from the first discussion to the delivered result, in small checked slices: a strong model decides, cheap fresh helpers execute, records are generated and kept short. The steps are harness-neutral Agent Skills, and the Claude Code skills and agents are generated from them.

This repository is rooted at `~/.claude`. Its `.gitignore` is a whitelist: only the workflow below is tracked, and credentials, settings, sessions, projects and memory never are.

| Path | What |
|---|---|
| `stareso/START-HERE.md` | One page for someone new to AI assistants |
| `stareso/README.md` | Manual: phases, which step when, which tier and session, profiles, files, tools |
| `stareso/skills/stareso-*/SKILL.md` | The steps, harness-neutral: init, discuss, grill, setup, build, test, improve, status, deploy, retrofit, retro |
| `stareso/roles/` | Helper roles: `slice-builder` builds one slice, `slice-checker` checks one milestone's outputs |
| `stareso/capabilities/` | What a harness must provide (helpers, read guard, automation, model tiers, browser, questions, invocation, usage), each with its manual fallback |
| `stareso/harness/<harness>/` | How each harness provides them, at what level and with what evidence: `claude-code` (adopted), `codex`, `cursor`, `gemini`, `chat-only` (proposed) |
| `skills/stareso-*/`, `agents/stareso-slice-*.md` | Claude Code's generated copies (`stareso/tools/harness-build.mjs`); edit the core, not these |
| `stareso/grilling.md` | How decisions are asked and recorded |
| `stareso/metrics.md` | The retro metrics, how a capability is evaluated on a platform, the no-regression check |
| `stareso/templates/` | Starting docs for a new project (pack-independent) |
| `stareso/packs/<pack>/` | Stack and conventions: `app-next` (Next.js · Supabase · Vercel), `analysis-r` (R · figures · Quarto report) |
| `stareso/tools/` | Node scripts: `slice-done`, `docs-check`, `roadmap-overview`, `roadmap-split`, `session-stats`, `harness-build`, `workflow-changed` |
| `stareso/DESIGN-NOTES.md`, `stareso/CHANGELOG.md` | Why, and what changed |

## Workflow

```mermaid
flowchart LR
    init[init] --> discuss[discuss] --> grill[grill] --> setup[setup] --> build[build]
    retrofit[retrofit: existing project] --> build
    build --> test[test]
    test -- "bugs and changes: fix slices" --> build
    test -- "ideas and rule changes" --> improve[improve]
    improve -- "new slices" --> build
    test -- "all milestones done" --> deploy[deploy / deliver]
    status([status: any time]) -.-> build
```

Docs flow the same way: `IDEAS.md` (inbox) → `PLAN.md` (decided) → `ROADMAP.md` + `roadmap/<ID>.md` (slices) → code; test feedback goes to `FEEDBACK.md`; the build log and the overview are generated.

## Steps, in the order of a project

| Step | Tier (Claude Code) · session · mode | What it does |
|---|---|---|
| `stareso-init` | strong (Opus) · new · normal | Creates the project from a pack: folders, private guard, git, first docs, the workflow chart |
| `stareso-discuss` | strong (Opus) · same · normal | Free talk; keeps `docs/IDEAS.md` |
| `stareso-grill` | strong (Opus) · same · normal | Decision rounds with recommended answers, access table, modes, walkthrough; writes `PLAN.md`, `GLOSSARY.md`, decisions |
| `stareso-setup` | strong (Opus) · same · normal | Project instructions with the Commands table and the roadmap (overview + one file per milestone) |
| `stareso-build` | standard (Sonnet) · new, no worktree · auto | Conductor: one helper per slice, `check`, `slice-done`; checker helper and tidy slice per milestone; eco or fast profile |
| `stareso-test` | standard (Sonnet) · new · normal | Test in the browser pane or on the rendered report; feedback becomes fix slices or ideas |
| `stareso-improve` | strong (Opus) · new · normal | New ideas or decisions → PLAN updates and new slices; coherence check |
| `stareso-status` | any | Where the project stands, debt, and the next step with its tier and session |
| `stareso-deploy` | strong (Opus) · new · normal | Pre-flight and the pack's steps for going online or delivering |
| `stareso-retrofit` | strong (Opus) · new · normal | Brings an existing project into the workflow without rewriting it |
| `stareso-retro` | standard (quick) · strong (deep) | Measured review of the workflow on this project from the records; at most three changes per retro |

`init`, `build`, `deploy` and `retrofit` are started only by typing them, and the others also by asking.

Start with `stareso/START-HERE.md` or `stareso/README.md`. To save a change: edit the core in `stareso/`, run `node ~/.claude/stareso/tools/harness-build.mjs`, then `git -C ~/.claude add -A`, commit, push.
