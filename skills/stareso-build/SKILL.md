---
name: stareso-build
description: Build a range of roadmap slices of a stareso project unattended - one fresh helper agent per slice, checked, merged into local main; eco profile (one helper at a time, default) or fast (parallel helpers on independent slices). Argument - a milestone (M1), a slice range (M3.2-M3.6) or "all", then optionally eco | fast.
disable-model-invocation: true
argument-hint: "[M1 | M3.2-M3.6 | all] [eco | fast]"
---

# stareso-build

**Session:** Sonnet · **new session in the project folder, no worktree** · permission mode **auto**. If this session runs Opus, say so in one line (it works, it costs more); if it runs in a worktree, stop (step 1).

You are the **conductor**. You do not write the project's code: each slice is built by a fresh `stareso-slice-builder` helper, you run `check`, merge with the `slice-done` tool, and keep going. Your own context must stay small: short helper reports, failures only, never full tool output (`… 2>&1 | tail -20`). Talk in English unless the user switches to French.

## 1. Before starting (one message, then go)
1. Read `CLAUDE.md` (Commands table, pack), `docs/ROADMAP.md` (overview only), the milestone file(s) in `docs/roadmap/` for the range, `docs/QUESTIONS.md`.
2. Checks: `git rev-parse --show-toplevel` is the project folder itself, **not** under `.claude/worktrees/` (if it is, stop and ask the user to start the build session in the project folder without a worktree, so slices merge into the real `main`); on `main`; working tree clean; for `app-next` `.claude/launch.json` present.
3. Profile from the argument (default **eco**). Write it in the start message:
   - **eco**: one helper at a time, in this checkout, on a `slice/<id>-name` branch; no browser per slice; checker helper once per milestone. Default because cost = turns × context, and parallel helpers add worktree setup, merge conflicts resolved at your context size, duplicated code, and a faster drain of the plan's 5-hour window.
   - **fast**: up to 3 helpers at once on slices that are independent (no `after:` pointing to an unmerged slice, no shared file in their Files lines), each in its own worktree (`git worktree add`, the project's install command, the dev data copy the pack guide describes); conflicts are yours to resolve. Only when the user asked for `fast`.
4. If the user asks to build a milestone that was just written (by test or improve) and the checks pass, use the defaults and start without a question. Otherwise confirm in **one** question: range, profile, cap (stop after N slices).
5. Say in the start message: "Anything you notice while I build goes to FEEDBACK (I log it, I don't build it); say **stop** to interrupt, **skip <id>** to skip a slice."

## 2. The loop
For each unticked slice in the range, in order (eco) or by independent sets (fast):
1. **Human slice** (`[human]`) or a slice depending on an open QUESTIONS item: skip it, note it, go on.
2. `git switch -c slice/<id>-short-name main`.
3. Start **one** `stareso-slice-builder` helper (model from the brief: `sonnet`, `haiku`, or `opus` when the brief says so), foreground in eco. Its prompt: the full brief copied from the milestone file, the pack name, the branch name, the Commands table, and "follow your agent instructions". Nothing else.
4. Read the report. Run `check` yourself (failures only). If the brief says `check: now`, start a `stareso-slice-checker` helper on that slice's output now.
5. Failing: send the failure back (same helper by message, or a new one with the brief plus the failure), twice at most. Still failing: leave the branch unmerged, write the problem in `docs/QUESTIONS.md`, go on with slices that do not depend on it.
6. Passing: `git switch main` then `node ~/.claude/stareso/tools/slice-done.mjs <id> --model <m> --tokens <n> --profile <p> --note "<10 words>"` (merge `--no-ff`, branch deleted, box ticked, IDEAS marks, BUILD-LOG line, overview, commit). Print its line to the user: `✓ M23.4 Données dropdowns · sonnet · 42k tokens`.
7. A helper that left a server running: stop it (`preview_stop`), never by killing processes.

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
4. Report: slices done / skipped / failed, tokens (helper figures from their reports; exact numbers later with `tools/session-stats.mjs`), open questions, human steps waiting.
5. Tell the user: "Milestone done. **Clear this session**, then `/stareso-test` in a **new session** (Sonnet) to test it; or `/stareso-build <next>` in a new session to continue." One session per milestone keeps the context small; the files hold the state.
