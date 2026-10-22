# Guide: a 2D game in Godot, the STARESO way

Defaults for a small game made in Godot 4 with GDScript, for PC and tablets, by one author who draws the art and decides what is fun. Drawn from project E (a top-down 2D learning game about real marine species, built in long unattended runs and then retrofitted). Everything here is a **default**, and the grilling decides what differs for a project.

**Read only the sections you need**: the skills and the slice briefs name section numbers.

---

## 1. Target profile
- One author who designs, draws and plays. Players on PC (keyboard and gamepad) and on tablets (touch), sometimes phones later.
- "Done" has **two levels**. Automation proves that nothing breaks (the gate, tests, screenshots). Only the author playing proves that it is fun and right. So the test step (a playtest) comes often and stays light.
- Much feedback is **tuning**, not code: a speed, a timer, a radius. Every tunable is named so the author can change it without the assistant (section 9).
- The author's drawings, music and texts are the soul of the game. The assistant never replaces them. It fills gaps with provisional material in the same style until the author's version arrives (section 11).

## 2. Tools
| Layer | Choice | Notes |
|---|---|---|
| Engine | **Godot 4.x**, console binary (Windows: `Godot_v4.x-stable_win64_console.exe`) | Its path is written once in AGENTS.md. Note the exact version: minor versions add native classes that can clash with addons. |
| Language | **GDScript with static types** (`var speed: float = 250.0`, typed returns) | C# only if the plan says so. |
| Renderer | Forward Mobile (Vulkan) for PC and tablets, Compatibility when old phones matter | Decided in the grilling, recorded in a decision. |
| Addons | none by default | **Dependency rule:** ask before adding an addon and write what it is for (AGENTS.md "Approved"). Addons stay untouched in `addons/`. |
| Tool scripts | Bash (Git Bash on Windows), Python stdlib, Node only for a named library | No `pip install`, no global npm packages. |
| Art helpers | optional: Inkscape for SVG to PNG, a deterministic generator in `tools/art/` | Only for provisional art (section 11). |

## 3. Folder structure
```
project.godot              engine settings (never edited by tools without a slice)
AGENTS.md                  rules, Commands table, approved addons
autoload/                  singletons, one concern each (state, settings, music, sfx)
resources/                 Resource classes (EntityData, GameConfig…)
data/                      .tres instances: game_config.tres (every global tunable), <family>/<id>.tres
scenes/
  main/                    start screen (main scene) and the world scene
  levels/                  one scene per zone, and the small scenes zones are made of
  player/  mobs/  npcs/  items/  ui/  fx/   each scene next to its script
translations/              CSV files with keys and one column per language
assets/                    binary assets (art, audio, fonts): see 3b
  style/                   STYLE_GUIDE.md (palette, line, light), lessons learned
tools/                     check.sh, offscreen_override.sh, windowed.sh, screenshot.sh, verify_offscreen.sh,
                           parse_check.gd, smoke.gd, test_runner.gd, screenshot.gd, tests/, art/
docs/                      PLAN, GLOSSARY, decisions, ROADMAP (+ roadmap/), IDEAS, QUESTIONS, FEEDBACK,
                           RETROS, PLAYTEST, data/ (records)
devlog/                    optional illustrated progress log (section 13)
_archive/                  dead scenes and scripts kept for reference, with a `.gdignore`
private/                   sources/locked, sources/readable, INDEX.md, backups (as every stareso project)
```
Conventions:
- **Code, comments and docs in English. Game text in the plan's first language** through translation keys, never literal strings in scenes or scripts.
- One scene per file with its script next to it (`octopus.tscn` + `octopus.gd`), snake_case files, PascalCase classes (`class_name`), signals in past tense (`species_caught`).
- `.tscn` and `.tres` files are text: they diff and merge. Keep them small (section 4) so two slices rarely touch the same one.

### 3b. Assets and private material
- **Assets in git or not** is decided in the grilling. Default: binary assets are git-ignored and backed up by the author, and every **generated** asset must be reproducible from `tools/` (so a fresh clone can rebuild it).
- The author's art may be **viewed** by the assistant (it needs to see the drawings to use them) unless the author puts a folder under `private/sources/locked/`. Reference documents (notes, papers, sketches) go to `private/` as in every stareso project.
- The assistant **never deletes, overwrites or edits an author asset**. Moves go through a logged, undoable move tool (`tools/reorganize.py` style: a moves log and `--undo`).
- A map of the author's unused drawings (`assets/art/ATLAS_MAP.md`: sheet, region, what it shows, used or not) is the first place to look before making any provisional art.

