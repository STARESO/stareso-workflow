# Guide: building a small team web app the STARESO way

A blueprint for starting a **new, unrelated** app with the same look, structure and habits as project A (safety sheets) and project B (counts in the field). It covers UI and architecture, not the business logic of either app. Used by the `stareso-*` skills (manual: `~/.claude/stareso/README.md`); everything here is a **default** that the grilling can change for a given app (stack and providers included).

Each pattern is tagged with the app it comes from: **[A]** project A, **[B]** project B, **[A+B]** both, **[C]** project C.

**Read only the sections you need** (token economy): the skills point to section numbers.

---

## 1. Target profile (when this blueprint fits)

- A small team (about 10 to 20 people), mostly on **phones and tablets**, often with weak or no signal.
- Installable web app (PWA), one language for the interface (French here), optionally a second one for visitors.
- Data entered in the field, read later as history, a dashboard and spreadsheets.
- Free hosting plans, no background jobs, one maintainer.

---

## 2. Stack [A+B]

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19 + TypeScript strict** | `middleware` is now `src/proxy.ts`. Read `node_modules/next/dist/docs/` before using an API: this version differs from older docs. |
| Styling | **Tailwind CSS v4** (`@tailwindcss/turbopack`) | Colour tokens in `globals.css`, exposed via `@theme inline`. |
| Database | **PostgreSQL** (local for dev, **Supabase EU** online) | Used as plain Postgres through one `DATABASE_URL` with the `postgres` library (`prepare: false` for the Supabase pooler). Never the Supabase SDK. Row-level security on, with no policies, so Supabase's public API is closed. |
| Auth | **`jose`** signed httpOnly cookie | No user accounts: shared access codes. |
| Validation | **`zod`** on the server | Error messages in the UI language, so they can be shown as is. |
| Charts | `recharts` [B] or hand-made SVG [A] | |
| PDF | `jspdf`, loaded only on demand (`import()` on tap) [A] | |
| Hosting | **Vercel**, EU region (`vercel.json`: `"regions": ["cdg1"]` or `"fra1"`) | Deployed from GitHub `main`. `vercel.json` also carries the docs-only build skip (§15). |

**Dependency rule:** keep the list short. Ask before adding a library and write down what it is for.

`next.config.ts` essentials:
```ts
allowedDevOrigins: ["192.168.*.*"],            // test from phones on the same Wi-Fi
env: {
  NEXT_PUBLIC_APP_VERSION: version,             // from package.json [B] or the commit [A]
  NEXT_PUBLIC_APP_BUILD: `${version}+${(process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7)}`,
},
```
Leave `cacheComponents` off: screens are client components, so it only produces warnings.

---

## 3. Folder structure [A+B]

