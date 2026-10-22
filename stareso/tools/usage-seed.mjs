// Brings an archived session back into the usage log from an older docs/USAGE.md kept in git.
//
//   node usage-seed.mjs <git-rev> <session-number> [<git-rev> <session-number> …]
//
// Reads the session, step and detail rows of that session number in `git show <rev>:docs/USAGE.md`, rebuilds the
// aggregates session-stats keeps (numbers only, rounded as USAGE.md printed them; helper tokens split by model in
// proportion to their turns) and adds them to docs/usage-sessions.json, where `session-stats --log` renders them
// as "(transcript gone)". Use it when a session was archived before a `--log` run had kept it. Never reads transcripts.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { findRoot } from "./lib/roadmap.mjs";

const root = findRoot();
const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2) { console.error("usage: node usage-seed.mjs <git-rev> <session-number> [<git-rev> <session-number> …]"); process.exit(1); }

const eq = (t) => { const m = /([\d.]+)\s*([kM]?)/.exec(t || ""); return m ? Number(m[1]) * (m[2] === "M" ? 1e6 : m[2] === "k" ? 1e3 : 1) : 0; };
const MODEL_IDS = { opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", haiku: "claude-haiku-5-5", fable: "claude-fable-5-1" };
const modelsOf = (t) => Object.fromEntries((t || "").split(",").map((x) => x.trim()).filter((x) => /^\w+ \d+$/.test(x)).map((x) => { const [n, c] = x.split(" "); return [MODEL_IDS[n] || `claude-${n}`, Number(c)]; }));
// Splits a usage object across models in proportion to their turns (the old table gives totals only).
const splitByModel = (usage, models) => {
  const total = Object.values(models).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(models).map(([m, n]) => [m, Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, Math.round((v * n) / total)]))]));
};
const equiv = (u) => u.cache_read * 0.1 + u.cache_create * 1.25 + u.output * 5;
const cells = (l) => l.split("|").slice(1, -1).map((c) => c.trim());
const ts = (date, hm) => `${date}T${hm}:00.000`;
// "2026-10-21 18:20–18:56" or "2026-10-21 23:10–10-22 00:43" → first and last timestamps.
function range(text, yearFrom) {
  const m = /^(?:(\d{4})-)?(\d\d-\d\d) (\d\d:\d\d)–(?:(\d\d-\d\d) )?(\d\d:\d\d)$/.exec(text);
  if (!m) throw new Error(`cannot read the time range "${text}"`);
  const year = m[1] || yearFrom;
  return { first: ts(`${year}-${m[2]}`, m[3]), last: ts(`${year}-${m[4] || m[2]}`, m[5]), year };
}

const cacheFile = path.join(root, "docs", "usage-sessions.json");
let cache = { version: 1, note: "Written by session-stats --log: per-session aggregates, numbers only. A session whose transcript was deleted keeps its last entry here (shown as transcript gone). Delete an entry to drop that session.", sessions: {} };
try { const c = JSON.parse(fs.readFileSync(cacheFile, "utf8")); if (c && c.sessions) cache = c; } catch { /* first seed */ }

