// Appends one event to a stareso project's build records (docs/data/builds.jsonl), for what slice-done does not write:
//
//   node ~/.claude/stareso/tools/record.mjs caps --start 85 --pause 90 --weekly 95 [--deadline 18:30] [--note "until the reset"]
//        the stop caps of a run (build, night or day profile): status and the panel show when each will be reached
//   node ~/.claude/stareso/tools/record.mjs note "retrofit baseline: 102 commits before the workflow …"
//        a dated line kept with the builds (a retrofit baseline, a run stopped by hand)
//
// Nothing is committed.
import { args, findRoot, stamp } from "./lib/roadmap.mjs";
import { appendJsonl, buildsFile, logLine, needMigrated } from "./lib/records.mjs";

const a = args(process.argv.slice(2));
const [type, text] = a._;
const t = stamp();
let event;
if (type === "caps") {
  const n = (k) => (a[k] == null || a[k] === true ? null : Number(a[k]));
  if ([n("start"), n("pause"), n("weekly")].every((x) => x == null)) { console.error("caps: give at least one of --start, --pause, --weekly (percent)."); process.exit(1); }
  const note = [n("start") != null && `helper start ${n("start")} %`, n("pause") != null && `pause ${n("pause")} %`, n("weekly") != null && `weekly ${n("weekly")} %`,
    typeof a.note === "string" && a.note, typeof a.deadline === "string" ? `deadline ${a.deadline}` : "no deadline"].filter(Boolean).join(" · ");
  event = { type: "caps", t, start: n("start"), pause: n("pause"), weekly: n("weekly"), deadline: typeof a.deadline === "string" ? a.deadline : null, note };
} else if (type === "note" && text) event = { type: "note", t, text };
else { console.error('usage: record.mjs caps --start <pct> --pause <pct> --weekly <pct> [--deadline HH:mm] [--note "…"]   |   record.mjs note "<text>"'); process.exit(1); }

const root = findRoot();
needMigrated(root);
appendJsonl(buildsFile(root), [event]);
console.log(logLine(event));
