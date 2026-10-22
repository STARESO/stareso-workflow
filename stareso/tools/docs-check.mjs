// Coherence check of a stareso project's records. Prints one line per finding, exit code 1 when any.
// The improve and test skills run it first and read only what it flags.
//
//   node ~/.claude/stareso/tools/docs-check.mjs
//
// Checks: ticked slices without a build record · 🛠 ideas naming a ticked slice · `after:` pointing to
// an unknown slice · PLAN.md without Phase/Pack lines · docs/ files missing from docs/README.md ·
// package.json version vs the newest changelog entry (when both exist) · single-file roadmap over 300 lines ·
// FEEDBACK.md blocks older than the newest two (should move to FEEDBACK-DONE.md).
import fs from "node:fs";
import path from "node:path";
import { findRoot, milestones, readText } from "./lib/roadmap.mjs";
import { logLine, migrated, readBuilds } from "./lib/records.mjs";

const root = findRoot();
const docs = path.join(root, "docs");
const findings = [];
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");

const ms = milestones(root);
const all = ms.flatMap((m) => m.slices.map((s) => ({ ...s, milestone: m.id })));
const ids = new Set(all.map((s) => s.id));

// Ticked slices need a build record (docs/data/builds.jsonl, or a BUILD-LOG line before the migration).
const log = readBuilds(root).filter((e) => e.type !== "merge").map(logLine).join("\n");
const logName = migrated(root) ? "builds.jsonl" : "BUILD-LOG";
for (const s of all.filter((x) => x.done)) {
  const re = new RegExp(`(^|[^A-Za-z0-9.])${s.id.replace(/\./g, "\\.")}(?![0-9A-Za-z])`, "m");
  if (!re.test(log)) findings.push(`${logName}: no line for ticked slice ${s.id} (${s.milestone})`);
}

// 🛠 ideas naming a ticked slice.
const ideas = read(path.join(docs, "IDEAS.md")).split(/\r?\n/);
for (const l of ideas.filter((x) => x.startsWith("- 🛠"))) {
  for (const s of all.filter((x) => x.done)) {
    const re = new RegExp(`(^|[^A-Za-z0-9.])${s.id.replace(/\./g, "\\.")}(?![0-9A-Za-z])`);
    if (re.test(l)) findings.push(`IDEAS: 🛠 line names merged slice ${s.id}: "${l.slice(0, 70)}…"`);
  }
}

// after: references.
for (const m of ms) {
  for (const s of m.slices) {
    const am = /after: ([A-Za-z0-9., ]+)/.exec(s.rest);
    if (!am) continue;
    for (const ref of am[1].split(/[,\s]+/).filter(Boolean)) if (!ids.has(ref)) findings.push(`ROADMAP: ${s.id} says after: ${ref}, which does not exist`);
  }
}

// PLAN header.
const plan = read(path.join(docs, "PLAN.md"));
if (plan && !/^Phase: /m.test(plan)) findings.push("PLAN.md: no `Phase:` line");
if (plan && !/^Pack: /m.test(plan)) findings.push("PLAN.md: no `Pack:` line (app-next | analysis-r | godot-game | …)");

// docs/README.md lists every doc.
const readme = read(path.join(docs, "README.md"));
if (readme) {
  for (const f of fs.readdirSync(docs)) {
    if (f === "README.md") continue;
    if (!readme.includes(f)) findings.push(`docs/README.md: ${f} not listed`);
  }
}

// Version vs changelog (app projects).
const pkgFile = path.join(root, "package.json"), chFile = path.join(root, "src", "lib", "changelog.ts");
if (fs.existsSync(pkgFile) && fs.existsSync(chFile)) {
  const v = JSON.parse(read(pkgFile)).version;
  const first = /version:\s*["'`]([^"'`]+)["'`]/.exec(read(chFile));
  if (first && first[1] !== v) findings.push(`version: package.json ${v} but newest changelog entry ${first[1]}`);
}

// Old single-file roadmap too long.
if (!fs.existsSync(path.join(docs, "roadmap"))) {
  const n = readText(path.join(docs, "ROADMAP.md")).lines.length;
  if (n > 300) findings.push(`ROADMAP.md: ${n} lines in one file: split it (tools/roadmap-split.mjs)`);
}

// FEEDBACK blocks beyond the newest two.
const fb = read(path.join(docs, "FEEDBACK.md"));
const blocks = (fb.match(/^## Test /gm) || []).length;
if (blocks > 2) findings.push(`FEEDBACK.md: ${blocks} test blocks; move the older ones to FEEDBACK-DONE.md`);

// QUESTIONS: an open question whose "blocks:" slices are all done is stale; a ticked one needs an Answer.
const qs = read(path.join(docs, "QUESTIONS.md")).split(/\r?\n/);
for (const l of qs) {
  const open = /^- \[ \]/.test(l), done = /^- \[x\]/.test(l);
  if (!open && !done) continue;
  if (done && !/\*\*Answer \(\d{4}-\d{2}-\d{2}\)/.test(l)) findings.push(`QUESTIONS: ticked without an "**Answer (yyyy-mm-dd): …**": "${l.slice(0, 70)}…"`);
  // A debt line pointing to a slice already done was paid (or forgotten): tick it or re-point it.
  const pm = open && /\[debt\].*→ slice ([A-Za-z0-9.]+)/.exec(l);
  if (pm && all.find((s) => s.id === pm[1])?.done) findings.push(`QUESTIONS: [debt] still open but its slice ${pm[1]} is done: "${l.slice(0, 70)}…"`);
  const bm = /blocks: ([A-Za-z0-9., ]+)/.exec(l);
  if (open && bm && !/none/.test(bm[1])) {
    const blocked = bm[1].split(/[,\s]+/).filter(Boolean);
    if (blocked.length && blocked.every((id) => all.find((s) => s.id === id)?.done)) findings.push(`QUESTIONS: still open but every blocked slice is done: "${l.slice(0, 70)}…"`);
  }
}
// Leftover files the workflow no longer uses.
for (const f of ["HELPER-RULES.md", "FUTURE.md"]) if (fs.existsSync(path.join(docs, f))) findings.push(`docs/${f}: no longer part of the workflow; fold it into CLAUDE.md / IDEAS / QUESTIONS in a tidy slice`);
if (migrated(root)) for (const f of ["USAGE.md", "usage-sessions.json", "BUILD-LOG.md"]) if (fs.existsSync(path.join(docs, f))) findings.push(`docs/${f}: left from before the datasets: its records are in docs/data/, remove it (git keeps it)`);

if (findings.length) { console.log(findings.map((f) => "✗ " + f).join("\n")); process.exit(1); }
console.log(`✓ docs coherent (${ms.length} milestones, ${all.length} slices, ${all.filter((s) => s.done).length} done)`);
