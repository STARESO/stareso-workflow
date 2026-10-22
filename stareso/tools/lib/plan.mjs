// Plan interventions, from git: what changed in the plan while a milestone was being built. The build of a milestone
// starts at its first merged slice. After that, a commit to the plan files (the milestone files of the roadmap, the
// overview, PLAN.md, the decision records) that adds a slice, rewrites a slice's brief before it merged, changes a
// slice's chain (`after:`), or changes PLAN or a decision, is an intervention: the work is no longer the plan written
// before the build. A commit made during a test step is not one: the fix slices a test writes into the roadmap are
// planned build. Ticks (`- [x]`) and the generated overview are not changes. Numbers and slice ids only.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { GLOBAL_DATA } from "./records.mjs";

const PLAN_PATHS = ["docs/roadmap", "roadmap", "docs/ROADMAP.md", "ROADMAP.md", "docs/PLAN.md", "PLAN.md", "docs/decisions"];
const git = (root, ...a) => { try { return execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 256 * 2 ** 20, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };

// A milestone file's slices: id → its line without the box, its chain, its brief (the indented lines under it).
export function slicesOf(text) {
  const out = {}, rest = [];
  let cur = null;
  for (const l of (text || "").split(/\r?\n/)) {
    const m = /^- \[[ xX~-]\] \*\*([^\s*·]+)\s*·(.*)$/.exec(l);
    if (m) {
      const after = (/·\s*after:\s*([^·]*)/.exec(m[2])?.[1] || "").trim();
      cur = out[m[1]] = { head: m[2].replace(/·\s*after:\s*[^·]*/, "").trim(), after, body: "" };
      continue;
    }
    if (cur && /^\s+\S/.test(l)) cur.body += l.trim() + "\n";
    else { if (l.trim()) cur = null; if (!cur) rest.push(l.trim()); }
  }
  return { slices: out, header: rest.filter(Boolean).join("\n") };
}

// What one commit changed in the plan: per milestone file the slices it added, rewrote or re-chained, and whether it
// changed the file's own text; and whether it changed PLAN or a decision.
function analyse(root, hash) {
  const files = (git(root, "show", "--name-only", "--format=", hash) || "").split(/\r?\n/).filter(Boolean);
  const res = { plan: files.some((f) => /(^|\/)(PLAN\.md|decisions\/)/.test(f)), ms: {} };
  for (const f of files) {
    const m = /(^|\/)roadmap\/([^/]+)\.md$/.exec(f);
    if (!m) continue;
    const a = slicesOf(git(root, "show", `${hash}^:${f}`) || ""), b = slicesOf(git(root, "show", `${hash}:${f}`) || "");
    const ids = Object.keys(b.slices);
    const added = ids.filter((id) => !a.slices[id]);
    const rewritten = ids.filter((id) => a.slices[id] && (a.slices[id].head !== b.slices[id].head || a.slices[id].body !== b.slices[id].body));
    const chain = ids.filter((id) => a.slices[id] && a.slices[id].after !== b.slices[id].after);
    const header = a.header !== b.header;
    if (added.length || rewritten.length || chain.length || header) res.ms[m[2]] = { added, rewritten, chain, header };
  }
  return res;
}

// Per-machine cache of the commits read (a commit never changes), keyed by its hash.
const CACHE_FILE = path.join(GLOBAL_DATA, "cache", "plan-commits.json");
const CACHE_VERSION = 1;
function cached(root, hashes) {
  let c = {};
  try { const j = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); if (j.version === CACHE_VERSION) c = j.commits || {}; } catch { /* first run */ }
  let changed = false;
  for (const h of hashes) if (!c[h]) { c[h] = analyse(root, h); changed = true; }
  if (changed) try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version: CACHE_VERSION, commits: c }));
    fs.renameSync(tmp, CACHE_FILE);
  } catch { /* the cache is a convenience */ }
  return c;
}

// merges: [{ id, time }] · open: milestone ids with slices left · stepAt(time) → the step type running then ·
// cost(id) → a slice's ≈ equiv (null when unknown). Returns one row per milestone whose build started, and the times of
// the commits counted (for the manager messages that led to them).
export function planInterventions(root, { merges, open, stepAt, cost, now = new Date() }) {
  const win = {};
  for (const m of merges) {
    const ms = m.id.split(".")[0];
    const w = (win[ms] ??= { first: m.time, last: m.time });
    if (m.time < w.first) w.first = m.time;
    if (m.time > w.last) w.last = m.time;
  }
  for (const [ms, w] of Object.entries(win)) w.end = open.has(ms) ? now : w.last;
  const mergedAt = new Map(merges.map((m) => [m.id, m.time]));
  const starts = Object.values(win).map((w) => w.first);
  if (!starts.length) return { milestones: [], commitTimes: [] };
  const since = new Date(Math.min(...starts)).toISOString();
  const log = (git(root, "log", "--all", "--no-merges", `--since=${since}`, "--format=%H%x09%cI", "--", ...PLAN_PATHS) || "")
    .split(/\r?\n/).filter(Boolean).map((l) => { const [hash, date] = l.split("\t"); return { hash, time: new Date(date) }; });
  const info = cached(root, log.map((c) => c.hash));
  const rows = {};
  const row = (ms) => (rows[ms] ??= { id: ms, commits: new Set(), added: new Set(), rewritten: new Set(), chain: new Set() });
  const commitTimes = [];
  for (const c of log) {
    if (stepAt(c.time) === "test") continue;
    const r = info[c.hash];
    let counted = false;
    for (const [ms, d] of Object.entries(r.ms)) {
      const w = win[ms];
      if (!w || c.time <= w.first || c.time > w.end) continue;
      const x = row(ms);
      d.added.forEach((id) => x.added.add(id));
      d.chain.filter((id) => !mergedAt.has(id) || mergedAt.get(id) > c.time).forEach((id) => x.chain.add(id));
      d.rewritten.filter((id) => !mergedAt.has(id) || mergedAt.get(id) > c.time).forEach((id) => x.rewritten.add(id));
      x.commits.add(c.hash);
      counted = true;
    }
    if (r.plan) for (const [ms, w] of Object.entries(win)) if (c.time > w.first && c.time <= w.end) { row(ms).commits.add(c.hash); counted = true; }
    if (counted) commitTimes.push(c.time);
  }
  const milestones = Object.keys(win).sort((a, b) => win[a].first - win[b].first).map((ms) => {
    const x = rows[ms] || { commits: new Set(), added: new Set(), rewritten: new Set(), chain: new Set() };
    const off = new Set([...x.added, ...x.rewritten, ...x.chain]);
    const built = merges.filter((m) => m.id.split(".")[0] === ms).map((m) => m.id);
    const costs = [...off].filter((id) => built.includes(id)).map(cost).filter((v) => v != null);
    return {
      id: ms, commits: x.commits.size, added: x.added.size, rewritten: x.rewritten.size, chain: x.chain.size,
      offPlan: [...off].sort(), planned: built.filter((id) => !off.has(id)).length, offBuilt: built.filter((id) => off.has(id)).length,
      offEquiv: Math.round(costs.reduce((a, b) => a + b, 0)),
    };
  });
  return { milestones, commitTimes };
}
