# stareso-app workflow: user manual

A repeatable way to build small team web apps for STARESO, from first idea to online app.
Why it is built this way: `DESIGN-NOTES.md`. Changes to the workflow: `CHANGELOG.md`.

## Where everything lives

| What | Where |
|---|---|
| The skills (one folder each) | `~/.claude/skills/stareso-app-*/SKILL.md` |
| The helper agent used by the build | `~/.claude/agents/stareso-slice-builder.md` |
| Shared material: this manual, the guide, grilling rules, templates | `~/.claude/stareso-app/` |

On Windows `~` is `C:\Users\aubin`. These three places are one git repository rooted at `~/.claude` (2026-10-18): its `.gitignore` is a whitelist, so only the workflow is tracked and credentials, sessions, projects and memory stay out. After changing the workflow: `git -C ~/.claude add -A && git -C ~/.claude commit -m "…"`, then push to the private remote. A new skill or agent outside these names must be added to the whitelist.

## The skills

| Skill | Start it with | Session | What it does |
|---|---|---|---|
| `stareso-app-init` | `/stareso-app-init <name>` (typed) | Opus | Folder structure, private guard, moves existing files to `private/sources/locked/` unread, git, next-steps checklist |
| `stareso-app-discuss` | `/stareso-app-discuss` or "let's discuss the app" | Opus | Free talk (keyboard or voice), reads approved sources, plays back what it understood, keeps `docs/IDEAS.md` |
| `stareso-app-grill` | "let's grill" / "grill me" / `/stareso-app-grill` | Opus | Numbered rounds with recommended answers; writes `PLAN.md`, `GLOSSARY.md`, decision records |
| `stareso-app-setup` | `/stareso-app-setup` | Opus | Short `CLAUDE.md` + roadmap of small self-contained slices in milestones |
| `stareso-app-build` | `/stareso-app-build M1` or `3-8` or `all` (typed) | **new** session, Sonnet, auto mode | Conductor: one helper per slice, checks, merges locally, one line per slice with tokens |
| `stareso-app-test` | "test time" … "end test" | same session as the build | App in the browser pane, checklist of what is new, feedback → `FEEDBACK.md`, fix slices, ideas to IDEAS.md, short retro |
| `stareso-app-improve` | `/stareso-app-improve` or "I have a new idea" | **new** session, Opus | One idea: discussion + grilling → PLAN.md → new slices |
| `stareso-app-status` | "where are we?" / `/stareso-app-status` | any | Phase, progress, what waits for you, the next step |
| `stareso-app-deploy` | `/stareso-app-deploy` (typed) | Opus | Prepares files, `docs/DEPLOY.md`, walks you through GitHub, Supabase, Vercel, Cloudflare subdomain, keep-alive, phones |

Typed-only skills (`init`, `build`, `deploy`) cannot be started by Claude on its own: they create things, spend tokens or go online. The others can also be started by saying it, by voice too, but only when you clearly ask.

## Your routine

1. Create an empty folder for the app, open a session there (Opus), run `/stareso-app-init <name>`.
2. Put reference files in `private/sources/locked/`. Claude asks before reading any of them.
3. Talk (`discuss`), as long as you want, over several sessions if needed.
4. Say **"let's grill"**. Answer the rounds ("1 yes, 2 yes, 3 no, rather…").
5. `/stareso-app-setup`, review the milestones, accept.
6. **New session**, Sonnet, permission mode auto: `/stareso-app-build M1`. Confirm the run (range, cap, parallel 1) and leave it working.
7. When it reports: **"test time"** in the same session; test in the browser pane; give feedback; **"end test"**.
8. Fixes: `/stareso-app-build` again (same session is fine). New ideas: new Opus session, `/stareso-app-improve`.
9. Repeat 6–8 per milestone. Coming back after a break: `/stareso-app-status`.
10. Ready to go online: `/stareso-app-deploy`. Phone feedback afterwards: `test` on the online app.

## Files in each app

`docs/IDEAS.md` (inbox) → `docs/PLAN.md` (decided, single source of truth) → `docs/ROADMAP.md` (slices).
Also `docs/GLOSSARY.md`, `docs/decisions/`, `docs/FEEDBACK.md`, `docs/QUESTIONS.md`, `docs/BUILD-LOG.md`, `docs/DEPLOY.md`.
`private/` (never committed or published): `sources/locked/`, `sources/readable/`, `sources/INDEX.md`, `data/`, `backups/`.

## Privacy, in short

- Everything in `private/` stays private. Reading a file sends it to the model (not published, but it leaves the computer), so Claude reads only files you moved to (or approved for) `readable/`.
- Datasets: structure only (columns, types, counts), through a script you agree to run. Development uses fake samples. You run real imports.
- A guard in each project's `.claude/settings.json` blocks Claude's reading tools on `locked/`, `data/`, `backups/` and the env files.

## Keeping the context small

- Each phase in its own session; the files are the memory, not the chat.
- Build: the conductor keeps only short reports; each slice is a fresh helper; checks use page text, screenshots only at the end of a milestone.
- Per project, keep only the connectors you need (`+` menu → Connectors). No extra memory files or plugins.
- Forks only for short side questions during a discussion, never as the main workflow.

## Changing the workflow

Edit the skill or file, then add a line to `CHANGELOG.md`. The test retro proposes such changes; you accept them one by one.