## 4. Architecture rules (what keeps slices small)
- **Data-driven entities:** an entity family has a Resource class (`resources/species_data.gd`) and one `.tres` per entity. Lists, HUD and menus build themselves from the data. A new entity is data plus, if it behaves differently, a scene.
- **One config resource** (`data/game_config.tres`) holds every global tunable. Per-entity tunables are `@export` variables of its script or fields of its data.
- **Base classes for families:** creatures extend `mob_base.gd` (wander, home radius, capture hooks). A new creature overrides hooks, never copies the base.
- **State and signals:** gameplay writes the state autoload, UI listens to its signals. The player never writes UI nodes. When the state autoload passes about 400 lines, split it by concern (progress, inventory, quests, save) in a tidy slice.
- **No fragile paths:** no `../` node paths and no `/root/...` in scripts. Use exported NodePaths, groups or signals.
- **Small shared scenes:** the world scene only assembles zone scenes and group scenes. Placing content in a zone touches that zone's scene, not a 2,000-line level file. Two content slices in different zones never conflict.
- **Saves use stable ids** (entity id plus an instance id), never node paths, so renaming a node does not break old saves. A save format change is a `tier: strong` slice with a migration test.
- **Scripts under about 400 lines.** A bigger one is split by concern in a tidy slice (movement, animation, capture).
- **Append-only shared files** (translation CSVs) get `merge=union` in `.gitattributes`, so parallel slices merge without conflicts.
- **Test user dir:** every `user://` access goes through one helper (`user_path(file)`) that redirects to a git-ignored folder inside the project when the game runs with `-- --test-user-dir`. Tests and tools always pass it, so they never touch the player's real save, and the settings autoload never switches to fullscreen in such a run.

## 5. Off-screen and silent runs (hard rule)
The author may sleep or work next to the computer. **No game window on the main screen and no game sound**, ever, during builds, tests, screenshots or experiments.
- **Headless whenever no pixels are needed** (`--headless`: import, parse check, smoke, unit tests, reachability, data checks). Headless runs are silent.
- **A real window only through the wrappers** `tools/screenshot.sh` and `tools/windowed.sh`, never by launching Godot without `--headless` directly. The wrappers:
  1. write a temporary `override.cfg` (`tools/offscreen_override.sh`): window **minimized**, size 1280x720, `no_focus`, and a creation position on a **secondary screen** when there is one, measured at launch (Godot coordinates start at the top-left of the whole desktop),
  2. pass `--audio-driver Dummy` (no sound on the speakers) and `-- --test-user-dir`,
  3. remove `override.cfg` on exit, and refuse to start if one is left over.
- **In the script:** restore the window first (`window_set_mode(WINDOWED)`), **then** move it to `(-20000, -20000)`. Never move it while minimized: Godot caches that position, Windows does not apply it, and the later move is skipped, so the window stays where it was created. Never pass `--position` on the command line: Godot clamps it to the main screen.
- **Verify once per machine and after any change to the wrappers:** `bash tools/verify_offscreen.sh` runs a screenshot and a windowed test under a window watcher (`tools/watch_windows.ps1`) and fails if any Godot window touched the main screen. Expected result: each windowed run shows for about one frame (30 ms) on the secondary screen only, then moves off the desktop. On a single screen, that frame lands on the main screen: say so to the author.
- Leave no Godot process running: always `--quit`, `--quit-after` or `timeout`.
- **Never open the Godot editor** on the project during a build: its plugins rewrite `project.godot` and open scenes can overwrite the slices' edits. If the author has the editor open, note it and ask.
This mechanism was verified on Windows 11 with Godot 4.7. On another OS, verify it the same way before the first build.

## 6. Verification levels
- **Per slice:** `check` passes (import, parse, smoke, tests, windowed tests). If the slice changes something visible, the helper takes a `shot` and **looks at it** (reduced scale), and says in one line what it saw. Placed content passes the reachability tool (section 7). The slice adds its line to `docs/PLAYTEST.md` (section 9).
- **Per milestone:** the `stareso-slice-checker` helper runs `check` from scratch, the playthrough test, and a `shot` of every changed scene at four aspect ratios (16:9 PC, 16:10 and 4:3 tablets, 20:9 phone), and reports what it sees (checker role, section `godot-game`).
- **Per playtest:** the author plays, on PC and on a tablet build (`build`), with the checklist of `docs/PLAYTEST.md`. Only the author can say "fun", "too fast", "ugly". The assistant prepares, logs and segments.

