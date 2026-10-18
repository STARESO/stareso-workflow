---
name: stareso-app-deploy
description: Put a stareso-app project online (GitHub, Supabase, Vercel, custom subdomain via Cloudflare DNS, keep-alive) - prepares the files, writes docs/DEPLOY.md and walks the user through the steps only they can do.
disable-model-invocation: true
---

# stareso-app-deploy

Talk in English unless the user switches to French. Based on how SecuSurf and BaieWatch went online. Defaults below; if PLAN §9 chose other providers, adapt the steps and say so.

## Hard rules
- The user does every step in the providers' consoles: accounts, passwords, keys, DNS. Never ask for a secret in chat, never type one, never read `.env.local` / `.env.supabase`.
- Never push without an explicit "yes, push" for that push. Online database commands are run by the user, by hand.
- One step at a time: give the step, wait for "done" (or a problem), then the next. Tick it in `docs/DEPLOY.md`.

## 1. Prepare (Claude does this, on a branch, then merges)
- `vercel.json` with the region next to the database (`cdg1` for Supabase Paris eu-west-3, `fra1` for Frankfurt eu-central-1).
- `/api/health` (public, one tiny real query, answers only ok / error) and `proxy.ts` letting it through.
- `.github/workflows/keep-alive.yml`: Monday and Thursday 06:00 UTC, 3 tries, calls `${{ vars.APP_URL }}/api/health`.
- `.env.example` complete; scripts `db:init-online` (refuses if data exists), `db:migrate-online`, `db:backup-online`, `hash-code`.
- `docs/DEPLOY.md`: the checklist below, filled with this app's names, with checkboxes.
- Checks: lint, typecheck, then `npm run build` with the dev server stopped (delete `.next` afterwards).

## 2. The user's steps (give them one by one)
**A. GitHub**
1. Create a **private** repository on the **personal** account (Vercel's free plan refuses private repositories of an organisation). No README.
2. Check `git status`: nothing from `private/` or `.env*`. Then, with their OK: `git remote add origin …` and `git push -u origin main`.

**B. Supabase**
1. New project, EU region (Paris eu-west-3 by default), strong database password kept in a password manager.
2. Project Settings → Database → Connection string → **Transaction pooler** (port 6543). Put the URI, with the password and **without the `[ ]` brackets**, in `.env.supabase` (git-ignored) as `DATABASE_URL=…`.
3. Run `npm run db:init-online` once (creates the tables; refuses if data already exists). Then import existing data if planned (the user runs the import script).
4. Table Editor: check the tables and that **RLS is enabled** on each (no policies: only the server connects).
5. Optional but recommended before real use: a second project `<app>-test` for Vercel previews.

**C. Vercel**
1. Add New → Project → import the GitHub repository (Next.js detected).
2. Environment variables (Production): `DATABASE_URL` (same pooler URI), `SESSION_SECRET` (new, 64 hex characters: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), the code hashes (`npm run hash-code`; use **different codes** from the local ones), any API keys. If a test database exists: Preview scope → the test `DATABASE_URL`.
3. Deploy, open the `….vercel.app` address, log in, check every tab.

**D. Custom subdomain (domain registered at OVH, DNS at Cloudflare)**
1. Use a **subdomain** (e.g. `<app>.stareso.work`), never the main domain.
2. Vercel → Project → Settings → Domains → add `<app>.stareso.work`. Vercel shows the record to create.
3. Cloudflare → the domain → DNS → Records → Add record: type **CNAME**, name `<app>`, target = the value Vercel shows, proxy status **DNS only (grey cloud)**. The orange cloud (proxied) gets in the way of Vercel's certificate.
4. Wait until Vercel shows the domain as valid, with its certificate (minutes, sometimes longer). Open `https://<app>.stareso.work`.

**E. Keep-alive**
1. GitHub → repository → Settings → Secrets and variables → Actions → **Variables** → `APP_URL` = `https://<app>.stareso.work` (not a secret).
2. Actions → "Keep database awake" → Run workflow, to test. Keep the repository private (GitHub stops scheduled jobs of public repositories after 60 days without a commit).

**F. Phones**
1. Open the address, install it (Android: Chrome ⋮ → Install app; iPhone: Safari → Share → Add to Home Screen; the installed iPhone app needs one login).
2. Share the codes through a private channel, never by group email.
3. Feedback from the phones: `/stareso-app-test` works on the online app too.

## 3. After going online (write this at the end of DEPLOY.md and in CLAUDE.md "Status")
- Publishing: branch → push the branch (Vercel builds a preview) → merge into `main` → push (production, about a minute). Rollback: Vercel → Deployments → a good version → ⋯ → Promote to Production.
- Database changes: numbered file in `db/migrations/`, test locally, `db:backup-online`, `db:migrate-online` (user), then push the code that needs it. Never run `schema.sql` online again.
- Backups: `db:backup-online` before any database change and about weekly in season.
- New access code: new hash in Vercel, redeploy; a new `SESSION_SECRET` logs everyone out.
- Set `Phase: deployed` in PLAN.md and the address and date in CLAUDE.md "Status".
