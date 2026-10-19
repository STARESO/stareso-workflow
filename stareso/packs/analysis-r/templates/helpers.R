# Shared helpers sourced by main/ scripts and the report (R/helpers.R) ----

# Reports a control: stops the pipeline when `stop_on_fail`, warns otherwise. Returns `ok` invisibly.
check <- function(ok, msg, stop_on_fail = FALSE) {
  if (!isTRUE(ok)) {
    if (stop_on_fail) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
  }
  invisible(ok)
}

# Prints a count line; the only way scripts describe data on stdout (never rows).
say_count <- function(label, n) message(label, ": ", format(n, big.mark = " "))

# Writes a table as rds and csv under the names given in paths.yml.
write_table <- function(x, rds, csv) {
  dir.create(dirname(rds), recursive = TRUE, showWarnings = FALSE)
  saveRDS(x, rds)
  utils::write.csv(x, csv, row.names = FALSE, fileEncoding = "UTF-8")
  say_count(basename(rds), nrow(x))
}

# Saves a ggplot at a fixed size and appends it to the figures registry read by the report.
save_png <- function(g, path, width = 9, height = 5, dpi = 150, caption = "", registry = NULL) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  ggplot2::ggsave(path, g, width = width, height = height, dpi = dpi, bg = "white")
  if (!is.null(registry)) {
    row <- data.frame(file = path, caption = caption, written = format(Sys.time(), "%Y-%m-%d %H:%M"))
    utils::write.table(row, registry, sep = ",", row.names = FALSE, col.names = !file.exists(registry),
                       append = file.exists(registry), fileEncoding = "UTF-8")
  }
  invisible(path)
}