## 7. Tests
- `tools/test_runner.gd` runs every `tools/tests/test_*.gd` and exits with the number of failures. Tests extend `tools/tests/base_test.gd`: asserts, `wait_frames`, scene loading, input injection (actions, joypad, touch) and `make_window_offscreen()` for the windowed pass.
- **Smoke test** (`tools/smoke.gd`): each live scene listed in `tools/live_scenes.txt` runs 300 frames headless and fails on any error line not in a commented allowlist.
- **Parse check** of every script in one Godot process.
- **Playthrough test:** one test plays the main path (start, first quest, first catches, save and load). Extend it in each milestone's tidy slice. In project E it found four real bugs in its first run.
- **Reachability** (`tools/reachability.gd`): a flood fill from the spawn with the player's own collision shape. Every placed entity must be reachable.
- A flaky test is a bug: find the cause (timing, physics frame, input caught in `_physics_process` instead of as an event), never retry it away.

## 8. Content recipes (slice kind `content`)
A content slice follows its recipe, so a standard or light tier model can build it from the brief alone.
- **New entity** (species, item): data `.tres` · scene and script extending the family base, with a behaviour taken from the source the brief quotes · texts as translation keys, first language first · placement in one zone scene, checked with reachability · test (caught, counted, saved) · one PLAYTEST line with its tunables.
- **New NPC conversation:** a dialogue file, a talk area from the shared NPC script, facts from the brief's source only · PLAYTEST line "read the text".
- **New zone:** zone scene with background, collision, music zone and spawn points · the world scene adds it · smoke list updated · reachability · `shot`.
For a learning game: **cautious facts only**, each fact traceable to the source in the brief, and every drafted text listed for the author's review.

## 9. Tunables and the playtest checklist
- `docs/PLAYTEST.md` (template) is the living checklist for the next playtest: one line per point to try, grouped by Game feel, Difficulty, Texts, Visuals, Platforms, each with **where to tweak it** (`data/game_config.tres > predator_reach (260)`, `player.gd > boost_multiplier (3.0)`).
- Slices add lines. The test step reads the lines added since the last test, and moves tried lines to `docs/PLAYTEST-DONE.md` at "end test".
- Feedback tagged **[tune]** is either changed by the author directly (the line says where) or becomes a **tune slice** (light tier, one value or a few values, done when `check` passes and the new value is in the PLAYTEST line).

## 10. Slice kinds (written in the brief's title line as `kind:`)
| Kind | What | Tier | Done when |
|---|---|---|---|
| `system` | a mechanic, a UI screen, a tool | standard (strong for save format, architecture) | check, tests, shot seen, PLAYTEST line |
| `content` | an entity, a conversation, a zone (section 8) | standard or light | the recipe's lines |
| `tune` | change tunables from playtest feedback | light | check, value in PLAYTEST |
| `spike` | a time-boxed prototype that answers one design question ("is the camouflage power fun?") on its own branch | standard or strong | the question answered in a decision record, the branch merged **or** dropped (dropping is a valid result) |
| `art` `[human]` | a drawing request: size, view, style, file name, the provisional asset it replaces | human | the author's file is in place and swapped in (swap tool) |
| `facts` `[human]` | the author checks drafted texts and facts | human | lines ticked in PLAYTEST |
Spikes replace a long grilling for uncertain mechanics: build the smallest playable version, let the author play it, then decide.

## 11. Art and audio pipeline
- `assets/style/STYLE_GUIDE.md`: palette, line weight, light direction, sizes per family. `ART_LESSONS.md`: what worked and what did not.
- **Order of preference:** the author's unused drawings (ATLAS map), then provisional art made in the same style by a deterministic tool (`pv_` prefix, rebuilt by `tools/art/build_all.sh`), each with a drawing request in `assets/requests/ASSET_REQUESTS.md` and an `art [human]` slice in milestone H.
- **Swap tool** (`tools/swap_asset.py <provisional> <final>`): replaces every reference to the provisional file by the author's file, keeps the uid stable.
- Provisional sounds the same way (`tools/gen_sfx.py`, stdlib synthesis), never sounds from the internet without the author's approval of the licence.

