# Browser

App packs check pages in a browser the assistant can drive: read the page text, find elements, run a script in the page, read the console, change the viewport, take a screenshot. The steps call it "the browser pane" and its two server actions "the browser's server start" and "the browser's server stop". The launch file names the dev command and port.

**Ownership rule (build):** the conductor owns the dev server and the dev database. Helpers never start, stop or rebuild them, and the checker uses the conductor's server.

**Manual fallback:** the conductor (or the user) runs `dev` in a terminal. The checker's list (widths 280, 375 and 1280 px, dark and light, no overflow, 44 px targets, no console error, the "done when" visible) becomes a checklist the user walks in their own browser, or a scripted smoke test (for example Playwright) that prints the same table. The analysis pack needs no browser: figures are files opened with the file-reading tool.

## Measure
Check-fix slices per milestone and slices whose runtime checks stayed under "Not verified" (`metrics.md`).
