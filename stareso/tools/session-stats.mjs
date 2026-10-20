// Token and model usage from Claude Code transcripts (JSONL under the Claude projects folder).
//
// Two modes:
//   --log            from inside a stareso project: finds every session of this project (and of its worktrees),
//                    with their helper agents, and regenerates docs/USAGE.md (one line per session, totals).
//                    Run at the end of a build or a test; re-running updates the lines of sessions still open.
//                    `--log --dry-run` prints the block instead of writing docs/USAGE.md.
//   <out> <files…>   deep retro: one summary line per transcript on stdout and, in <out>/, a text file per
//                    transcript with the header (models, tokens, tools) and the timeline of the user's messages.
//
// Prints prompts only (deep mode); never file contents or tool results. USAGE.md holds numbers only: no paths, no names.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { execSync } from "node:child_process";

const PROJECTS = path.join(os.homedir(), ".claude", "projects");

function localIso(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

// Every stareso step of a session, in order ("status → build M27 → improve"); a repeat of the last one is skipped.
function addKind(s, name, rawArg) {
  const arg = (rawArg || "").trim().split(/\s+/)[0] || "";
  // Keep the argument only when it names a range or a profile (M23, M3.2-M3.6, all, eco, fast), not free text.
  const kind = (name + (/^([A-Za-z]?\d[\w.-]*|all|eco|fast)$/i.test(arg) ? " " + arg : "")).trim();
  if (s.kinds.at(-1) !== kind) s.kinds.push(kind);
  s.kind = s.kinds.join(" → ");
  return kind;
}

// "chat: usage times seem" from the user's request (tags and paths dropped), for steps no skill names.
const chatLabel = (txt) => {
  const words = (txt || "").replace(/<[^>]+>[^<]*<\/[^>]+>|<[^>]+>/g, " ").replace(/\S*[\\/]\S*/g, "").trim().split(/\s+/).slice(0, 4).join(" ").slice(0, 32);
  return words ? "chat: " + words : "chat";
};

// Splits a session at its step marks (a stareso skill, or a request the app's task list marks as a new task).
// Each step gets its turns, tokens, active time and helpers; `carried` is the context it started with.
function splitSteps(s, helpers, fallback) {
  let marks = [...s.marks].sort((a, b) => a.ts.localeCompare(b.ts));
  // A new-task request that goes straight into a skill is one step, named after the skill.
  marks = marks.filter((m) => !(m.soft && marks.some((n) => !n.soft && n.ts === m.ts)));
  marks = marks.filter((m, i) => i === 0 || m.kind !== marks[i - 1].kind);
  if (!marks.length || s.events.some((e) => e.a && e.ts < marks[0].ts)) marks.unshift({ ts: s.first, kind: (!marks.length && fallback) || chatLabel(s.firstText) });
  const steps = marks.map((m) => ({ kind: m.kind, first: m.ts, last: m.ts, turns: 0, user: 0, active: 0, carried: null,
    usage: { cache_read: 0, cache_create: 0, output: 0 }, hN: 0, hEquiv: 0, models: {} }));
  let i = 0, prev = null;
  for (const ev of s.events) {
    while (i + 1 < steps.length && ev.ts >= steps[i + 1].first) i++;
    const st = steps[i];
    const gap = prev ? new Date(ev.ts) - new Date(prev) : 0;
    if (gap > 0 && gap <= 15 * 60e3) st.active += gap;
    prev = ev.ts; st.last = ev.ts;
    if (ev.u) st.user++;
    if (ev.a) {
      st.turns++;
      if (ev.model) st.models[ev.model] = (st.models[ev.model] || 0) + 1;
      const u = ev.usage || {};
      st.carried ??= (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.input_tokens || 0);
      st.usage.cache_read += u.cache_read_input_tokens || 0; st.usage.cache_create += u.cache_creation_input_tokens || 0; st.usage.output += u.output_tokens || 0;
    }
  }
  for (const h of helpers) {
    const st = [...steps].reverse().find((x) => h.first && x.first <= h.first) || steps[0];
    st.hN++; st.hEquiv += equiv(h.usage);
  }
  return steps;
}

async function summarise(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const s = { id: path.basename(file, ".jsonl"), first: null, last: null, models: {}, tools: {}, user: 0, assistant: 0, agents: 0,
    compactions: 0, active: 0, kind: null, kinds: [], events: [], marks: [], lastUserTs: null, lastUserText: "", firstText: "", usage: { input: 0, cache_read: 0, cache_create: 0, output: 0 }, timeline: [] };
  const t = (ts) => (ts || "").slice(5, 16);
  for await (const line of rl) {
    let o; try { o = JSON.parse(line); } catch { continue; }
    // Transcripts stamp UTC; docs show local time (no "Z", so Date parses it back as local).
    if (o.timestamp) o.timestamp = localIso(o.timestamp);
    if (o.timestamp) {
      // Active time: gaps longer than 15 min (lunch, night) are pauses, not work.
      const gap = s.last ? new Date(o.timestamp) - new Date(s.last) : 0;
      if (gap > 0 && gap <= 15 * 60e3) s.active += gap;
      s.first ??= o.timestamp; s.last = o.timestamp;
    }
    if (o.isCompactSummary) s.compactions++;
    const m = o.message; if (!m) continue;
    if (o.type === "user") {
      const c = m.content;
      const texts = typeof c === "string" ? [c] : Array.isArray(c) ? c.filter((p) => p.type === "text" && !o.isMeta).map((p) => p.text) : [];
      for (const txt of texts) {
        s.user++; s.timeline.push(`${t(o.timestamp)} U ${txt.replace(/\s+/g, " ").slice(0, 220)}`);
        s.events.push({ ts: o.timestamp, u: 1 });
        s.lastUserTs = o.timestamp; s.lastUserText = txt; s.firstText ||= txt;
        const k = /<command-name>\/stareso(?:-app)?-([\w-]+)<\/command-name>(?:\s*<command-message>[^<]*<\/command-message>)?(?:\s*<command-args>([^<]*)<\/command-args>)?/.exec(txt) || /^\/stareso(?:-app)?-([\w-]+)\s*(\S*)/.exec(txt);
        if (k) s.marks.push({ ts: o.timestamp, kind: addKind(s, k[1], k[2]) });
      }
    } else if (o.type === "assistant") {
      s.assistant++;
      if (m.model && !m.model.startsWith("<")) s.models[m.model] = (s.models[m.model] || 0) + 1;
      s.events.push({ ts: o.timestamp, a: 1, usage: m.usage, model: m.model && !m.model.startsWith("<") ? m.model : null });
      if (m.usage) {
        s.usage.input += m.usage.input_tokens || 0;
        s.usage.cache_read += m.usage.cache_read_input_tokens || 0;
        s.usage.cache_create += m.usage.cache_creation_input_tokens || 0;
        s.usage.output += m.usage.output_tokens || 0;
      }
      for (const p of m.content || []) {
        if (p.type !== "tool_use") continue;
        s.tools[p.name] = (s.tools[p.name] || 0) + 1;
        if (p.name === "Agent" || p.name === "Task") { s.agents++; s.timeline.push(`${t(o.timestamp)} A ${p.input?.subagent_type || "?"} ${(p.input?.description || "").slice(0, 80)}`); }
        if (p.name === "Skill") {
          s.timeline.push(`${t(o.timestamp)} S ${p.input?.skill}`);
          // A step the agent started itself (e.g. improve after a status) counts like a typed command.
          const k = /^stareso(?:-app)?-([\w-]+)$/.exec(p.input?.skill || "");
          if (k) s.marks.push({ ts: s.lastUserTs || o.timestamp, kind: addKind(s, k[1], p.input?.args) });
        }
        // The app's task list says when a request is unrelated work: a new step, named from the request.
        if (/update_plan$/.test(p.name) && p.input?.scope === "new_task") s.marks.push({ ts: s.lastUserTs || o.timestamp, kind: chatLabel(s.lastUserText), soft: true });
      }
    }
  }
  return s;
}

const hours = (ms) => (ms / 3.6e6).toFixed(1);
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));
const short = (model) => model.replace(/^claude-/, "").replace(/-\d.*$/, "");
const modelsText = (models) => Object.entries(models).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${short(m)} ${n}`).join(", ");
// Relative weights of list prices (cache read 0.1, cache write 1.25, output 5): a comparison unit, not money.
const equiv = (u) => u.cache_read * 0.1 + u.cache_create * 1.25 + u.output * 5;

async function logMode(dryRun) {
  let root = process.cwd();
  while (!fs.existsSync(path.join(root, "docs")) && path.dirname(root) !== root) root = path.dirname(root);
  if (!fs.existsSync(path.join(root, "docs"))) { console.error("No docs/ folder: run from inside a stareso project."); process.exit(1); }
  // A worktree logs the whole project's sessions (its own are found through the "--claude-worktrees-" prefix).
  const projectRoot = root.replace(/[\\/]\.claude[\\/]worktrees[\\/].*$/, "");
  const slug = projectRoot.replace(/[^A-Za-z0-9]/g, "-");
  const dirs = fs.existsSync(PROJECTS) ? fs.readdirSync(PROJECTS).filter((d) => d === slug || d.startsWith(slug + "--claude-worktrees-")) : [];
  if (!dirs.length) { console.error("No transcripts found for this project."); process.exit(1); }

  // Sessions spent on the workflow itself (a `/stareso-retro` run, or a worktree named for it) are listed
  // apart and left out of the project totals: they are not the project's cost.
  const isWorkflowSession = (s, dirName) => /workflow-review|retro/.test(s.kinds?.[0] || "") || /workflow-review|stareso-retro|workflow-improvement/.test(dirName);
  const newTotals = () => ({ sessions: 0, turns: 0, user: 0, active: 0, compactions: 0, out: 0, cr: 0, cw: 0, helpers: 0, hOut: 0, hCr: 0, hCw: 0, equiv: 0, models: {} });
  const rows = [], wfRows = [];
  const totals = newTotals(), wfTotals = newTotals();
  for (const d of dirs) {
    const dir = path.join(PROJECTS, d);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
      const s = await summarise(path.join(dir, f));
      if (!s.assistant) continue;
      const hDir = path.join(dir, s.id, "subagents");
      const helpers = [];
      if (fs.existsSync(hDir)) for (const hf of fs.readdirSync(hDir).filter((x) => x.endsWith(".jsonl"))) helpers.push(await summarise(path.join(hDir, hf)));
      const h = helpers.reduce((a, x) => { a.n++; a.out += x.usage.output; a.cr += x.usage.cache_read; a.cw += x.usage.cache_create; for (const [m, n] of Object.entries(x.models)) a.models[m] = (a.models[m] || 0) + n; return a; }, { n: 0, out: 0, cr: 0, cw: 0, models: {} });
      const e = equiv(s.usage) + helpers.reduce((a, x) => a + equiv(x.usage), 0);
      const inWorktree = d !== slug;
      const end = s.last.slice(0, 10) === s.first.slice(0, 10) ? s.last.slice(11, 16) : s.last.slice(5, 16).replace("T", " ");
      const wf = isWorkflowSession(s, d);
      const kind = (wf && !/workflow-review|stareso-retro/.test(s.kind || "") ? "workflow review" : s.kind || "chat") + (inWorktree ? " (worktree)" : "");
      // Session line, its steps and its details are written once the sessions are numbered (below).
      const session = (n) => `| ${n} | ${s.first.slice(0, 10)} ${s.first.slice(11, 16)}–${end} | ${kind} | ${hours(steps.reduce((a, st) => a + st.active, 0))} | ${modelsText(s.models) || "—"} | ${s.assistant} | ${s.user} | ${h.n || ""} | ${fmt(Math.round(e))} |`;
      const details = (n) => `| ${n} | ${s.compactions || ""} | ${fmt(Math.round(s.usage.cache_read / Math.max(1, s.assistant)))} | ${fmt(s.usage.output)} | ${fmt(s.usage.cache_read)} | ${fmt(s.usage.cache_create)} | ${h.n ? `${modelsText(h.models)} · out ${fmt(h.out)} · cache ${fmt(h.cr)}` : ""} |`;
      // Carried = context at the step's start above the base (what any new session starts with, see `base` below)
      // and its share of the step's cost (extra × turns × 0.1): what a new session would have saved. Blank for a
      // session's first step. A session with no step mark (e.g. a review run in a worktree named for it) keeps the session's label.
      const steps = splitSteps(s, helpers, wf ? "workflow review" : null);
      const stepLines = (n, base) => steps.map((st, i) => {
        const se = equiv(st.usage) + st.hEquiv;
        const extra = Math.max(0, (st.carried || 0) - base);
        const carried = i && st.turns ? `${Math.round(100 * Math.min(1, extra * st.turns * 0.1 / Math.max(1, se)))} % · ${fmt(extra)}` : "";
        const stEnd = st.last.slice(0, 10) === st.first.slice(0, 10) ? st.last.slice(11, 16) : st.last.slice(5, 16).replace("T", " ");
        return `| ${n} | ${st.first.slice(5, 10)} ${st.first.slice(11, 16)}–${stEnd} | ${st.kind} | ${hours(st.active)} | ${st.turns} | ${st.user} | ${st.hN || ""} | ${fmt(Math.round(se))} | ${carried} |`;
      });
      (wf ? wfRows : rows).push({ first: s.first, turns: s.assistant, session, details, stepLines, steps, s, h, e, wf });
    }
  }
  // A forked or continued session shares its start timestamp with the original and repeats its turns:
  // keep the longest transcript per start time, so nothing is counted twice.
  const dedupe = (list) => {
    const byStart = new Map();
    for (const r of list) { const k = r.first; if (!byStart.has(k) || byStart.get(k).turns < r.turns) byStart.set(k, r); }
    return [...byStart.values()].sort((a, b) => a.first.localeCompare(b.first));
  };
  const kept = dedupe(rows), wfKept = dedupe(wfRows);
  for (const r of [...kept, ...wfKept]) {
    const t = r.wf ? wfTotals : totals, s = r.s, h = r.h;
    t.sessions++; t.turns += s.assistant; t.user += s.user; t.active += s.active; t.compactions += s.compactions; t.out += s.usage.output; t.cr += s.usage.cache_read; t.cw += s.usage.cache_create;
    t.helpers += h.n; t.hOut += h.out; t.hCr += h.cr; t.hCw += h.cw; t.equiv += r.e;
    for (const [m, n] of Object.entries(s.models)) t.models[m] = (t.models[m] || 0) + n;
    for (const [m, n] of Object.entries(h.models)) t.models[m] = (t.models[m] || 0) + n;
  }
  rows.length = 0; rows.push(...kept); wfRows.length = 0; wfRows.push(...wfKept);
  // Short session numbers link the Sessions, Steps and Details tables (W1… for workflow sessions).
  rows.forEach((r, i) => { r.n = String(i + 1); }); wfRows.forEach((r, i) => { r.n = "W" + (i + 1); });
  // Base context: the median context at the first turn of the project's sessions (system prompt, tools, CLAUDE.md,
  // memory). Every new session pays it, so Carried counts only what lies above it.
  const firsts = rows.map((r) => r.steps[0].carried).filter((c) => c != null).sort((a, b) => a - b);
  const base = firsts.length ? firsts[Math.floor((firsts.length - 1) / 2)] : 0;

  const tables = (list) => [
    "| # | Date (start–end) | Steps | Active h | Models (turns) | Turns | You | Helpers | ≈ equiv |", "|---|---|---|---|---|---|---|---|---|",
    ...list.map((r) => r.session(r.n)), "",
    "| # | Start–end | Step | Active h | Turns | You | Helpers | ≈ equiv | Carried |", "|---|---|---|---|---|---|---|---|---|",
    ...list.flatMap((r) => r.stepLines(r.n, base)),
  ];
  // Cost per slice: a build session often runs past its first milestone, so count the "Merge slice …" commits
  // (slice-done, every branch) made between the session's start and end, plus 5 min for the last merge.
  let merges = [];
  try {
    const seen = new Set();
    merges = execSync("git log --all --merges --format=%H%x09%cI%x09%s", { cwd: root, encoding: "utf8" }).split("\n")
      .map((l) => l.split("\t")).filter(([h, , subj]) => h && /^Merge slice /.test(subj || "") && !seen.has(h) && seen.add(h))
      .map(([, date]) => new Date(date).getTime());
  } catch { /* not a git repository: no cost-per-slice table */ }
  // Windows can overlap (one session ends as the next starts): a merge goes to the latest-started session holding it.
  const merged = new Map();
  for (const m of merges) {
    const owner = rows.filter((r) => m >= new Date(r.s.first).getTime() && m <= new Date(r.s.last).getTime() + 5 * 60e3)
      .sort((a, b) => b.first.localeCompare(a.first))[0];
    if (!owner) continue;
    // Within the session, the merge belongs to the step running then (the build, not a status or improve after it).
    const step = [...owner.steps].reverse().find((st) => m >= new Date(st.first).getTime()) || owner.steps[0];
    merged.set(step, { r: owner, n: (merged.get(step)?.n || 0) + 1 });
  }
  const sliceRows = [...merged.entries()].sort((a, b) => a[0].first.localeCompare(b[0].first)).map(([st, { n }]) => {
    const se = equiv(st.usage) + st.hEquiv;
    return `| ${merged.get(st).r.n} | ${st.first.slice(0, 10)} ${st.first.slice(11, 16)} | ${st.kind} | ${n} | ${fmt(Math.round(se))} | ${fmt(Math.round(se / n))} |`;
  });
  // Planning cost per planned slice: the slices an improve or test step added to the roadmap, counted from the
  // `- [ ] **<id> · …` lines its commits added (an id also removed in the same commit is a tick or a move, not new).
  // A commit goes to the latest-started step running then, as merges do; only improve and test steps keep theirs.
  // A step that never writes slices (status, retro) hands its commit back to the session's last improve or test
  // before it: the test's records are often committed just after the user typed the next command.
  let planCommits = [];
  try {
    planCommits = execSync("git log --all --no-merges --format=@@@%x09%H%x09%cI -p --unified=0 -- docs/roadmap roadmap docs/ROADMAP.md ROADMAP.md", { cwd: root, encoding: "utf8", maxBuffer: 256 * 2 ** 20 })
      .split(/^@@@\t/m).slice(1).map((chunk) => {
        const [hash, date] = chunk.slice(0, chunk.indexOf("\n")).split("\t");
        const ids = { "+": new Set(), "-": new Set() };
        for (const l of chunk.split("\n")) { const k = /^([+-])\s*- \[[ xX]\] \*\*([^\s*·]+)/.exec(l); if (k) ids[k[1]].add(k[2]); }
        return { hash, t: new Date(date).getTime(), n: [...ids["+"]].filter((id) => !ids["-"].has(id)).length };
      }).filter((c, i, all) => c.n && all.findIndex((d) => d.hash === c.hash) === i);
  } catch { /* not a git repository: no planning table */ }
  const allSteps = rows.flatMap((r) => r.steps.map((st) => ({ r, st, from: new Date(st.first).getTime(), to: new Date(st.last).getTime() + 5 * 60e3 })));
  const planned = new Map();
  for (const c of planCommits) {
    let owner = allSteps.filter((x) => c.t >= x.from && c.t <= x.to).sort((a, b) => b.from - a.from)[0];
    if (owner && /^(status|retro|workflow)/.test(owner.st.kind)) owner = allSteps.filter((x) => x.r === owner.r && x.from < owner.from).at(-1);
    if (!owner || !/^(improve|test)\b/.test(owner.st.kind)) continue;
    planned.set(owner.st, { r: owner.r, n: (planned.get(owner.st)?.n || 0) + c.n });
  }
  const planList = [...planned.entries()].sort((a, b) => a[0].first.localeCompare(b[0].first)).map(([st, { r, n }]) => ({ st, r, n, se: equiv(st.usage) + st.hEquiv }));
  const planRows = planList.map(({ st, r, n, se }) => `| ${r.n} | ${st.first.slice(0, 10)} ${st.first.slice(11, 16)} | ${st.kind} | ${n} | ${fmt(Math.round(se))} | ${fmt(Math.round(se / n))} |`);
  if (planList.length > 1) {
    const [n, se] = planList.reduce(([a, b], x) => [a + x.n, b + x.se], [0, 0]);
    planRows.push(`| | | **All** | ${n} | ${fmt(Math.round(se))} | ${fmt(Math.round(se / n))} |`);
  }
  // Conductor-built slices: BUILD-LOG lines whose helper tokens are 0 or missing, or that say "built in chat"
  // (the conductor did the work itself); human slices (done by the user) are left out.
  const logFile = path.join(root, "docs", "BUILD-LOG.md");
  const byDay = {};
  if (fs.existsSync(logFile)) for (const l of fs.readFileSync(logFile, "utf8").split(/\r?\n/)) {
    const d = /^- (\d{4}-\d{2}-\d{2})\b/.exec(l);
    if (d && /(^|[^\d.,])0 tokens|tokens not shown|built in chat/i.test(l) && !/\bhuman\b|done by the user/i.test(l)) byDay[d[1]] = (byDay[d[1]] || 0) + 1;
  }
  const conductorBuilt = Object.values(byDay).reduce((a, n) => a + n, 0);
  const allTurns = (t) => Object.values(t.models).reduce((a, n) => a + n, 0);
  const highlights = (t) => `${hours(t.active)} h active · ${t.user} messages from you, ${(t.turns / Math.max(1, t.user)).toFixed(1)} session turns each · helpers made ${Math.round(100 * (allTurns(t) - t.turns) / Math.max(1, allTurns(t)))}% of all turns · ${t.compactions} compaction${t.compactions === 1 ? "" : "s"}`;
  const scopes = [["Project", totals], ...(wfRows.length ? [["Workflow improvement", wfTotals]] : [])];
  const modelNames = [...new Set(scopes.flatMap(([, t]) => Object.keys(t.models)))].sort((a, b) => scopes.reduce((n, [, t]) => n + (t.models[b] || 0), 0) - scopes.reduce((n, [, t]) => n + (t.models[a] || 0), 0));
  const glossary = [
    "### Glossary", "",
    "Token = a small chunk of text (about three-quarters of a word). Turn = one model response. `k` = thousand, `M` = million. Times are local (the computer's time zone).", "",
    "| Column | Meaning |", "|---|---|",
    "| # | Session number: links the Sessions, Steps and Details rows (W1… = workflow sessions). |",
    "| Date / Start–end | Start date and time, then end time (`10-18 15:10` = ended on a later day). |",
    "| Steps | The stareso steps of the session in order (`status → build M27 → improve`; `build M5` = started with M5, it may go on to later milestones). `chat: …` = work no skill names, a request the task list marked as new. `(worktree)` = it ran in its own copy of the repo. |",
    "| Step rows | One per step, split at the step's first message; helpers go to the step that started them. The session's totals are the sum of its steps. |",
    `| Carried | For a session's later steps: share of the step's cost spent re-reading the context it started with above the base (${fmt(base)}, the median context at the first turn of this project's sessions, which every new session pays), then that extra context's size. High = a new session would have been cheaper (target < 20 %). |`,
    "| Active h | Hours of work: time between consecutive messages, pauses over 15 min left out. |",
    "| Models (turns) | Models that answered in the session itself, with their turn counts. |",
    "| Turns | Responses in the session itself, helpers excluded. |",
    "| You | Messages typed by the user (including slash commands). |",
    "| Helpers | Fresh agents started for side tasks (their models and tokens are in Details). |",
    "| ≈ equiv | Session (or step) and its helpers together; formula at the bottom. |",
    "| Compact | (Details) Times the context filled up and was summarised (empty = never). |",
    "| Ctx/turn | (Details) Average text the model re-reads each turn (conversation, files, tool results) = cache read ÷ turns. |",
    "| Output | (Details) Tokens the session wrote (replies, code, commands). |",
    "| Cache read / write | (Details) Tokens re-read from the prompt cache (about a tenth of the input price) / stored into it the first time. |", "",
    "In **Totals**, Turns, Output, Cache read and Cache write cover the sessions only, the Helper columns cover the helpers, and ≈ equiv covers both. **Turns per model** counts sessions and helpers. **Cost per slice** divides the ≈ equiv of the step that merged slices (usually the build, its helpers included) by the `Merge slice …` commits made during it. **Planning cost** divides the ≈ equiv of an improve or test step by the slices its commits added to the roadmap (target < 300k per slice). **Conductor-built slices** counts BUILD-LOG lines with `0 tokens`, `tokens not shown` or `built in chat`, human slices left out (target 0).", "",
  ];
  const block = [
    "### Sessions and steps", "", ...tables(rows),
    ...(wfRows.length ? ["", "### Workflow improvement sessions (reviews of the workflow itself: not in the project totals)", "", ...tables(wfRows)] : []),
    "", "### Totals", "",
    "| Scope | Sessions | Turns | Output | Cache read | Cache write | Helpers | Helper output | Helper cache read | ≈ equiv |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...scopes.map(([label, t]) => `| ${label} | ${t.sessions} | ${t.turns} | ${fmt(t.out)} | ${fmt(t.cr)} | ${fmt(t.cw)} | ${t.helpers} | ${fmt(t.hOut)} | ${fmt(t.hCr)} | ${fmt(Math.round(t.equiv))} |`),
    "", ...scopes.map(([label, t]) => `**${label}:** ${highlights(t)}.`),
    ...(sliceRows.length ? ["", "**Cost per slice** (steps that merged slices; the cost of the tests that found the fixes is not included)", "",
      "| # | Step start | Step | Slices merged | ≈ equiv | ≈ equiv per slice |", "|---|---|---|---|---|---|", ...sliceRows] : []),
    ...(planRows.length ? ["", "**Planning cost per planned slice** (improve and test steps that added slices to the roadmap)", "",
      "| # | Step start | Step | Slices planned | ≈ equiv | ≈ equiv per planned slice |", "|---|---|---|---|---|---|", ...planRows] : []),
    "", `**Conductor-built slices:** ${conductorBuilt}${conductorBuilt ? ` (${Object.entries(byDay).sort().map(([d, n]) => `${d} ${n}`).join(" · ")})` : ""}.`,
    "", "**Turns per model** (sessions and their helpers)", "",
    `| Scope | ${modelNames.map(short).join(" | ")} |`, `|---|${modelNames.map(() => "---").join("|")}|`,
    ...scopes.map(([label, t]) => `| ${label} | ${modelNames.map((m) => t.models[m] || "").join(" | ")} |`),
    "", "### Details (per session, for retros)", "",
    "| # | Compact | Ctx/turn | Output | Cache read | Cache write | Helpers (models · output · cache read) |", "|---|---|---|---|---|---|---|",
    ...[...rows, ...wfRows].map((r) => r.details(r.n)),
    "", ...glossary,
    "", `≈ equiv = cache read × 0.1 + cache write × 1.25 + output × 5 (relative list prices: a comparison unit, not money), session and its helpers together. Forks of a session are counted once. Updated ${localIso(new Date()).slice(0, 16).replace("T", " ")}.`,
  ];
  if (dryRun) { console.log(block.join("\n")); return; }
  const file = path.join(root, "docs", "USAGE.md");
  const START = "<!-- usage:start -->", END = "<!-- usage:end -->";
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : `# Usage\n\nToken and model usage per session, generated by \`session-stats.mjs --log\` (run at the end of every build and test; re-running refreshes the lines). Helpers are the fresh agents a session started. Numbers only: no paths, no names.\n\n${START}\n${END}\n`;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const a = lines.indexOf(START), b = lines.indexOf(END);
  if (a < 0 || b < 0) { console.error("docs/USAGE.md has no usage markers."); process.exit(1); }
  fs.writeFileSync(file, [...lines.slice(0, a + 1), ...block, ...lines.slice(b)].join(eol));
  console.log(block[block.length - 1]);
}

