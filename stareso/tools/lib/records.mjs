// The machine records of a stareso project: append-only JSONL datasets, one event per line.
//
//   <project>/docs/data/sessions.jsonl   one session's aggregates per line (session-stats --log); last line per id wins
//   <project>/docs/data/builds.jsonl     one build event per line: slice (slice-done), caps and note (record.mjs)
//   ~/.claude/stareso/data/plan-windows.jsonl   readings of the plan's 5-hour and weekly windows (per machine)
//   ~/.claude/stareso/data/projects.jsonl       one summary per project and change, the cross-project reference
//
// A project is migrated when its data folder exists (migrate-records.mjs creates it, setup runs it). The old files
// (docs/BUILD-LOG.md, docs/usage-sessions.json, docs/USAGE.md) are read by migrate-records alone: a project that still
// has them is migrated first. STARESO_DATA points the project's data folder elsewhere (a read-only check against a
// scratch copy of the datasets).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const GLOBAL_DATA = path.join(os.homedir(), ".claude", "stareso", "data");
export const dataDir = (root) => (process.env.STARESO_DATA ? path.resolve(process.env.STARESO_DATA) : path.join(root, "docs", "data"));
export const migrated = (root) => fs.existsSync(dataDir(root));
export const sessionsFile = (root) => path.join(dataDir(root), "sessions.jsonl");
export const buildsFile = (root) => path.join(dataDir(root), "builds.jsonl");

export function readJsonl(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return []; }
  const out = [];
  for (const l of text.split(/\r?\n/)) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { /* a torn line (union merge, crash): skipped */ }
  }
  return out;
}

// The last lines of a long file only (the plan readings grow by a few lines an hour while a panel is open).
export function readJsonlTail(file, bytes) {
  let text = "";
  try {
    const fd = fs.openSync(file, "r");
    const size = fs.fstatSync(fd).size, from = Math.max(0, size - bytes);
    const b = Buffer.alloc(size - from);
    fs.readSync(fd, b, 0, b.length, from);
    fs.closeSync(fd);
    text = b.toString("utf8");
    if (from) text = text.slice(text.indexOf("\n") + 1);
  } catch { return []; }
  return text.split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

export function appendJsonl(file, objs) {
  if (!objs.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // a file that does not end with a newline (hand edit) gets one first, so two events never share a line
  let lead = "";
  try { const fd = fs.openSync(file, "r"); const b = Buffer.alloc(1); const size = fs.fstatSync(fd).size; if (size) fs.readSync(fd, b, 0, 1, size - 1); fs.closeSync(fd); lead = size && b[0] !== 10 ? "\n" : ""; } catch { /* new file */ }
  fs.appendFileSync(file, lead + objs.map((o) => JSON.stringify(o)).join("\n") + "\n");
}

export const writeJsonl = (file, objs) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, objs.map((o) => JSON.stringify(o)).join("\n") + (objs.length ? "\n" : "")); };

// ---------- sessions
// Entry shape (as docs/usage-sessions.json kept it): { id, at, s: {id, first, last, kind, kinds, user, assistant, active,
// compactions, usage, models, byModel, launchTs, launches}, steps: [...], h: {n, out, cr, cw, equiv, models, byModel},
// inWorktree, wf, seeded? }. `at` is when the line was written.
export function readSessions(root) {
  const byId = {};
  for (const e of readJsonl(sessionsFile(root))) { if (e?.id && e.s) byId[e.id] = plainChat(e); }
  return byId;
}

// Step labels that held the first words of a request ("chat: next step", before 2026-10-22) become plain "chat".
export const plainChat = (e) => ({ ...e, steps: (e.steps || []).map((st) => (/^chat: /.test(st.kind) ? { ...st, kind: "chat" } : st)) });