```
.claude/launch.json        dev server config for the preview tool
.claude/settings.json      read guard on private/ (see section 3b)
.github/workflows/keep-alive.yml
docs/
  IDEAS.md                 inbox of raw ideas (discussion, tests, any time)
  PLAN.md                  decided version of the app (single source of truth), "Phase:" line on top
  GLOSSARY.md              domain terms: UI word, meaning, code / DB name
  decisions/NNNN-slug.md   decision records (only hard-to-reverse, surprising, real trade-off)
  ROADMAP.md               milestones of small vertical slices, with checkboxes and test markers
  data/                    records: builds.jsonl (one event per slice), sessions.jsonl
  FEEDBACK.md              test feedback, sorted (bug / change / idea)
  QUESTIONS.md             open questions the build could not answer alone
  DEPLOY.md                deployment checklist [B] (written by stareso-deploy)
db/
  schema.sql               full structure for a FRESH database (wipes everything)
  migrations/001-*.sql     changes on real data, numbered, safe to re-run
  seed*.sql                fake demo data (invented names only)
private/                   git-ignored, never committed, never published
  sources/locked/          reference files, NOT read by Claude (default for everything)
  sources/readable/        reference files the user approved for reading
  sources/INDEX.md         one line per file: name, what it is, status
  data/                    datasets: used by code, Claude sees structure only
  backups/
public/
  icons/                   PWA icons (any + maskable)
  sw.js                    service worker [B]
scripts/
  run-sql.mjs              runs SQL files; refuses schema.sql on a database with data unless --allow-wipe
  migrate.mjs              runs every migration in name order
  backup.mjs               dumps every table to private/backups/<target>-<date>.json
  hash-code.mjs            makes the access-code hash for .env
  make-icons.mjs           draws the icons without any library [A]
src/
  proxy.ts                 auth gate on every request
  app/
    layout.tsx             fonts, theme script, providers, bottom nav
    globals.css            colour tokens + a few utilities
    manifest.ts            PWA manifest
    <tab>/page.tsx         one folder per tab (client components)
    login/ (or connexion/) login page
    api/<resource>/route.ts             GET list / POST
    api/<resource>/[id]/route.ts        GET / PUT (upsert) / DELETE
    api/health/route.ts    public, answers only ok / error
    api/me/route.ts        who am I (role, build version)
    api/login, api/logout
  components/
    ui.tsx                 shared primitives (Button, Field, Sheet, Chip, ...)
    PageHeader.tsx, BottomNav.tsx, ThemeToggle.tsx, ...
    <Feature>Card.tsx, <Feature>Form.tsx, <Feature>Picker.tsx
  lib/
    db/index.ts            the single DB connection ("server-only")
    db/<resource>.ts       SQL queries per resource (server only)
    auth.ts                allow(...roles) / requireAuth() for API routes
    session.ts             sign / read the cookie
    client.ts              browser helpers: api(), apiCached(), newId(), date formats
    schemas.ts             zod schemas
    types.ts               shared TypeScript types
    use<Resource>.ts       client hooks loading data from /api
    i18n.tsx + i18n-en.ts  translations (optional)
CLAUDE.md                  project rules for the AI assistant (see section 17)
.env.example               documents every env variable (no values)
```

Conventions:
- **Code, identifiers, DB columns, commits and comments in English**; everything the user sees in the UI language. Comments are short and explain the *why*.
- Only server code (route handlers) talks to the database. `import "server-only"` in `lib/db` makes the build fail if a browser component imports it.
- Screens are `"use client"` pages that fetch `/api/*`.

### 3b. Private material (all projects)

- Everything under `private/` is private: git-ignored before the first commit, never committed, pushed or published (no artifacts, gists, online docs).
- Reading a file sends its content to the model (not published, but it leaves the computer): Claude reads a reference file only once the user approved it, i.e. it sits in `private/sources/readable/`. Moving a file does not read it.
- Guard in `.claude/settings.json`: `permissions.deny` on `Read(./private/sources/locked/**)` and `Read(./private/data/**)`. The rule also forbids reading them through shell commands (`cat`, `head`, scripts printing rows).
- Datasets: Claude learns their **structure only** (columns, types, row counts, empty cells) through a small script the user agreed to run; any script on private data prints counts and errors, never rows. Development uses a **fake sample** with the same columns and invented values. Real imports: Claude writes the script, the user runs it.

---

## 4. Design system [A+B]

### 4.1 Mood
Warm neutrals and a calm sea-blue accent (fonts, spacing and cards in the spirit of the Claude app; its clay accent is orange, which here means alert). **Dark by default**, light via a sun/moon toggle, remembered per device. Serif titles, sans body, mono for numbers and times.

### 4.2 Colour tokens (`src/app/globals.css`)
Components **never use raw colours**, only token classes (`bg-surface`, `text-muted`, `border-border`, `bg-accent`...). The theme switch only swaps values.