async function deepMode(outDir, files) {
  fs.mkdirSync(outDir, { recursive: true });
  let totalEquiv = 0;
  for (const file of files) {
    const s = await summarise(file);
    const name = path.basename(path.dirname(file)).slice(-24) + "_" + s.id;
    const hours = s.first && s.last ? ((new Date(s.last) - new Date(s.first)) / 3.6e6).toFixed(1) : "?";
    const avgCtx = Math.round(s.usage.cache_read / Math.max(1, s.assistant) / 1000);
    const hdr = { file: name, first: s.first, last: s.last, hours, kind: s.kind, user: s.user, assistant: s.assistant, agents: s.agents, compactions: s.compactions, avgContextK: avgCtx, models: s.models, usage: s.usage, tools: s.tools };
    fs.writeFileSync(path.join(outDir, name + ".txt"), JSON.stringify(hdr, null, 1) + "\n\n" + s.timeline.join("\n") + "\n");
    totalEquiv += equiv(s.usage);
    console.log(`${name} · ${(s.first || "").slice(5, 16)} → ${(s.last || "").slice(5, 16)} (${hours} h) · ${s.kind || "chat"} · user ${s.user} · turns ${s.assistant} · agents ${s.agents} · ctx ${avgCtx}k/turn · out ${fmt(s.usage.output)} · cacheRead ${fmt(s.usage.cache_read)} · ${modelsText(s.models)}`);
  }
  console.log(`TOTAL ≈ ${fmt(Math.round(totalEquiv))} input-token equivalents over ${files.length} files`);
}

const argv = process.argv.slice(2);
if (argv[0] === "--log") await logMode(argv.includes("--dry-run"));
else if (argv.length >= 2) await deepMode(argv[0], argv.slice(1));
else { console.error("usage: session-stats.mjs --log [--dry-run]   |   session-stats.mjs <out-dir> <transcript.jsonl>…"); process.exit(1); }
