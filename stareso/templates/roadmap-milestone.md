# M[n]. [Title: what the user gets, not "fixes after the Nth test"]

Kind: feature | fixes | tidy | security | release | human | after-delivery
Ends with: [what the user can see or use at the end of this milestone, one or two lines].
Order: [which slices share files and must run one after the other; the rest is free].

<!-- test: none yet -->

- [ ] **M[n].1 · [Title]** · model: sonnet
  - Goal: …
  - Files: …
  - Steps: …
  - Done when: …
  - Guide: §…
- [ ] **M[n].tidy · Tidy after M[n]** · model: sonnet
  - Goal: no duplicated code, no dead or temporary file, records in one format.
  - Steps: `/simplify` on the milestone diff; shared code into the pack's shared modules; temporary scripts and orphan files removed; (app) `schema.sql` in step with the migrations, i18n dictionary sorted by screen prefix; (analysis) exploration moved to `dev/`, regression snapshot and column READMEs updated.
  - Done when: `check` passes; unpaid debt written as `[debt]` lines in `docs/QUESTIONS.md` with the slice that caused it.
