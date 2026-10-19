# <ProjectName>

<One paragraph: what is analysed, for whom, from which data, what comes out (figures, tables, report).>
**Status:** <in progress | report delivered yyyy-mm-dd>.

Built with the stareso workflow (`~/.claude/stareso/README.md`), pack `analysis-r`. Plan: `docs/PLAN.md` ·
terms: `docs/GLOSSARY.md` · decisions: `docs/decisions/` · roadmap: `docs/ROADMAP.md` (briefs in `docs/roadmap/`) ·
logbook: `docs/LOGBOOK.md` · conventions: `~/.claude/stareso/packs/analysis-r/guide.md` (read only the sections you need).

## Rules
- **Talk to the user in English** unless they switch to French. Report, figure labels and comments in French; code, functions, variables and column names in English.
- **Data are private:** `data/raw/`, `data/processed/` and `private/` are never committed or published; Claude sees their **structure only** (`structure` command) and never prints rows, not even through the shell (guide §3b). Development and tests use the toy data in `tests/toy/`.
- **Raw files are never edited:** every correction is code with a control that reports what it changed (guide §4).
- **Hypotheses live in `config/`** and are quoted in the report; nothing scientific is hidden in a script.
- **Git:** one branch per slice (`slice/<id>-short-name`), merged into `main` with `--no-ff` once `check` passes (`slice-done` tool). Outputs are not committed.
- **Packages:** ask before adding one and say what it is for. Approved: <dplyr, tidyr, stringr, lubridate, ggplot2, scales, yaml, readr, testthat, lintr, …>.
- **Modules, not copies:** functions in `R/<module>.R`, one file per concern; extend the module named in the brief, never duplicate a function or a figure block.
- **Logbook:** every slice that finds or decides something scientific writes one dated line in `docs/LOGBOOK.md`.
- If a request conflicts with this file or PLAN.md, say so instead of silently picking one.
- Keep the code simple and readable.

## Commands
| Name | Command | Notes |
|---|---|---|
| `check` | `Rscript --vanilla tests/run_tests.R` | lintr + testthat + regression snapshot |
| `run` | `Rscript --vanilla main/run_all.R` | whole pipeline, counts only |
| `step` | `Rscript --vanilla main/<script>.R` | one step |
| `render` | `quarto render report/<project>_report.qmd` | after `run`; the user opens the HTML |
| `structure` | `Rscript --vanilla dev/describe_data.R` | raw files: columns, types, counts; never rows |

Rscript on this machine: `<path, e.g. C:\Program Files\R\R-4.6.0\bin\Rscript.exe>`.

## Data (filled by setup from the structure run)
<One line per raw file: name, what it is, rows × columns, key columns, version.>