```css
@import "tailwindcss";

:root {                     /* dark, default */
  --bg: #161514;            /* page */
  --surface: #262523;       /* cards, header, tab bar */
  --surface-2: #363531;     /* inputs, nested blocks */
  --border: #4d4b46;
  --text: #f5f4ef;
  --muted: #b0ada4;
  --accent: #5aa9d6;        /* sea blue: main buttons, active tab, focus, selected values */
  --accent-strong: #3f92c2;
  --on-accent: #0d1b22;     /* dark text on the light blue keeps contrast */
  --ok: #7fb069;
  --warn: #e0a43a;
  --caution: #e3c84a;
  --danger: #e5675b;
  /* category colours of the new app go here (never red or orange) */
  --card-shadow: 0 1px 0 rgb(255 255 255 / 0.04) inset, 0 2px 6px rgb(0 0 0 / 0.35);
  color-scheme: dark;
}
:root[data-theme="light"] {
  --bg: #efede5; --surface: #ffffff; --surface-2: #f3f1ea; --border: #d6d2c6;
  --text: #1f1e1d; --muted: #615e57; --accent: #1f6f99; --accent-strong: #185b7e; --on-accent: #ffffff;
  --ok: #3f7d2c; --warn: #b7791f; --caution: #8a7300; --danger: #c0392b;
  --card-shadow: 0 1px 3px rgb(60 50 30 / 0.12);
  color-scheme: light;
}
@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-surface-2: var(--surface-2);
  --color-border: var(--border); --color-text: var(--text); --color-muted: var(--muted);
  --color-accent: var(--accent); --color-accent-strong: var(--accent-strong); --color-on-accent: var(--on-accent);
  --color-ok: var(--ok); --color-warn: var(--warn); --color-caution: var(--caution); --color-danger: var(--danger);
  --font-sans: var(--font-geist-sans); --font-mono: var(--font-geist-mono); --font-serif: var(--font-source-serif);
}
body { background: var(--bg); color: var(--text); transition: background-color .2s, color .2s; }
@utility shadow-card { box-shadow: var(--card-shadow); }
.pb-tabbar { padding-bottom: calc(4.5rem + env(safe-area-inset-bottom)); }
.no-scrollbar { scrollbar-width: none; } .no-scrollbar::-webkit-scrollbar { display: none; }
```

Rules:
- Three clearly separate levels: **page < cards < inputs**.
- **Red and orange mean alerts only**, including the accent: never pick an orange or red accent, tag, focus ring or selected state. An app may let each person pick their accent among 5–6 calm tokens (stored on the account, applied before paint like the theme) [C]. Category colours (types, groups...) come from a calm palette; they can be made admin-editable and injected as CSS variables at runtime [A].
- Tints are mixes of a token: `bg-accent/15 text-accent`, `color-mix(in srgb, var(--accent) 35%, transparent)`.
- Charts: SVG attributes can't read `var(--x)`, so read the computed tokens in a hook and re-read them when `data-theme` changes (`useChartColors`, a `MutationObserver` on `<html>`) [B].

### 4.3 Fonts (`layout.tsx`)
`next/font/google`: **Geist** (body), **Geist Mono** (times, numbers, `tabular-nums`), **Source Serif 4** (page and card titles, `font-serif`).

### 4.4 Theme without a flash
A tiny `beforeInteractive` script sets `<html data-theme="light">` from localStorage before paint; `<html suppressHydrationWarning>`. The toggle uses `useSyncExternalStore` over `document.documentElement.dataset.theme`.

### 4.5 Sizes and touch
- Touch targets **at least 44 px** (`min-h-11`); big buttons `min-h-12`. Usable with wet or gloved hands.
- Rounded `rounded-xl` for inputs and buttons, `rounded-2xl` for panels, `rounded-full` for chips.
- Labels above fields: `text-xs font-medium uppercase tracking-wide text-muted`.

---

## 5. App shell and layout [A+B]

```
┌──────────────────────────────┐  sticky header: logo + app name (tiny caps) + screen title (serif)
│ ◉ APPNAME                ⚙ ☀ ⎋│  right: optional action, settings, theme, logout
│   Screen title               │  safe-area-inset-top padding
├──────────────────────────────┤
│ [alert banners]              │  emergency / update / offline, full width
│                              │
│  cards...                    │  max-w-3xl/5xl mx-auto px-4, gap-3/4
│                              │
├──────────────────────────────┤
│  ⛵    📍    👥    📊         │  fixed bottom tab bar, h-16, icon + label
└──────────────────────────────┘  safe-area-inset-bottom padding
```

