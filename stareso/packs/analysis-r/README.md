# Pack `analysis-r`: data analysis in R with figures and an HTML report

Conventions of the STARESO analyses (BaieWatch frequentation 2026, OEC 2026 marine litter). Defaults the grilling can change.

| File | What |
|---|---|
| `guide.md` | Layout, scripts, data rules, figures, report, tests, commands, verification, default roadmap. Sections numbered; briefs point to them. |
| `templates/CLAUDE.md` | Project rules with the Commands table. |
| `templates/gitignore`, `templates/lintr`, `templates/paths.yml`, `templates/run_all.R`, `templates/helpers.R` | Starting files copied by `stareso-init` / `stareso-setup`. |

Verification in this pack: `check` (lintr + testthat) per slice, `run` (the whole pipeline from raw data) clean with the regression snapshot unchanged except where the slice says so, figures viewed by the checker helper (Read on the PNG files), the report rendered without error once per milestone.
