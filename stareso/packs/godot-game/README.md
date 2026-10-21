# Pack `godot-game`: a 2D game in Godot 4 for PC and tablets

Conventions of project E (a top-down 2D learning game, first built in long unattended runs, then retrofitted). Defaults the grilling can change.

| File | What |
|---|---|
| `guide.md` | Profile §1, tools §2, structure §3, assets §3b, architecture §4, **off-screen and silent runs §5**, verification §6, tests §7, content recipes §8, tunables and the playtest checklist §9, slice kinds §10, art pipeline §11, playtest builds §12, devlog §13, night runs §14, commands §15, default roadmap §16, brief shape §17. Skills and briefs point to sections. |
| `deploy.md` | Release steps (PC, Android, store pages) and the pre-flight list. Used by `stareso-deploy`. |
| `templates/CLAUDE.md` | Project rules with the Commands table. |
| `templates/PLAYTEST.md` | The playtest checklist, one line per point with where to tweak it. |
| `templates/gitignore`, `templates/gitattributes-extra` | Git ignore rules for Godot, and lines appended to the core `.gitattributes`. |
| `templates/tools/` | `check.sh`, `offscreen_override.sh`, `windowed.sh`, `screenshot.sh`, `verify_offscreen.sh`, `watch_windows.ps1`: the gate and the off-screen wrappers, copied by init (or by the M0 scaffold slices of a retrofit). |

Verification in this pack: `check` (import, parse, smoke, tests, windowed tests) per slice with a `shot` looked at for visible changes, the `stareso-slice-checker` helper per milestone (check from scratch, playthrough test, shots at four aspect ratios), and the author's playtest with `docs/PLAYTEST.md` (guide §6). No game window on the main screen and no game sound, ever (guide §5).
