# <Project> — whole pipeline, in order ----
# Runs every step listed under `scripts:` in config/paths.yml, each in its own environment,
# then counts the files written per output folder. Prints counts only, never data rows.
# Run from the project root:  Rscript --vanilla main/run_all.R
if (!file.exists("config/paths.yml")) {
  stop("Run from the project root (the folder holding config/paths.yml).", call. = FALSE)
}

paths <- yaml::read_yaml("config/paths.yml", fileEncoding = "")
started <- Sys.time()

for (step in unlist(paths$scripts)) {
  message("Step: ", step)
  source(step, local = new.env(parent = globalenv()), encoding = "")
}

# Files written during this run, per folder.
written <- list.files("outputs", recursive = TRUE, full.names = TRUE)
written <- written[file.mtime(written) >= started]
counts <- table(dirname(written))
for (folder in names(counts)) message("  ", folder, ": ", counts[[folder]])
message("Files written: ", length(written), " in ",
        round(as.numeric(difftime(Sys.time(), started, units = "secs")), 1), " s")
