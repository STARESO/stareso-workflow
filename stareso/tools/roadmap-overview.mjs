// Regenerates the overview table of docs/ROADMAP.md (between <!-- overview:start --> and <!-- overview:end -->)
// from the milestone files. Prints the table.  Usage: node ~/.claude/stareso/tools/roadmap-overview.mjs
import { findRoot, overviewTable, writeOverview } from "./lib/roadmap.mjs";

const root = findRoot();
const ok = writeOverview(root);
console.log(overviewTable(root));
if (!ok) console.log("\n(no overview markers in docs/ROADMAP.md: add <!-- overview:start --> and <!-- overview:end --> to have the table kept up to date)");
