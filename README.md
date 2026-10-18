# stareso-app workflow

Claude Code skills and shared material used to build STARESO's small web apps (Scriba, SecuSurf, BaieWatch style): from a first discussion to a published app, in small checked slices.

This repository is rooted at `~/.claude`. Its `.gitignore` is a whitelist: only the workflow below is tracked; credentials, settings, sessions, projects and memory never are.

| Path | What |
|---|---|
| `skills/stareso-app-*/` | The skills: init, discuss, grill, setup, build, test, improve, status, deploy |
| `agents/stareso-slice-builder.md` | Helper agent that builds one roadmap slice |
| `stareso-app/README.md` | Manual: phases, which skill when, which model |
| `stareso-app/guide.md` | Stack and patterns shared by the apps |
| `stareso-app/grilling.md` | How decisions are asked and recorded |
| `stareso-app/templates/` | Starting docs for a new project |
| `stareso-app/CHANGELOG.md` | One line per workflow change |

Start with `stareso-app/README.md`. To save a change: `git -C ~/.claude add -A`, commit, push.
