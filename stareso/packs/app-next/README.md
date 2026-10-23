# Pack `app-next`: small team web app (Next.js · Postgres/Supabase · Vercel)

The stack and patterns of projects A, B and C. Everything here is a **default** the grilling can change.

| File | What |
|---|---|
| `guide.md` | Patterns by section (stack §2, structure §3, private §3b, design §4–6, access §8, data §9, DB §10, PWA §11, offline §12, deploy §15, roadmap defaults §18, commands §19, verification §20). Skills and briefs point to sections. |
| `deploy.md` | Provider steps for going online (GitHub, Supabase, Vercel, Cloudflare subdomain, keep-alive, phones) and the pre-flight list. Used by `stareso-deploy`. |
| `templates/CLAUDE.md` | Project rules with the Commands table. |
| `templates/gitignore`, `templates/launch.json`, `templates/vercel.json` | Git ignore rules, the preview-tool dev server, and the Vercel config (region and the docs-only build skip). |

Verification in this pack: `check` (lint + typecheck) per slice, the access-matrix test, and the `stareso-slice-checker` helper in the browser pane once per milestone (guide §20).
