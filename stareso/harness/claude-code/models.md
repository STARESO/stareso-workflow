# Claude Code models

The only file in the workflow that names models. Steps and briefs speak in tiers (`capabilities/model-tiers.md`), and `tools/harness-build.mjs` writes the names below into the generated Claude Code skills and agents, so no step reads this file while it runs.

| Tier | Prose | Id | Used for |
|---|---|---|---|
| strong | Opus | opus | decisions: init, discuss, grill, setup, improve, deploy, retrofit, deep retro; risky slices |
| standard | Sonnet | sonnet | build conductor, test, quick retro, most slices, the checker |
| light | Haiku | haiku | trivial slices (copy, config, a token) |

The build maps the core wording as follows: "the strong tier" and "strong tier" become "Opus", "a standard-tier model" becomes "a Sonnet-class model", `` `tier: light` `` becomes `` `model: haiku` ``, a backticked tier word becomes the id, and a role's `tier:` line becomes the agent's `model:` line.

Evidence: SecuSurf M5 (2026-10-20) built every slice on Sonnet helpers with a Sonnet conductor, at 8.8 conductor turns and 335k ≈ equiv per slice. Status: adopted.
