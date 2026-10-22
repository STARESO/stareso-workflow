# Helpers

The build runs as one **conductor** and one fresh **helper** per slice, with one **checker** per milestone. A fresh helper reads only its brief and the guide sections it names, so its context stays near 40k tokens, while the conductor sees short reports and failures only. Cost is turns × context per turn, which is why the split pays.

## Roles
| Role | File | Tier | Does |
|---|---|---|---|
| `slice-builder` | `roles/slice-builder.md` | from the brief (standard by default) | builds exactly one slice on its branch, runs `check`, commits, reports in under 12 lines |
| `slice-checker` | `roles/slice-checker.md` | standard | checks one milestone's pages or outputs, reports a table, fixes nothing |

The role file is the helper's whole instruction. A harness maps it onto its own agent definition, or the user pastes it.

## Modes
| Mode | How a slice is built | When |
|---|---|---|
| **subagent** | the conductor starts the helper with the harness's agent feature, waits for its report, runs `check`, closes the slice with `slice-done` | the harness has agents that start with a fresh context and a chosen model |
| **session** | the user opens a fresh session per slice (or clears the context), pastes `roles/slice-builder.md` and the brief, and gives the report back to the conductor's session; the per-slice cost is the same, the loop is not unattended | no agents, or agents that inherit the conductor's context |
| **inline** | the conductor builds the slice in its own context | only a one-line fix, or a chat-only harness; it shows as a conductor-built slice |

**Manual fallback, stated in the build step:** without helpers, run mode session. Never fall back to inline for a whole milestone, because the conductor's context then grows with every slice (project C's 49 conductor turns per slice before the 2026-10-19 review).

## Measure
`slice-done --helper <mode>` writes the mode in the build record (default from the project instructions, else subagent). The retro splits fix rounds, check-fix slices, reworks, conductor-built slices and minutes per slice by mode (`metrics.md`).