- **Bottom tab bar** fixed, 3 to 5 tabs, line icons (24 px, stroke 1.8, `currentColor`), active tab in `text-accent`, others `text-muted`. Hidden on the login page. Tabs filtered by role.
- Page content wrapped in `.pb-tabbar` so nothing hides behind the bar.
- `viewport: { viewportFit: "cover" }` + `env(safe-area-inset-*)` for notches.
- Header: `sticky top-0 z-10 bg-surface/95 backdrop-blur border-b`.
- Settings (⚙) is a page opened from the header; tapping ⚙ again (or "← Retour") goes back [A].
- Two columns only on wide screens (`lg:`); everything works at **320 px**, and project B tightened that to **280 px**: nothing may go past its card or the screen edge (`min-w-0`, `truncate`, `minmax(0,1fr)`, `flex-wrap`). Check 280, 320, 375 px and desktop after every UI change [B].
- Heavy tabs can be loaded on first visit with `next/dynamic`, so the field screen starts fast on poor signal [B].

Provider stack in the root layout (order matters):
```tsx
<LangProvider>          // optional i18n
  <RoleProvider>        // /api/me → role, cached in sessionStorage to avoid flicker
    <ConfirmProvider><ToastProvider>
      <LiveProvider>    // polling, data version, update banner
        <div className="pb-tabbar flex flex-1 flex-col">{children}</div>
        <BottomNav />
      </LiveProvider>
    </ToastProvider></ConfirmProvider>
  </RoleProvider>
</LangProvider>
```

---

## 6. UI primitives (`src/components/ui.tsx`) [A+B]

Build these once; every screen uses them.

