// Backtest of the ETA method (lib/eta.mjs) against a project's history: every slice is predicted with the durations merged
// before it, never its own. Prints a few lines. Reads the build records, and the ETA dataset for the predictions made at the time.
//
// Usage:  node ~/.claude/stareso/tools/eta-backtest.mjs [--root <project>] [--eta <dataset.jsonl>]
//
// "one number" is what an ETA gave before the spread: the median duration, the same for every slice.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { args, findRoot } from "./lib/roadmap.mjs";
import { readBuilds, readJsonl } from "./lib/records.mjs";
import { durationRecords, mean, median, quantile, remaining, simulate, spread, WINDOW } from "./lib/eta.mjs";

const opt = args(process.argv.slice(2));
const root = opt.root ? path.resolve(opt.root) : findRoot();
const etaFile = opt.eta || path.join(os.homedir(), ".claude", "stareso", "data", "eta", `${path.basename(root).replace(/[^\w.-]+/g, "_")}.jsonl`);
const recs = durationRecords(readBuilds(root));
const first = new Map();
for (const x of fs.existsSync(etaFile) ? readJsonl(etaFile) : []) if (x.id && x.start && x.predEnd && !first.has(x.id)) first.set(x.id, x);
const MIN = 10, pct = (a, b) => Math.round((a / b) * 100);
const before = (i) => recs.slice(0, i).map((d) => d.minutes);
const out = [];

// 1. one slice, from its start: the centre and the 10–90 % range
let n = 0, aeOne = 0, aeOld = 0, nOld = 0, inside = 0, below = 0;
for (let i = MIN; i < recs.length; i++) {
  const s = spread(before(i)), act = recs[i].minutes;
  n++; aeOne += Math.abs(s.typical - act);
  if (act >= s.lo && act <= s.hi) inside++; else if (act < s.lo) below++;
  const old = first.get(recs[i].id);
  if (old) { nOld++; aeOld += Math.abs((old.predEnd - old.start) / 60000 - act); }
}
out.push(`one slice from its start, ${n} slices: median error ${(aeOne / n).toFixed(1)} min with the median as the one number${nOld ? ` (the ETAs as they were made: ${(aeOld / nOld).toFixed(1)} min on ${nOld})` : ""}; the 10–90 % range held ${pct(inside, n)} % of them (${pct(below, n)} % came in below it, ${pct(n - inside - below, n)} % above)`);

// 2. a slice that has run for a while: minutes left, one number (median minus elapsed, at least 5) against what is left among the longer durations
for (const e of [20, 30, 45, 60]) {
  let m = 0, aeA = 0, aeB = 0, within = 0;
  for (let i = MIN; i < recs.length; i++) {
    if (recs[i].minutes <= e) continue;
    const s = spread(before(i)), r = remaining(s.sample, e), act = recs[i].minutes - e;
    m++; aeA += Math.abs(Math.max(5, s.typical - e) - act); aeB += Math.abs(r.typical - act);
    if (act >= r.lo && act <= r.hi) within++;
  }
  if (m >= 5) out.push(`running for ${e} min, ${m} slices: minutes left off by ${(aeA / m).toFixed(1)} (one number) against ${(aeB / m).toFixed(1)} (from the longer durations), range held ${pct(within, m)} %`);
}

// 3. the time of k slices one after the other: the sum of medians against a simulation of the spread
for (const k of [4, 8]) {
  let m = 0, biasMed = 0, biasSim = 0, within = 0;
  for (let i = MIN; i + k <= recs.length; i++) {
    const s = spread(before(i)), act = recs.slice(i, i + k).reduce((t, d) => t + d.minutes, 0);
    const sim = simulate((rnd) => new Map([["sum", Array.from({ length: k }, () => s.sample[Math.floor(rnd() * s.sample.length)]).reduce((a, b) => a + b, 0)]]), 7).get("sum");
    m++; biasMed += (k * s.typical - act) / act; biasSim += (sim.typical - act) / act;
    if (act >= sim.lo && act <= sim.hi) within++;
  }
  if (m >= 5) out.push(`${k} slices in a row, ${m} windows: ${k} × median is ${Math.round((biasMed / m) * 100)} % off on average, the simulated median ${Math.round((biasSim / m) * 100)} % off, its 10–90 % range held ${pct(within, m)} %`);
}
const d = recs.slice(-WINDOW).map((x) => x.minutes);
out.push(`now: last ${d.length} durations, typical ${Math.round(median(d))} min, mean ${Math.round(mean(d))}, 10–90 % ${Math.round(quantile(d, 0.1))}–${Math.round(quantile(d, 0.9))}`);
console.log(out.join("\n"));
