# Going online with the `app-next` pack (GitHub · Supabase · Vercel · Cloudflare DNS)

Read by `stareso-deploy`. The user does every step in the providers' consoles; Claude prepares files and gives one step at a time.

## Pre-flight (one message, the user answers yes / no to each)
1. The Supabase account has a free project slot (two free projects per account; a second account was needed for project C).
2. The GitHub repository will be **private**, on the **personal** account (Vercel's free plan refuses private organisation repositories). Check afterwards: `gh repo view --json visibility`.
3. In Vercel the Framework Preset will be **Next.js** (imported as "Other", every page is a 404).
4. Environment values are pasted **raw**: no `NAME=`, no quotes, no spaces.
5. The Storage key is a **server** key (`service_role` or `sb_secret_…`), never the anon / publishable key ("Bucket not found" on a private bucket).
6. Bucket names in Supabase equal the env values (`PHOTO_BUCKET` …).
7. Every environment-variable change is followed by a **redeploy**.
8. "No such domain" right after adding the subdomain can be the local DNS cache: test from the phone first.
9. The Vercel connector (if used) is authorised on the team, not only the personal scope.

## Prepare (Claude, on a branch, then merge)
- `vercel.json` from `templates/vercel.json`: the region next to the database (`cdg1` Paris for Supabase eu-west-3, `fra1` for eu-central-1, `lhr1` for eu-west-2) and the `ignoreCommand` that skips the build when a push only changes `docs/`, `tests/` or `CLAUDE.md` (guide §15). Without it every docs commit redeploys the app and shows the update banner on every open phone.
- `/api/health` (public, one tiny real query, answers only ok / error) and `proxy.ts` letting it through.
- `.github/workflows/keep-alive.yml`: Monday and Thursday 06:00 UTC, 3 tries, calls `${{ vars.APP_URL }}/api/health`.
- `.env.example` complete; scripts `db:init-online` (refuses if data exists; refuses every seed with `dev` or `demo` in its name), `db:migrate-online`, `db:backup-online`, `assets:push-online` when there is a Storage bucket.
- `docs/DEPLOY.md`: the steps below with this app's names and checkboxes, plus a "Lessons" section kept up to date.
- Checks: `check`, `test`, then `build` with the dev server stopped (delete `.next` afterwards).

## The user's steps (one at a time, wait for "done")
**A. GitHub.** 1. Private repository, personal account, no README. 2. `git status` shows nothing from `private/` or `.env*`; with their OK: `git remote add origin …`, `git push -u origin main`.

**B. Supabase.** 1. New project, EU region, strong password in a password manager. 2. Project Settings → Database → Connection string → **Transaction pooler** (port 6543); URI with the password, **without the `[ ]`**, into `.env.supabase` (git-ignored) as `DATABASE_URL=…`; Claude never reads this file. 3. `npm run db:init-online` once. 4. Table Editor: tables present, **RLS enabled** on each (no policies). 5. Storage: create the bucket(s) **private**, names as in `.env.example`; `assets:push-online` for photos. 6. Optional: a second project `<app>-test` for previews.

**C. Vercel.** 1. Add New → Project → import the repository → Framework Preset **Next.js**. 2. Environment variables (Production): `DATABASE_URL`, `SESSION_SECRET` (64 hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), code hashes (`npm run hash-code`, **different codes** from local), Storage URL and **server** key, bucket names, API keys. 3. Deploy, open `….vercel.app`, log in, check every tab and one image.

**D. Subdomain (OVH domain, Cloudflare DNS).** 1. Use a subdomain of the organisation's domain (`<app>.<domain>`), never the root. 2. Vercel → Settings → Domains → add it. 3. Cloudflare → DNS → Add record: **CNAME**, name `<app>`, target from Vercel, proxy **DNS only (grey cloud)**. 4. Wait for the certificate; open `https://<app>.<domain>`.

**E. Keep-alive.** 1. GitHub → Settings → Secrets and variables → Actions → **Variables** → `APP_URL`. 2. Actions → "Keep database awake" → Run workflow. Keep the repository private (public repositories lose scheduled jobs after 60 idle days).

**F. Phones.** Install (Android: Chrome ⋮ → Install app; iPhone: Safari → Share → Add to Home Screen; one login from the icon); share codes through a private channel; feedback through `stareso-test` on the online app.

## After going online (end of DEPLOY.md and CLAUDE.md "Status")
- Publishing: branch → push the branch (preview) → merge into `main` → push (production, about a minute). Rollback: Vercel → Deployments → a good version → Promote to Production.
- Database changes: numbered file in `db/migrations/`, test locally, `db:backup-online`, `db:migrate-online` (by hand), then push the code. Never run `schema.sql` online again.
- Backups: `db:backup-online` before any database change and about weekly in season; backups hold real names: keep them in `private/backups/`.
- New access code: new hash in Vercel, redeploy; a new `SESSION_SECRET` logs everyone out.
- Version: every push with a user-visible change bumps the patch version and adds an update-log entry (CLAUDE.md rule).
