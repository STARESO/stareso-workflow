# [ProjectName]

[One paragraph: the game, who plays it, on which platforms, the design pillar in one sentence.]
**Status:** [in progress | released vX.Y yyyy-mm-dd].

Built with the stareso workflow (`~/.claude/stareso/README.md`), pack `godot-game`. Plan: `docs/PLAN.md` ·
terms: `docs/GLOSSARY.md` · decisions: `docs/decisions/` · roadmap: `docs/ROADMAP.md` (briefs in `docs/roadmap/`) ·
playtest checklist: `docs/PLAYTEST.md` · conventions: `~/.claude/stareso/packs/godot-game/guide.md` (read only the sections you need).

## Rules
- **Talk to the user in English** unless they switch to French. Game text in [first language] through translation keys, English second. Code, comments and docs in English.
- **No game window on the main screen and no game sound, ever** (guide §5): headless runs, or `tools/screenshot.sh` / `tools/windowed.sh` only. Never launch a windowed Godot any other way, never pass `--position`, never open the Godot editor on the project.
- **The author's art, music and texts are never replaced, edited or deleted.** Unused drawings first, then provisional `pv_` assets with a drawing request (guide §11). Moves go through the logged move tool.
- **Never claim it works without running it:** `check` for every slice, a `shot` looked at for every visible change.
- **Tunables are named:** every visible slice adds a line to `docs/PLAYTEST.md` with where to tweak it (guide §9).
- **Tests never touch the player's save:** every `user://` access goes through `user_path()`, and every test or tool run passes `-- --test-user-dir`.
- **Git:** one branch per slice (`slice/[id]-short-name`), merged into `main` with `--no-ff` once `check` passes (`slice-done` tool). Never push, never touch signing keys or export credentials.
- **Addons:** ask before adding one and say what it is for. Approved: [none | …].
- **Extend, never copy:** creatures extend the family base, data goes in `.tres` files, global tunables in `data/game_config.tres`. Scripts stay under about 400 lines.
- If a request conflicts with this file or PLAN.md, say so instead of silently picking one.
- Keep the code simple and readable, with static types.

## Commands
| Name | Command | Notes |
|---|---|---|
| `check` | `bash tools/check.sh` | the gate: import, parse, smoke, tests, windowed tests |
| `test` | `"$G" --headless --path . --script res://tools/test_runner.gd -- --test-user-dir --filter=[test_x]` | one test file |
| `run` | `"$G" --headless --path . res://scenes/main/game.tscn --quit-after 600 -- --test-user-dir` | the world for 600 frames |
| `shot` | `bash tools/screenshot.sh --scene=res://[scene].tscn --out=[ignored folder]/[name].jpg` | off-screen and silent, then look at it |
| `rebuild` | `"$G" --headless --path . --import` | after new assets, in a fresh worktree |
| `build` | `"$G" --headless --path . --export-debug "[preset]" exports/[name].[apk or exe]` | playtest builds |
| `verify-offscreen` | `bash tools/verify_offscreen.sh` | once per machine, after changing the wrappers |

Godot console binary on this machine: `G="[path to Godot_v4.x-stable_win64_console.exe]"` (also exported as `GODOT` for the tool scripts).

## Pitfalls met on this project
[One line each, added by slices when they meet one: engine version quirks, addon side effects, input handling.]