const sameEntry = (a, b) => { const strip = ({ at, loggedOn, ...rest }) => rest; return JSON.stringify(strip(a)) === JSON.stringify(strip(b)); };
// Appends the entries that changed since their last line; rewrites the file with the last line per id once it holds
// more than twice as many lines as sessions (a session still open is appended at every run), or when an older line
// still carries words of a request in a step label (the rewrite keeps one plain line per session).
export function saveSessions(root, entries) {
  const file = sessionsFile(root);
  const lines = readJsonl(file);
  const worded = lines.some((e) => e?.steps?.some((st) => /^chat: /.test(st.kind)));
  const last = {};
  for (const e of lines) if (e?.id) last[e.id] = plainChat(e);
  const at = new Date().toISOString().slice(0, 16);
  entries = entries.map(plainChat);
  const fresh = entries.filter((e) => !last[e.id] || !sameEntry(last[e.id], e)).map((e) => ({ ...e, at }));
  if (worded || lines.length + fresh.length > 2 * (Object.keys(last).length + fresh.length) + 20) {
    for (const e of fresh) last[e.id] = e;
    writeJsonl(file, Object.values(last).sort((a, b) => (a.s.first || "").localeCompare(b.s.first || "")));
  } else appendJsonl(file, fresh);
  return fresh.length;
}

// ---------- builds
const PROFILES = ["eco", "fast", "night", "day"], TIERS = ["strong", "standard", "light"], HELPERS = ["subagent", "session", "inline"];
const MODEL_TIER = { opus: "strong", sonnet: "standard", haiku: "light" };

// One BUILD-LOG line → one event (null for anything that is not a dated line). The flags keep the old readers' rules:
// `inline` (built by the conductor: usage-report), `conductor` (counts as conductor-built: session-stats), `human`.
export function parseLogLine(l) {
  const d = /^- (\d{4}-\d\d-\d\d)(?: (\d\d:\d\d))? · (.*)$/.exec(l);
  if (!d) return null;
  const t = d[2] ? `${d[1]} ${d[2]}` : d[1];
  const p = d[3].split(" · ").map((x) => x.trim());
  if (p[0] === "caps") {
    const rest = p.slice(1).join(" · ");
    const g = (re) => Number((re.exec(rest) || [])[1]) || null;
    return { type: "caps", t, start: g(/helper start (\d+) %/), pause: g(/pause (\d+) %/), weekly: g(/weekly (\d+) %/), deadline: (/deadline (\d\d:\d\d)/.exec(rest) || [])[1] || null, note: rest };
  }
  const id = (p[0] || "").split(" ")[0];
  if (!d[2] || !/^[A-Za-z]+\d*\.\w+$/.test(id) || p.length < 4) return { type: "note", t, text: d[3] };
  const tok = /([\d.]+)\s*(k?) tokens/.exec(p[3] || "");
  const tokens = tok ? Number(tok[1]) * (tok[2] ? 1000 : 1) : null;
  const rest = p.slice(4);
  const profile = rest.find((x) => PROFILES.includes(x)) || "";
  const tier = p.find((x) => TIERS.includes(x)) || MODEL_TIER[p[1]] || "";
  const helper = rest.find((x) => HELPERS.includes(x)) || "";
  const harness = helper ? rest[rest.indexOf(helper) - 1] || "" : "";
  const known = new Set([profile, tier, helper, harness].filter(Boolean));
  return {
    type: "slice", t, id, title: p[0].slice(id.length).trim(), model: p[1], result: p[2], tokens, profile, harness, helper, tier,
    note: rest.filter((x) => !known.has(x) && x !== "tier ?").join(" · "),
    inline: /inline|built in chat|not shown/.test(l) || (tok ? Number(tok[1]) === 0 : false),
    conductor: /(^|[^\d.,])0 tokens|tokens not shown|built in chat/i.test(l) && !/\bhuman\b|done by the user/i.test(l),
  };
}

// The build events of a project (docs/data/builds.jsonl).
export const readBuilds = (root) => readJsonl(buildsFile(root)).filter((e) => e && e.type);

// For the tools that write records: a project with no data folder is migrated first.
export function needMigrated(root) {
  if (migrated(root)) return;
  console.error("This project has no docs/data/ records yet: run `node ~/.claude/stareso/tools/migrate-records.mjs` first.");
  process.exit(1);
}

