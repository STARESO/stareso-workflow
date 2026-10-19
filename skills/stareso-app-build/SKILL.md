---
name: stareso-app-build
description: Build a range of roadmap slices of a stareso-app project unattended - one helper agent per slice, checked, merged into local main. Argument - a milestone (M1), a slice range (3-8) or "all".
disable-model-invocation: true
argument-hint: "[M1 | 3-8 | all]"
---

# stareso-app-build

You are the **conductor**. You do not write the app code yourself: each slice is built by a fresh `stareso-slice-builder` helper agent, you check it and merge it. Your own context must stay small: keep the helpers' short reports, not their details. Talk in English unless the user switches to French.

## 1. Before starting (one message, then go)
1. Read `CLAUDE.md`, `docs/ROADMAP.md`, `docs/QUESTIONS.md`. Check: on `main`, working tree clean, `.claude/launch.json` present.
2. If the user asks to build a milestone that was just written (for example by the test skill) and nothing deviates from the checks above, use the defaults and start without asking. Otherwise confirm the run in **one** question (defaults first, the user can just say "go"):
   - range: from the argument (milestone, slices, or all);
   - cap: stop after N slices (default: the whole range);
   - parallel: 1 (default). 2 is allowed only for slices marked `independent: yes`, each helper in its own worktree;
   - fix attempts per slice: 2.
3. Remind in one line: permission mode should be **auto** for an unattended run.

## 2. The loop, one slice at a time
For each unticked slice in the range, in order:
1. **Human slice** (`[human]`) or a slice depending on an open question in QUESTIONS.md: skip it, note it, go on.
2. Create the branch `slice/<id>-short-name` (<id> = `M19.3` style) from `main`.
3. Start **one** `stareso-slice-builder` helper (model from the brief: `sonnet`, or `haiku` for trivial ones), in the foreground. Its prompt: the full slice brief copied from the roadmap, the branch name, and "follow your agent instructions". Nothing else.
4. Check the result yourself, cheaply:
   - `npm run lint` and `npm run typecheck`;
   - UI slice: start the dev server with the preview tool (`dev` from launch.json; reuse it if running), open the page, check it with **text tools** (`read_page`, `find`, console errors), resize to 375 px and to 280 px for overflow. No screenshots here.
5. Failing: send the failure back to the helper (same one, by message, or a new one with the brief plus the failure) at most twice. Still failing: leave the branch unmerged, write the problem in `docs/QUESTIONS.md`, go on with slices that do not depend on it.
6. Passing: merge into local `main` with `--no-ff` ("Merge slice M19.3: title"), delete the branch, tick the box in the roadmap, switch the matching 🛠 lines in `docs/IDEAS.md` (those naming this slice) to ✅, add a line to `docs/BUILD-LOG.md` (date and merge time `yyyy-mm-dd HH:mm`, slice, model, result, helper tokens if shown, short note). Commit the roadmap, ideas and log.
7. One short line to the user per slice: `✓ 04 List screen · sonnet · 18k tokens`.

## 3. Stop only for
- the end of the range or the cap;
- something only a human can do: secrets or `.env` values, creating accounts, anything on an online database, pushing (never push), a dependency not on the approved list;
- a decision PLAN.md does not answer **and** every remaining slice depends on it (otherwise note it in QUESTIONS.md and go on);
- the same check failing on three slices in a row (something is wrong with the setup).

Never go past the requested range, never start another milestone by yourself.

## 4. End of the run
1. If a milestone was completed: one screenshot per main screen in the preview pane (phone width), so the user sees the result.
2. Report: slices done / skipped / failed, total helper tokens, open questions, human steps waiting.
3. Offer: "Say **test time** to test it here in the browser pane."