for (let i = 0; i < args.length; i += 2) {
  const [rev, n] = [args[i], args[i + 1]];
  const text = execFileSync("git", ["show", `${rev}:docs/USAGE.md`], { cwd: root, encoding: "utf8" });
  let table = "";
  let session = null, details = null;
  const stepRows = [];
  for (const l of text.split(/\r?\n/)) {
    // Only the three tables that start with the session number are read; any other table or text ends the current one.
    if (/^\| # \| Date \(start–end\)/.test(l)) table = "sessions";
    else if (/^\| # \| Start–end \| Step/.test(l)) table = "steps";
    else if (/^\| # \| Compact \| Ctx\/turn/.test(l)) table = "details";
    else if (/^\| # \|/.test(l) || !l.startsWith("|")) { table = ""; continue; }
    const c = cells(l);
    if (c[0] !== n) continue;
    if (table === "sessions" && !session) session = c;
    else if (table === "steps") stepRows.push(c);
    else if (table === "details" && !details) details = c;
  }
  if (!session) { console.error(`session ${n} not found in ${rev}`); continue; }
  const { first, last, year } = range(session[1]);
  if (Object.values(cache.sessions).some((e) => e.s?.first === first)) { console.log(`session ${n} of ${rev} (${first}) is already in docs/usage-sessions.json: skipped`); continue; }
  const kindFull = session[2];
  const launched = /\(launched by #\d+\)/.test(kindFull);
  const kind = kindFull.replace(/\s*\(launched by #\d+\)/, "").replace(/\s*\(transcript gone\)/, "").replace(/\s*\(worktree\)/, "");
  const models = modelsOf(session[4]);
  const assistant = Number(session[5]) || 0, user = Number(session[6]) || 0, hN = Number(session[7]) || 0;
  const sessionEquiv = eq(session[8]);
  const usage = details ? { input: 0, cache_read: eq(details[4]), cache_create: eq(details[5]), output: eq(details[3]) } : { input: 0, cache_read: 0, cache_create: 0, output: 0 };
  const hEquiv = Math.max(0, sessionEquiv - equiv(usage));
  const hm = /^(.*?) · out (\S+) · cache (\S+)$/.exec(details?.[6] || "");
  const hModels = hm ? modelsOf(hm[1]) : {};
  const hOut = hm ? eq(hm[2]) : 0, hCr = hm ? eq(hm[3]) : 0;
  const hCw = Math.max(0, Math.round((hEquiv - hOut * 5 - hCr * 0.1) / 1.25));
  const h = { n: hN, out: hOut, cr: hCr, cw: hCw, equiv: hEquiv, models: hModels, byModel: splitByModel({ input: 0, cache_read: hCr, cache_create: hCw, output: hOut }, hModels) };
  // Steps: each takes a share of the session's own usage in proportion to its own cost (its ≈ equiv less its helpers').
  const stepsRaw = (stepRows.length ? stepRows : [[n, session[1].replace(/^\d{4}-/, ""), kindFull, session[3], session[5], session[6], session[7], session[8], ""]]).map((c) => {
    const r = range(c[1], year);
    const stHN = Number(c[6]) || 0;
    const stEquiv = eq(c[7]);
    const own = Math.max(0, stEquiv - (hN ? (hEquiv * stHN) / hN : 0));
    return { kind: c[2].replace(/\s*\(launched by #\d+\)/, ""), first: r.first, last: r.last, turns: Number(c[4]) || 0, user: Number(c[5]) || 0, active: Math.round(Number(c[3]) * 3.6e6), hN: stHN, hEquiv: hN ? (hEquiv * stHN) / hN : 0, own };
  });
  const ownTotal = stepsRaw.reduce((a, st) => a + st.own, 0) || 1;
  const steps = stepsRaw.map(({ own, ...st }) => ({ ...st, carried: null, usage: { cache_read: Math.round((usage.cache_read * own) / ownTotal), cache_create: Math.round((usage.cache_create * own) / ownTotal), output: Math.round((usage.output * own) / ownTotal) }, models: Object.fromEntries(Object.entries(models).map(([m, c]) => [m, Math.round((c * st.turns) / (assistant || 1))])) }));
  const id = `seed-${first.slice(0, 16).replace(/[^0-9]/g, "")}-${kind.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  cache.sessions[id] = {
    seeded: `From docs/USAGE.md at ${rev} (session ${n} there), after the transcript was archived: numbers as printed (rounded), helper tokens split by model in proportion to their turns.`,
    s: { id, first, last, kind, kinds: kind.split(" → "), user, assistant, active: Math.round(Number(session[3]) * 3.6e6), compactions: Number(details?.[1]) || 0, usage, models, byModel: splitByModel(usage, models), launchTs: launched ? first : null, launches: [] },
    steps, h, inWorktree: /\(worktree\)/.test(kindFull), wf: false,
  };
  console.log(`seeded ${id}: ${kind}, ${assistant} turns, ${hN} helpers, ≈ ${session[8]}`);
}
fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1) + "\n");