// An event back to its BUILD-LOG line (the retro and `usage-report --builds` read them this way).
export function logLine(e) {
  if (e.type === "caps") return `- ${e.t} · caps · ${e.note}`;
  if (e.type === "note") return `- ${e.t} · ${e.text}`;
  if (e.type === "merge") return `- ${e.t} · ${e.id} merged without a log line${e.merge?.lines != null ? ` · ${e.merge.lines} lines` : ""}`;
  return "- " + [e.t, `${e.id} ${e.title}`, e.model, e.result, e.tokens != null ? `${e.tokens} tokens` : "tokens not shown", e.profile, e.harness, e.helper, e.tier, e.note].filter(Boolean).join(" · ");
}

// ---------- merges, with the lines each changed outside docs/: { id, time, lines, fromLog? }, newest first
// From git (an unmigrated project, and the migration): one `git diff --shortstat` per merge. `log` holds the slice
// events as { id, milestone, time }. Arguments as an array: no shell, so "^" (an escape character in cmd.exe) reaches git intact.
export function mergesFromGit(root, log) {
  const git = (...a) => { try { return execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
  const merges = git("log", "--merges", "--format=%H%x09%ad%x09%s", "--date=iso-local").split("\n").filter(Boolean).map((l) => {
    const [hash, date, subj] = l.split("\t");
    const m = /^Merge slice[ /]([A-Za-z]+\d*\.[\w]+|[A-Za-z]+\d+[-\w]*)/i.exec(subj);
    if (!m) return null;
    let id = m[1];
    if (/^m\d+-/.test(id)) id = id.replace(/^m(\d+)-.*/, "M$1"); // branch-style name: milestone only
    const stat = git("diff", "--shortstat", `${hash}^1`, hash, "--", ".", ":(exclude)docs");
    const ins = Number(/(\d+) insertion/.exec(stat)?.[1] || 0), del = Number(/(\d+) deletion/.exec(stat)?.[1] || 0);
    return { id, time: new Date(date.slice(0, 19).replace(" ", "T")), lines: ins + del };
  }).filter(Boolean);
  // A branch merged for a whole milestone ("Merge slice/m14-pdf-type": id "M14") stands for the slices of that
  // milestone logged without a merge of their own: they take the log time, and the first one the branch's lines.
  for (const m of merges.filter((x) => !x.id.includes("."))) {
    const own = log.filter((x) => x.milestone === m.id && !merges.some((y) => y.id === x.id));
    if (!own.length) continue;
    own.forEach((x, i) => merges.push({ id: x.id, time: x.time, lines: i ? null : m.lines, fromLog: true }));
    merges.splice(merges.indexOf(m), 1);
  }
  // A slice with no merge at all (committed straight on main): the log time stands in, lines unknown.
  for (const x of log) if (!merges.some((m) => m.id === x.id)) merges.push({ id: x.id, time: x.time, lines: null, fromLog: true });
  return merges;
}

// From the build records: the slices slice-done merged since the migration (newest first), then the merges the
// migration took from git, in its order; a slice with neither takes its log time.
export function mergesFromRecords(builds) {
  const at = (s) => new Date(s.replace(" ", "T"));
  const out = builds.filter((e) => e.type === "slice" && e.merge).map((e) => ({ id: e.id, time: at(e.merge.at || e.t), lines: e.merge.lines ?? null, ...(e.merge.at ? {} : { fromLog: true }) })).reverse();
  for (const e of builds) if (e.type === "merge") out.push({ id: e.id, time: at(e.at), lines: e.lines ?? null, ...(e.fromLog ? { fromLog: true } : {}) });
  for (const e of builds) if (e.type === "slice" && !out.some((m) => m.id === e.id)) out.push({ id: e.id, time: at(e.t), lines: null, fromLog: true });
  return out;
}

// ---------- plan windows (per machine)
export const planWindowsFile = () => path.join(GLOBAL_DATA, "plan-windows.jsonl");

// ---------- cross-project index (per machine)
export const projectsFile = () => path.join(GLOBAL_DATA, "projects.jsonl");
// The reference the cost-per-slice chart draws, until a project is pinned in its place (`"reference": true`).
export const SEED_REFERENCE = { reference: true, label: "project A M5 (2026-10-20)", equiv: 335e3, t: "2026-10-20" };
export function readProjects() {
  const list = readJsonl(projectsFile());
  return list.length ? list : [SEED_REFERENCE];
}
