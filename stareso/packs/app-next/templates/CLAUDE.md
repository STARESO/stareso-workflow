# [AppName]

[One paragraph: what it is, what it replaces, who uses it (~N people, devices, signal).]
**Status:** [in development | in real use since yyyy-mm-dd at https://…].

Built with the stareso workflow (`~/.claude/stareso/README.md`), pack `app-next`. Plan: `docs/PLAN.md` ·
terms: `docs/GLOSSARY.md` · decisions: `docs/decisions/` · roadmap: `docs/ROADMAP.md` (briefs in `docs/roadmap/`) ·
patterns: `~/.claude/stareso/packs/app-next/guide.md` (read only the sections you need).

## Rules
- **Talk to the user in English** unless they switch to French. App interface language: […]. Code, identifiers, DB columns, commits and comments in English (comments short, explaining the why).
- **Private material:** everything in `private/` stays private (never committed, never published). Never read `private/sources/locked/` or `private/data/`, not even through the shell; scripts on private data print counts and errors, never rows (guide §3b).
- **Git:** one branch per slice (`slice/[id]-short-name`), merged into `main` with `--no-ff` once checked (`slice-done` tool). Pushing `main` publishes the app: push only with explicit approval.
- **Deploys:** a push that only changes `docs/`, `tests/` or `CLAUDE.md` skips the Vercel build (`ignoreCommand` in `vercel.json`), so it makes no deployment and no update banner. The app never imports from those paths.
- **Stay in the project folder:** create files and folders only inside it, never beside it or elsewhere on the disk. Worktrees live in `.claude/worktrees/` (git-ignored). The only exceptions are the tool's own scratch and memory folders, and the workflow repo `~/.claude` when the user asks to change the workflow.
- **Secrets:** never committed, never pasted in chat; `.env.example` documents them.
- **Real names:** database and `private/` only; demo data uses invented names.
- **Dependencies:** ask before adding one and say what it is for. Approved: [postgres, jose, zod, …].
- **Online database:** commands that touch it are run by hand by the user, never automatically.
- **UI:** tokens only (no raw colours; red / orange = alerts only), 44 px touch targets, nothing overflows down to 280 px, every deletion confirmed in the in-app `useConfirm` pop-up (never `window.confirm`), a `<label>` never wraps buttons (guide §4–6).
- **Modules, not copies:** a feature lives in its own module (folder or component); extend the module named in the brief, never duplicate a component or a script. Shared script code lives in `scripts/lib-*.mjs`.
- If a request conflicts with this file or PLAN.md, say so instead of silently picking one.
- Keep the code simple and readable.

## Stack
[Defaults from guide §2, and any difference decided in PLAN §10.]

## Commands
| Name | Command | Notes |
|---|---|---|
| `dev` | `npm run dev` | port [N]; started only through the preview tool, by the conductor or the user |
| `check` | `npm run lint && npm run typecheck` | before every merge |
| `test` | `npm test` | `node --test`: pure functions + access matrix |
| `rebuild` | `npm run dev:rebuild` | dev server stopped |
| `build` | `npm run build` | dev server stopped, delete `.next` afterwards |

## Development
Dev accounts and test codes: `.env.development` and the seed headers (test values only, never active online).
