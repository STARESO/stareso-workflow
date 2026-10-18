# <AppName>

<One paragraph: what it is, what it replaces, who uses it (~N people, devices, signal).>
**Status:** <in development | in real use since yyyy-mm-dd at https://…>.

Built with the stareso-app workflow (~/.claude/stareso-app/README.md). Plan: `docs/PLAN.md` ·
terms: `docs/GLOSSARY.md` · decisions: `docs/decisions/` · roadmap: `docs/ROADMAP.md` ·
patterns: `~/.claude/stareso-app/guide.md` (read only the sections you need).

## Rules
- **Talk to the user in English** unless they switch to French. App interface language: <…>. Code, identifiers, DB columns, commits and comments in English (comments short, explaining the why).
- **Private material:** everything in `private/` stays private (never committed, never published). Never read `private/sources/locked/` or `private/data/`, not even through the shell; scripts on private data print counts and errors, never rows (guide §3b).
- **Git:** one branch per slice or feature, merged into `main` with `--no-ff` once checked. Pushing `main` publishes the app: push only with explicit approval.
- **Secrets:** never committed, never pasted in chat; `.env.example` documents them.
- **Real names:** database and `private/` only; demo data uses invented names.
- **Dependencies:** ask before adding one and say what it is for. Approved: <postgres, jose, zod, …>.
- **Online database:** commands that touch it are run by hand by the user, never automatically.
- **UI:** tokens only (no raw colours; red / orange = alerts), 44 px touch targets, nothing overflows down to 280 px, every deletion confirmed in the in-app `useConfirm` pop-up (never `window.confirm`), a `<label>` never wraps buttons (guide §4–6).
- If a request conflicts with this file or PLAN.md, say so instead of silently picking one.
- Keep the code simple and readable.

## Stack
<Defaults from guide §2, and any difference decided in PLAN §9.>

## Development
`npm run dev` (port <N>), `npm run lint`, `npm run typecheck`. Run `npm run build` only with the dev server stopped, then delete `.next`.
