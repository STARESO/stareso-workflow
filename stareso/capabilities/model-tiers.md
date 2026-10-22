# Model tiers

Steps and briefs never name a model. They name a tier, and each harness maps the tiers onto its own models in `harness/<harness>/models.md`, the only files that name models.

| Tier | For | Rule |
|---|---|---|
| **strong** | decisions: init, discuss, grill, setup, improve, deploy, retrofit, the deep retro; slices with a written risk (security, legal records, migrations on real data, a statistical method) | a risky slice also gets `check: now` |
| **standard** | the build conductor, test, the quick retro, most slices, the checker | the default |
| **light** | trivial slices (copy, config, a token) | only when the brief is complete without judgement |

A slice brief says `tier: strong | standard | light`. The older `model: opus | sonnet | haiku` field is accepted as an alias and means the same tier (Claude Code projects keep writing it, because the generated steps use the model names).

**Manual fallback:** each step's Session line names its tier, and the user picks the matching model in the harness before starting. If the session runs another tier, the step says so in one line.

## Measure
`slice-done` writes the tier in the build record (`--tier`, default the brief's tier). The retro compares fix rounds and check-fix slices per tier, so a cheaper tier is adopted for a kind of slice only when it does not raise them (`metrics.md`).