## 12. Builds for playtests
- **PC:** the author runs the project from the editor or the PC export.
- **Tablet:** `build` exports a debug APK headless (`--headless --export-debug "<preset>" exports/<name>.apk`). The author installs it. Export templates and the Android SDK are set up once by the author ([human] slice in M0 or H).
- The assistant **never** touches release signing, keystores or store accounts (`deploy.md`).

## 13. Devlog (optional)
An illustrated progress log for the author: `devlog/entries.jsonl` (one entry per slice: title, summary, how it was built, tunables, model and tokens of the helpers and of the conductor, before and after shots) and a builder that renders a self-contained page readable on a tablet (summary at the top, outline drawer, filters by kind, before and after slider). The devlog is a reading aid, the records of the workflow stay the datasets in `docs/data/`.

## 14. Night runs (build profile `night`)
For long unattended runs while the author sleeps (`/stareso-build M3-M5 night 4h`): the build skill's `night` profile. Pack-specific rules on top of it: no window and no sound (section 5), a `shot` of every visible slice viewed by the conductor at reduced scale, and a creative queue milestone `Q.md` (Kind: queue) of small content and polish slices the run takes from when its range is done. Keep at least five slices in Q.

## 15. Commands (what the skills run)
| Name | Command | Notes |
|---|---|---|
| `check` | `bash tools/check.sh` | import, parse, smoke, tests headless, then the windowed tests through `windowed.sh` (about 2 to 3 min) |
| `test` | `"$G" --headless --path . --script res://tools/test_runner.gd -- --test-user-dir [--filter=test_x]` | one test file while building it |
| `run` | `"$G" --headless --path . res://scenes/main/game.tscn --quit-after 600 -- --test-user-dir` | the world scene for 600 frames, errors only |
| `shot` | `bash tools/screenshot.sh --scene=res://... --out=<ignored folder>/x.jpg [--size=WxH] [--setup=res://tools/shots/<setup>.gd]` | off-screen, silent. Look at the image |
| `rebuild` | `"$G" --headless --path . --import` | after new assets, in a fresh worktree |
| `build` | `"$G" --headless --path . --export-debug "<preset>" exports/<name>.<ext>` | playtest builds (section 12) |
| `verify-offscreen` | `bash tools/verify_offscreen.sh` | once per machine and after changing the wrappers (section 5) |
`$G` is the Godot console binary named in AGENTS.md.

## 16. Default roadmap (adapt in setup)
Milestones are **playable vertical slices**: each one ends with something the author can play, never "all systems, then all content".
**M0. Scaffold:** Godot project, folder structure, the gate (`check.sh`, parse, smoke, test runner), the off-screen wrappers and `verify_offscreen.sh` run green, `user_path` helper, translations, PLAYTEST checklist, `[human]` export templates.
**M1. The core loop, playable:** movement, camera, one interaction, one entity, one zone, a test of each. Spikes for any mechanic the grilling could not settle.
**M2. First content set:** entities through the recipe (section 8), one slice each, placed in the zone, with texts.
**M3. Progression and UI:** the collection or book, quests, powers, save and load, start screen and options.
**M4. Platforms:** touch controls, gamepad, layouts at the four aspect ratios, performance on the target tablet (measure, then reduced-effects switches), the tablet build.
**M5. Feel and polish:** music crossfades, sounds, animation, particles, light. Mostly tune and content slices.
**Tidy slice at the end of every milestone** (`M<n>.tidy`): scripts over 400 lines split, shared code into base classes, the playthrough test extended, dead files to `_archive/`, PLAYTEST lines grouped.
**H. Waiting on the author:** drawings, music, fact checks, export setup. **Q. Creative queue** (night runs only). **P. After the release.**

## 17. Slice brief shape (pack-specific lines)
- Title line: `- [ ] **M2.3 · Copepods escape-jump** · kind: content · model: sonnet`.
- Files: one scene and its script, one data file, the zone scene, the translation keys. Name the base class to extend.
- Done when: `check` passes · the named test passes · `shot` of <what> seen (one line) · reachability ok · PLAYTEST line added with its tunables.
- Source (content and facts): the reference the behaviour and the texts come from.
- Risk: `opus` for a save format change, an architecture split, a spike on a core mechanic. `haiku` for tune slices, texts, data-only entities.
