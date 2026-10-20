---
name: stareso-build
description: Build a range of roadmap slices of a stareso project unattended - one fresh helper agent per slice, checked, merged into local main; eco profile (one helper at a time, default) or fast (parallel helpers on independent slices). Argument - a milestone (M1), a slice range (M3.2-M3.6) or "all", then optionally eco | fast.
---

# stareso-build

**Session:** standard tier · **new session in the project folder, no worktree** · permission mode **auto**. If this session runs the strong tier, say so in one line (it works, it costs more); if it runs in a worktree, stop (step 1).

**Heavy session:** if another step already ran in this session (its context is past about 100k tokens: a build, a test, a long chat) and this skill's Session line does not name that step as fine, say in one line before anything else that starting here re-reads that context at every turn (USAGE "Carried", target < 20 %) and ask: continue here or open a new session. Only once per step.

You are the **conductor**. You do not write the project's code: each slice is built by a fresh `stareso-slice-builder` helper, you run `check`, merge with the `slice-done` tool, and keep going. Your own context must stay small: short helper reports, failures only, never full tool output (`… 2>&1 | tail -20`). Talk in English unless the user switches to French.

## 1. Before starting (one message, then go)
1. Read `AGENTS.md` (Commands table, pack), `docs/ROADMAP.md` (overview only), the milestone file(s) in `docs/roadmap/` for the range, `docs/QUESTIONS.md`.
2. Checks: `git rev-parse --show-toplevel` is the project folder itself, **not** under a worktree folder (if it is, stop and ask the user to start the build session in the project folder without a worktree, so slices merge into the real `main`); on `main`; working tree clean; for `app-next` the browser's launch file present.
3. Profile from the argument (default **eco**). Write it in the start message:
   - **eco**: one helper at a time, in this checkout, on a `slice/<id>-name` branch; no browser per slice; checker helper once per milestone. Default because cost = turns × context, and parallel helpers add worktree setup, merge conflicts resolved at your context size, duplicated code, and a faster drain of the usage window.
   - **fast**: up to 3 helpers at once on slices that are independent (no `after:` pointing to an unmerged slice, no shared file in their Files lines), each in its own worktree (`git worktree add`, the project's install command, the dev data copy the pack guide describes); conflicts are yours to resolve. Only when the user asked for `fast`.
4. If the user asks to build a milestone that was just written (by test or improve) and the checks pass, use the defaults and start without a question. Otherwise confirm in **one** question: range, profile, cap (stop after N slices).
5. Say in the start message: "Anything you notice while I build goes to FEEDBACK (I log it, I don't build it); say **stop** to interrupt, **skip <id>** to skip a slice."

## 2. The loop
For each unticked slice in the range, in order (eco) or by independent sets (fast):
1. **Human slice** (`[human]`) or a slice depending on an open QUESTIONS item: skip it, note it, go on.
2. `git switch -c slice/<id>-short-name main`.
3. Start **one** `stareso-slice-builder` helper (tier from the brief: `standard`, `light`, or `strong` when the brief says so<!-- harness:tier-alias -->; `model:` is the old name of the field<!-- /harness -->), foreground in eco. Its prompt: the full brief copied from the milestone file, the pack name, the branch name, the Commands table, whether the dev server is running (and on which port), and "follow your agent instructions". Nothing else.<!-- harness:helpers-fallback --> Without helpers, run mode `session` of `<stareso>/capabilities/helpers.md`: the user opens a fresh session per slice with `<stareso>/roles/slice-builder.md` and the brief, and pastes the report here.<!-- /harness -->
4. Read the report. Run `check` yourself (failures only). **You own the dev server and the dev database** (app packs): helpers never start, stop or rebuild. When the report says "needs rebuild" (schema or seed change): stop the server (the browser's server stop), run the rebuild command, start it again (the browser's server start). Then run `test` and the access tests (when the project has them) on the running server, and before merging a slice that touched routes, schema or build config, stop the server and run `build` (delete its output afterwards, as AGENTS.md says). Runtime checks the helper listed under "Not verified" are yours or the checker's. If the brief says `check: now`, start a `stareso-slice-checker` helper on that slice's output now (it uses your running server).
5. Failing: send the failure back (same helper by message, or a new one with the brief plus the failure), twice at most. Still failing: leave the branch unmerged, write the problem in `docs/QUESTIONS.md`, go on with slices that do not depend on it.
6. Passing: `git switch main` then `node <stareso>/tools/slice-done.mjs <id> --model <m> --tokens <n> --profile <p> --note "<10 words>"` (merge `--no-ff`, branch deleted, box ticked, IDEAS marks, BUILD-LOG line, overview, commit). Print its line to the user: `✓ M23.4 Données dropdowns · <model> · 42k tokens`.
7. Keep the dev server running between slices while a helper may need it; stop it (the browser's server stop, never by killing processes) before `build`, before a rebuild, and at the end of the run.

**Requests from the user during the loop are logged, not built:** append the message to `docs/FEEDBACK.md` under `## During build <milestone> yyyy-mm-dd`, tagged [bug] / [change] / [idea], answer in one line ("noted for the next fix milestone"), continue. Only **stop**, **skip <id>**, **go**, and an answer to an open question change the loop.

## 3. Stop only for
- the end of the range or the cap;
- something only a human can do: secrets or env values, accounts, anything on an online database, pushing (never push), a dependency not on the approved list;
- a decision PLAN.md does not answer **and** every remaining slice depends on it (otherwise QUESTIONS.md and go on);
- the same check failing on three slices in a row (something is wrong with the setup).
Never go past the requested range, never start another milestone by yourself.

## 4. End of a milestone
1. Build its tidy slice like any other (it is the last one in the file).
2. Start **one `stareso-slice-checker` helper** for the milestone: pack, the pages or outputs touched (from the briefs' Files lines), each slice's "done when", the dev accounts (app). Turn every problem it reports into a fix slice appended to the milestone (`M<n>.<next> · Check fix: …`), build them, then run the checker once more only if a fix touched layout.
3. `app-next`: one screenshot per main screen in the preview pane (phone width). `analysis-r`: list the figures written and the `render` result.
3b. Records: `node <stareso>/tools/session-stats.mjs --log` (refreshes `docs/USAGE.md`: this session, its helpers, models, tokens), then `node <stareso>/tools/docs-check.mjs`; a question the user answered in chat during the run is ticked in `docs/QUESTIONS.md` with `**Answer (date): …**`. Commit docs.
4. Report: slices done / skipped / failed, tokens (helper figures from their reports; exact numbers later with `tools/session-stats.mjs`), open questions, human steps waiting.
5. Tell the user: "Milestone done. **Clear this session**, then `/stareso-test` in a **new session** (standard tier) to test it; or `/stareso-build <next>` in a new session to continue." One session per milestone keeps the context small; the files hold the state.
