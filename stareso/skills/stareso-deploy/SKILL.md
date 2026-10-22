---
name: stareso-deploy
description: Put a stareso project online or deliver it - pre-flight checks, prepared files, docs/DEPLOY.md, then the provider steps of the pack (app-next - GitHub, Supabase, Vercel, subdomain, keep-alive, phones) one at a time, or the delivery of an analysis (rendered report, figures, hand-over), or the release of a game (builds, store pages, signing by the user).
---

# stareso-deploy

**Session:** strong tier · new session · normal mode (steps here go online: never auto mode). If this session runs another model, say so first.

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (usage report "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

Talk in English unless the user switches to French. The process below is the same for every pack; the provider steps come from `<stareso>/packs/<pack>/deploy.md` (read it now). If PLAN §10 chose other providers, adapt and say so.

## Hard rules
- The user does every step in the providers' consoles: accounts, passwords, keys, DNS. Never ask for a secret in chat, never type one, never read `.env.local` / `.env.supabase`.
- Never push without an explicit "yes, push" for that push. Online database commands are run by the user, by hand.
- One step at a time: give the step, wait for "done" (or a problem), then the next. Tick it in `docs/DEPLOY.md`.

## 1. Pre-flight
Send the pack's pre-flight list as **one message**; the user answers yes / no per item. Anything "no" is fixed before step 2.

## 2. Prepare (the assistant, on a branch `deploy-prep`, then merge)
The files the pack's `deploy.md` lists (app: region file, health route, keep-alive workflow, `.env.example`, online scripts; analysis: `render` to the final HTML, exports the plan asks for, a `README` of the deliverable; game: `CREDITS.md`, release notes, store texts, export presets checked, debug builds), then `docs/DEPLOY.md`: the pack's steps with this project's names and checkboxes, and a "Lessons" section. Run `check`, `test`, and the pack's final command (`build` with the dev server stopped; `run` + `render`).

## 3. The user's steps
Follow `deploy.md` of the pack, section by section, one step per message. For an analysis the "steps" are: where the report goes (folder, mail, drive the user names), which files (HTML, PDF or Word export, figures folder, tables), and the version tag (`git tag report-yyyy-mm-dd`).

## 4. After
- Write the "After going online / after delivery" block at the end of `docs/DEPLOY.md` and the status line in `AGENTS.md` (address and date, or delivery date).
- `Phase: deployed` (app), `Phase: delivered` (analysis) or `Phase: released` (game) in PLAN.md; new lessons learned during the steps go to `docs/DEPLOY.md` "Lessons" **and** to the pack's `deploy.md` pre-flight (with a CHANGELOG line), so the next project does not meet them again.
- Next: phone or reader feedback through `/stareso-test` (standard tier, new session) on the online app, the delivered report or the released game.