| Component | Behaviour |
|---|---|
| `Button` | variants `primary` (accent), `secondary` (surface-2 + border), `ghost`, `danger` (danger outline); `min-h-11 rounded-xl px-4 text-sm font-medium`; `type="button"` by default. |
| `Field` | label + child + optional hint. **A `<label>` must never wrap buttons** (a click anywhere hits the first button); use a `<div role="radiogroup">` for chip groups. |
| `TextInput`, `inputClass` | `min-h-11 rounded-xl border bg-surface-2 px-3 text-base` (16 px stops iOS zooming), focus `border-accent`. Disabled = read-only look (transparent, normal text colour). |
| `NumberInput` | keeps empty as `null`, accepts a comma as decimal point, `inputMode="numeric"/"decimal"`. |
| `SuggestInput` | free text **plus** a custom dropdown: tapping shows all choices, typing narrows (accent-insensitive). Not `<datalist>` (it hides choices that don't match the current value). Optional tag per choice and a ✕ to remove a choice. |
| `TimeInput` | 24 h `HH:mm` text box (`1405` → `14:05`), mono, never `<input type="time">` (its look depends on the phone's locale). |
| `DateInput` | shows `dd/mm/yyyy`, stores ISO `yyyy-mm-dd`, typing `15102026` works, a calendar button opens the native picker through a hidden `type="date"`. |
| `Chip` | rounded-full filter / choice pill, tones per category, optional colour dot; wraps on narrow phones. |
| `Badge` | small tag `rounded-md px-1.5 text-xs`, tinted background (`bg-x/15 text-x`). |
| `Toggle` | switch row (`role="switch"`). |
| `FoldButton` / `Section` | card header that folds open/closed with a rotating chevron; `<details>` version works without JS [B]. Folded state can be kept per phone in localStorage. |
| `Sheet` | bottom sheet on phones, centred dialog on tablets; rendered with a portal to `document.body`; Escape and backdrop close it. Used for edit forms. |
| `useConfirm` | in-app confirmation, **never `window.confirm`** (blocked in some installed apps). `const ok = await ask("…", { danger: true })`. **Every deletion (and every other destructive action: archive, merge, reopen a locked record) asks first** in this pop-up: message naming what will go, "Annuler" + a red confirm button ("Supprimer"). Never delete on a single tap. |
| `useToast` | short message above the tab bar, disappears after about 4.5 s, `role="status" aria-live="polite"`, tone dot ok/warn [B]. |
| `DemoTag` | dashed "Démo · données fictives" tag, so fake data is never mistaken for real data [A]. |
| `AppVersion` | "AppName v1.2.0 · abc1234" line at the bottom of every screen and the login page, to know which build a phone runs [B]. |

Screen recipe: `PageHeader` → banners → a primary action (`+ Nouveau …`) → filters (chips) → list of cards → `Sheet` for edit forms → `{dialog}` from `useConfirm`.

Lists: one card per item, title in serif, tags under the title on phones, secondary info in `text-muted`. Urgent / to-do items sort first. Calendar or heatmap tinted by activity per day, tap a day to scroll to its items (with a short flash).

---

## 7. Formats and wording [A+B]

- **Times:** 24 h `HH:mm` everywhere. **Dates:** written out where there is room ("mardi 14 octobre 2026"), numeric `dd/mm/yyyy` on screen, ISO `yyyy-mm-dd` in DB and API. Build ISO dates in the **phone's local time zone**, never from `toISOString()` (UTC can shift the day).
- Plural helper: `count(3, "palanquée", "palanquées")`.
- Names normalised on the server (`Camille` / `Exemple`) whatever was typed.
- Item titles built from their key fields ("15/10/2026 · Site").

---

## 8. Access control [A+B]

No per-person accounts; shared codes typed on a login page.

- **Simple version [B]:** one shared code. `ACCESS_CODE_HASH` in env, `requireAuth()` in every route.
- **Roles version [A]:** `admin` (one code), `staff` (team code), `guest` (personal codes made by the admin, with an end date, revocable, stored hashed in an `invites` table). The login page shows the kinds of access as chips; only that kind of code is checked.
- Codes are stored **only as hashes** (`scrypt:<salt>:<hash>` with `:` not `$`, which Next.js expands in `.env`). Compare in constant time; trim and lowercase what was typed.
- Session = **signed httpOnly cookie** (`jose`, HS256, `SESSION_SECRET` of at least 32 characters, refuse to start otherwise). Valid a week after the last use; "Rester connecté" = 90 days; renewed once a day by `proxy.ts`.
- `src/proxy.ts` runs on every request: no session → pages redirect to `/login?suite=<path>` (follow only internal paths, never `//…`), API routes answer 401 with a readable message. Public paths: login page, login route, `/api/health`. Team-only pages redirect guests.
- **Every API route checks the role on the server** (`const a = await allow("admin", "staff"); if (a instanceof Response) return a;`). Hiding a button is not security. Screens read the role from `/api/me` only to shape the UI; while it is unknown they show the safe, reduced view.
- Login attempts rate-limited in a `login_attempts` table (by IP, from `x-forwarded-for`).

---

## 9. Data patterns [A+B]

- **Ids are UUIDs created on the device** (`newId()` with a fallback when `crypto.randomUUID` is missing on plain HTTP). Saves are **idempotent upserts** (`PUT /api/x/:id`), so a retry never duplicates and an offline queue is possible.
- Client helper `api<T>(url, init)`: fetch + JSON, throws the server's message. `apiCached(url)` reuses list answers under 1 minute old; any non-GET clears the cache [A].
- **Autosave** 0.8 s after typing; key actions (start / stop) save at once [A].
- **Same data on every phone [A+B]:** an `app_state` row with `changed_at`, bumped by row triggers on every table. A small polling request (`/api/live` or similar, 10 s when something is live, 30 s otherwise, **only while the page is visible**, at once when it comes back) returns it in a header; when it moved, clear the cache and dispatch an event; screens add `useDataVersion()` to their effect dependencies and reload. Do not reload a form that has unsaved typing.
- **History of changes:** before an edit or delete of a finished record, copy it to a `revisions` table (jsonb snapshot + reason). Locked records can be enforced by a **database trigger**, not only by the UI [A+B].
- Soft states instead of deletes: `active=false` (archived), `cancelled`, `needs_review` ("À compléter") for quick-added or imported rows.
- **Do not hide possible duplicates:** flag them in a panel where they can be merged (after a confirmation pop-up) or dismissed (`dismissed_duplicates`) [B].
- Summaries computed by the database (one SQL query per stats endpoint), not by downloading everything. Lists load one year at a time.
- Quick-add: typing an unknown name in a picker creates a minimal record marked "à compléter" [A].
- Sensitive data: store the minimum (e.g. dates only, never the document).

---

## 10. Database workflow [A+B]

- `db/schema.sql` describes the full structure for a **fresh** database and wipes it. The runner refuses to run it on a database holding data unless `--allow-wipe`.
- Changes on real data: new numbered file in `db/migrations/` (`IF NOT EXISTS`, safe to re-run). Order: test locally → back up online → migrate online → push the code that needs it. Keep `schema.sql` in step.
- Env files: `.env.local` (local Postgres), `.env.supabase` (online pooler URI, port 6543). Scripts take `local` / `online` (`node --env-file=...`).
- Commands touching the online database are **run by hand by the maintainer**, never automatically.
- `db:backup-online` saves every table to `private/backups/online-<date>.json`; `db:pull-online` copies online data to local [A].
- Imports from old tools (spreadsheets, KoboToolbox CSV) are scripts with fixed ids, so re-running only adds new rows.
- **One dev rebuild command [C]:** when the development data needs more than the seeds (imported photos, maps, pictures, seeds that need those imports), add `npm run dev:rebuild` from the first such import: reset + every import + late seeds, in order, printing counts only. CLAUDE.md, the helper rules and the roadmap header name it; nobody (helper, build, test) runs the bare reset alone, which silently drops the imported files and makes the app look broken during a test.

---

## 11. Installable app (PWA) [A+B]

- `src/app/manifest.ts`: name, `short_name`, `lang`, `start_url` (the main tab), `display: "standalone"`, `theme_color`, `background_color` (the brand colour, never black: it showed as a dark ring on Android), icons `any` (mark on transparency) and `maskable` (colour edge to edge), 192 and 512.
- `appleWebApp: { capable: true, statusBarStyle: "black-translucent" }` in `metadata`; `apple-icon.png` with no transparency.
- Icons drawn by a small Node script with no library [A].
- **Install card [B]:** explains Android (Chrome ⋮ → Installer l'application) and iPhone (Safari → Partager → Sur l'écran d'accueil) steps; shows a real install button when the browser fires `beforeinstallprompt`; hides itself when already installed (`display-mode: standalone`). On iPhone the installed app does not share Safari's session: one login from the icon is needed.

---

## 12. Offline and poor signal [B] (project A: planned, not built)

The project A data design (client UUIDs, idempotent upserts) was made for this; project B implements it:

1. **Service worker** `public/sw.js`, registered **in production only** (it fights hot reload in dev):
   - `/_next/static`, icons, images: cache first (file names change per build).
   - Page navigations: network first, then the last stored copy of the app.
   - **`/api/*` is never cached.** Never store the login page or a redirect to it as the app.
   - A `VERSION` string in the cache names; changing it drops old caches on activate.
   - After registration, the page copies the files it already loaded into the caches ("prime caches"), because the first visit happens before the worker controls the page.
2. **Outbox queue** (`saveX(item, { queue: true })`): try the PUT; on network failure or 5xx keep the item in localStorage; on 4xx throw (a refused item would block the queue forever); on 401 keep it and ask for the code again. `flushQueue()` runs on `online`, on demand, and every 30 s while visible; a toast says "n éléments envoyés au serveur".
3. **Offline login:** after an online login, keep a PBKDF2 (200 000 iterations, random salt) hash of the code on the phone, so the app can be opened with no network; the server checks the real code again before anything is sent.
4. **Last known data:** keep the last stats / lists answer in localStorage with its time, show "Hors ligne : données du …".
5. Show the sync state: number of items waiting on the phone.

---

## 13. Live, alerts, updates [A+B]

- **Alert banners** at the top of every page (red for emergencies, `caution` yellow for warnings), with a link to the item and a "Vu" button. Sound and vibration once per alert, never repeated; sound needs a first tap on the page; iPhones do not vibrate [A].
- **New version:** the server returns its build (header on the polling request [A] or field in `/api/me` [B]); an older copy shows "Nouvelle version disponible · Recharger". After an update, one toast "AppName a été mis à jour (v…)" (last build seen kept in localStorage) [B]. Checks on open, on return to screen and every 10 minutes.
- **Demo mode** on one phone only (sessionStorage, ids `demo-…`, nothing saved, auto-stop after a few minutes, every fake item marked with `DemoTag`) is a cheap way to train people without polluting data [A].

---

## 14. Data out: spreadsheets and documents

- **CSV export [B]:** a GET route returning `text/csv; charset=utf-8` with a **BOM** (`"﻿"`), `;` separator and `\r\n` line ends, so French Excel opens it directly; `Content-Disposition: attachment; filename="app_items_<yyyy-mm-dd>.csv"`; long format (one row per measured value) is easiest to pivot.
- **PDF on the device [A]:** `jspdf` imported on tap, layout copying the paper form, long values shrink or wrap but are never cut, file name sorted by type then date.
- Planned in both: xlsx export, a read-only Google Sheets copy, scheduled backups to the station NAS.

---

## 15. Free-plan hosting and operations [A+B]

- **Supabase free plan** pauses after 7 days without use: a GitHub Actions job (`.github/workflows/keep-alive.yml`) calls the public `/api/health` Monday and Thursday at 06:00 UTC, 3 tries, fails (GitHub emails the owner) if the database does not answer. Use a repository **variable** `APP_URL` rather than a hard-coded URL [B]. `/api/health` runs one tiny real query and answers only `ok` / `error`.
- Keep transfer low: one small polling request only while on screen, cached lists, summaries computed in SQL, no background jobs (with nobody using the app, nothing runs).
- `docs/DEPLOY.md` checklist [B]: back up, lint + typecheck + build, regions (Supabase EU + Vercel EU), private GitHub repo, Supabase **transaction pooler** URI, Vercel env vars (`DATABASE_URL`, new `SESSION_SECRET`, code hashes), check RLS is on for every table, test on phones, share codes by a private channel. Code rotation = new hash in Vercel + redeploy (changing `SESSION_SECRET` logs everyone out).
- `.env.example` lists every variable with a comment on how to make it; real env files are git-ignored.
- **Docs-only pushes do not deploy** [C]: `templates/vercel.json` has an `ignoreCommand` that exits 0 (skip) when nothing outside `docs/`, `tests/` and `CLAUDE.md` changed since `VERCEL_GIT_PREVIOUS_SHA` (the last successful deployment), and exits 1 (build) in every other case, including an empty or unknown previous commit. Without it each docs commit redeploys the app, and an app that compares the deployed commit (the update banner) tells every open phone to reload for nothing. Rules: the app never imports from the excluded paths (if a project builds something from `docs/`, take that path out of the list); an app already online gets the file at its next code push, and the first docs-only push after it is checked once with the Vercel connector (no new deployment). Test the command locally against real commit ranges before the push (docs-only range: exit 0, range with `src/` changes: exit 1, empty or bad sha: exit 1).

---

## 16. Development habits [A+B]

- `npm run dev` on a **fixed port** per project (e.g. 3100) so two apps can run side by side; open `http://<laptop-ip>:<port>` on phones over Wi-Fi (GPS, `crypto.randomUUID` and service workers need HTTPS or localhost).
- Check with `npm run lint` and `npm run typecheck` (`next typegen && tsc --noEmit`).
- Run `npm run build` only with the dev server stopped, then delete `.next`. After switching branches or editing `next.config.ts`: stop, delete `.next`, restart (stale CSS otherwise).
- **Git:** one branch per feature, merged into `main` with `--no-ff` once tested; small commits; pushing `main` deploys, so push only with explicit approval.
- `docs/ROADMAP.md` with checkboxes so any session can resume at the first unticked box.
- **Real names and real data** only in the database and `private/`; fake data uses invented names.

---

## 17. CLAUDE.md of a new app

Template: `templates/CLAUDE.md` (filled by `stareso-setup`). Keep it **short**: rules plus pointers. It is loaded on every turn, so the details of each screen live in `docs/PLAN.md`, terms in `docs/GLOSSARY.md`, and anything a tool can check (lint, types) goes in the tool, not in the text.

---

## 18. Default roadmap: vertical slices

Build in **thin vertical slices**: each one goes through every layer it needs (table + route + screen) and leaves something usable in the browser. Never all tables first, then all routes, then all screens. Each slice is small enough for a Sonnet-class model working from its brief alone (format in `templates/ROADMAP.md`).

Typical milestones for a new app (adapt in setup):

**M1. Skeleton**
1. Next.js scaffold, fixed dev port, `allowedDevOrigins`, version env vars, `.claude/launch.json` (sections 2, 16).
2. Tokens, fonts, theme script, `ThemeToggle` (section 4).
3. `ui.tsx` primitives: Button, Field, TextInput, Chip, Badge, Sheet, `useConfirm`, `useToast`, `AppVersion` (section 6).
4. App shell: `PageHeader`, `BottomNav` with the planned tabs as empty pages (section 5).
5. Local database: `lib/db` (server-only), `schema.sql` with only the tables of this milestone, `run-sql.mjs` with the wipe guard, `/api/health` (sections 3, 10).
6. Login: hash script, `session.ts`, `proxy.ts`, `auth.ts`, `login_attempts`, login page, `/api/me`, logout (section 8).

**M2. First resource, end to end** (the main thing the app records)
7. Its table + zod schema + `PUT /api/x/:id` upsert + `GET /api/x` list.
8. List screen with cards (empty state included).
9. Create / edit form in a `Sheet`, client UUIDs.
10. Delete with the confirmation pop-up; revisions copy if the record matters (section 9).

**M3+. One milestone per further feature**, each sliced the same way: second resource, pickers and quick-add, filters / history / calendar, live sync (`app_state` + polling + `useDataVersion`, section 9), dashboard (SQL summaries), CSV export (section 14), PWA manifest + icons + install card (section 11), offline (section 12) if the field has poor signal.

**Last milestone before publishing:** `.env.example` complete, `vercel.json` region, keep-alive workflow, backup script, then `stareso-deploy`.

Every slice ends with lint + typecheck passing and, for UI slices, a check in the preview browser at 280 / 320 / 375 px in both themes (section 5).

---

## 19. Commands (what the skills run) [all]

The skills never name a tool directly: they run the project's named commands from the `## Commands` table of `CLAUDE.md`. Defaults for this pack:

| Name | Command | Notes |
|---|---|---|
| `dev` | `npm run dev` | fixed port per project; started only by the conductor or the user, through the preview tool |
| `check` | `npm run lint && npm run typecheck` | every slice, before merge |
| `test` | `npm test` (`node --test`) | pure functions and the access matrix (§20) |
| `rebuild` | `npm run dev:rebuild` | dev server stopped (§10) |
| `build` | `npm run build` | dev server stopped, delete `.next` afterwards |

## 20. Verification (what "done" means here) [C]

- Per slice: `check` passes; routes are exercised with real sessions through the access matrix test (`npm test`: a table `route · method · role → expected status`, one row added per new route) and, when the brief says `check: now`, by the checker helper at once.
- Per milestone: the `stareso-slice-checker` helper walks every page the milestone touched in the browser pane at 280 / 375 / 1280 px, dark and light, logged in with the dev accounts: nothing wider than its container, touch targets ≥ 44 px, no console error, each slice's "done when" visible, guests refused on count-data pages. It reports a table; problems become fix slices before the milestone's screenshots.
- Per test round: the user, in the browser pane (phone width and desktop), then on real phones once the app is online.
