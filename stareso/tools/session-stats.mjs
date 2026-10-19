// Token and model usage from Claude Code transcripts (JSONL under the Claude projects folder).
//
// Two modes:
//   --log            from inside a stareso project: finds every session of this project (and of its worktrees),
//                    with their helper agents, and regenerates docs/USAGE.md (one line per session, totals).
//                    Run at the end of a build or a test; re-running updates the lines of sessions still open.
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

async function summarise(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const s = { id: path.basename(file, ".jsonl"), first: null, last: null, models: {}, tools: {}, user: 0, assistant: 0, agents: 0,
    compactions: 0, active: 0, kind: null, usage: { input: 0, cache_read: 0, cache_create: 0, output: 0 }, timeline: [] };
  const t = (ts) => (ts || "").slice(5, 16);
  for await (const line of rl) {
    let o; try { o = JSON.parse(line); } catch { continue; }
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
        if (!s.kind) {
          const k = /<command-name>\/stareso(?:-app)?-(\w+)<\/command-name>(?:\s*<command-message>[^<]*<\/command-message>)?(?:\s*<command-args>([^<]*)<\/command-args>)?/.exec(txt) || /^\/stareso(?:-app)?-(\w+)\s*(\S*)/.exec(txt);
          if (k) {
            const arg = (k[2] || "").trim().split(/\s+/)[0] || "";
            // Keep the argument only when it names a range or a profile (M23, M3.2-M3.6, all, eco, fast), not free text.
            s.kind = (k[1] + (/^([A-Za-z]?\d[\w.-]*|all|eco|fast)$/i.test(arg) ? " " + arg : "")).trim();
          }
        }
      }
    } else if (o.type === "assistant") {
      s.assistant++;
      if (m.model && !m.model.startsWith("<")) s.models[m.model] = (s.models[m.model] || 0) + 1;
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
        if (p.name === "Skill") s.timeline.push(`${t(o.timestamp)} S ${p.input?.skill}`);
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

async function logMode() {
  let root = process.cwd();
  while (!fs.existsSync(path.join(root, "docs")) && path.dirname(root) !== root) root = path.dirname(root);
  if (!fs.existsSync(path.join(root, "docs"))) { console.error("No docs/ folder: run from inside a stareso project."); process.exit(1); }
  // A worktree logs the whole project's sessions (its own are found through the "--claude-worktrees-" prefix).
  const projectRoot = root.replace(/[\\/]\.claude[\\/]worktrees[\\/].*$/, "");
  const slug = projectRoot.replace(/[^A-Za-z0-9]/g, "-");
  const dirs = fs.existsSync(PROJECTS) ? fs.readdirSync(PROJECTS).filter((d) => d === slug || d.startsWith(slug + "--claude-worktrees-")) : [];
  if (!dirs.length) { console.error("No transcripts found for this project."); process.exit(1); }

  // Sessions spent on the workflow itself (a `/stareso-workflow-review` run, or a worktree named for it) are listed
  // apart and left out of the project totals: they are not the project's cost.
  const isWorkflowSession = (s, dirName) => /workflow-review|retro/.test(s.kind || "") || /workflow-review|workflow-improvement/.test(dirName);
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
      const line = `| ${s.first.slice(0, 10)} ${s.first.slice(11, 16)}–${end} | ${hours(s.active)} | ${wf && !/workflow-review/.test(s.kind || "") ? "workflow review" : s.kind || "chat"}${inWorktree ? " (worktree)" : ""} | ${modelsText(s.models) || "—"} | ${s.assistant} | ${s.user} | ${s.compactions || ""} | ${fmt(Math.round(s.usage.cache_read / Math.max(1, s.assistant)))} | ${fmt(s.usage.output)} | ${fmt(s.usage.cache_read)} | ${h.n ? `${h.n} (${modelsText(h.models)}) · out ${fmt(h.out)} · cache ${fmt(h.cr)}` : ""} | ${fmt(Math.round(e))} |`;
      (wf ? wfRows : rows).push({ first: s.first, turns: s.assistant, line, s, h, e, wf });
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

  const header = ["| Date (start–end) | Active h | Kind | Models (turns) | Turns | You | Compact | Ctx/turn | Output | Cache read | Helpers | ≈ equiv |", "|---|---|---|---|---|---|---|---|---|---|---|---|"];
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
    if (owner) merged.set(owner, (merged.get(owner) || 0) + 1);
  }
  const sliceRows = rows.map((r) => {
    const n = merged.get(r) || 0;
    return n ?`| ${r.s.first.slice(0, 10)} ${r.s.first.slice(11, 16)} | ${r.s.kind || "chat"} | ${n} | ${fmt(Math.round(r.e))} | ${fmt(Math.round(r.e / n))} |` : null;
  }).filter(Boolean);
  const allTurns = (t) => Object.values(t.models).reduce((a, n) => a + n, 0);
  const highlights = (t) => `${hours(t.active)} h active · ${t.user} messages from you, ${(t.turns / Math.max(1, t.user)).toFixed(1)} session turns each · helpers made ${Math.round(100 * (allTurns(t) - t.turns) / Math.max(1, allTurns(t)))}% of all turns · ${t.compactions} compaction${t.compactions === 1 ? "" : "s"}`;
  const scopes = [["Project", totals], ...(wfRows.length ? [["Workflow improvement", wfTotals]] : [])];
  const modelNames = [...new Set(scopes.flatMap(([, t]) => Object.keys(t.models)))].sort((a, b) => scopes.reduce((n, [, t]) => n + (t.models[b] || 0), 0) - scopes.reduce((n, [, t]) => n + (t.models[a] || 0), 0));
  const glossary = [
    "### Glossary", "",
    "Token = a small chunk of text (about three-quarters of a word). Turn = one model response. `k` = thousand, `M` = million. Times are UTC.", "",
    "| Column | Meaning |", "|---|---|",
    "| Date (start–end) | Start date and time, then end time (`10-18 15:10` = ended on a later day). |",
    "| Active h | Hours of work: time between consecutive messages, pauses over 15 min left out. |",
    "| Kind | The stareso command that opened the session (`build M5` = started with M5; it may go on to later milestones). `(worktree)` = it ran in its own copy of the repo. |",
    "| Models (turns) | Models that answered in the session itself, with their turn counts. |",
    "| Turns | Responses in the session itself, helpers excluded. |",
    "| You | Messages typed by the user (including slash commands). |",
    "| Compact | Times the context filled up and was summarised (empty = never). |",
    "| Ctx/turn | Average text the model re-reads each turn (conversation, files, tool results) = cache read ÷ turns. |",
    "| Output | Tokens the session wrote (replies, code, commands). |",
    "| Cache read | Tokens re-read from the prompt cache (about a tenth of the normal input price). |",
    "| Cache write | Tokens stored into the cache the first time (Totals only). |",
    "| Helpers | Fresh agents the session started for side tasks: `count (turns per model) · out <their output> · cache <their cache read>`. |",
    "| ≈ equiv | Session and its helpers together; formula at the bottom. |", "",
    "In **Totals**, Turns, Output, Cache read and Cache write cover the sessions only, the Helper columns cover the helpers, and ≈ equiv covers both. **Turns per model** counts sessions and helpers. **Cost per slice** divides a session's ≈ equiv by the `Merge slice …` commits made during it.", "",
  ];
  const block = [
    ...glossary,
    "### Sessions", "", ...header, ...rows.map((r) => r.line),
    ...(wfRows.length ? ["", "### Workflow improvement sessions (reviews of the workflow itself: not in the project totals)", "", ...header, ...wfRows.map((r) => r.line)] : []),
    "", "### Totals", "",
    "| Scope | Sessions | Turns | Output | Cache read | Cache write | Helpers | Helper output | Helper cache read | ≈ equiv |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...scopes.map(([label, t]) => `| ${label} | ${t.sessions} | ${t.turns} | ${fmt(t.out)} | ${fmt(t.cr)} | ${fmt(t.cw)} | ${t.helpers} | ${fmt(t.hOut)} | ${fmt(t.hCr)} | ${fmt(Math.round(t.equiv))} |`),
    "", ...scopes.map(([label, t]) => `**${label}:** ${highlights(t)}.`),
    ...(sliceRows.length ? ["", "**Cost per slice** (sessions that merged slices; the cost of the tests that found the fixes is not included)", "",
      "| Session start | Kind | Slices merged | ≈ equiv | ≈ equiv per slice |", "|---|---|---|---|---|", ...sliceRows] : []),
    "", "**Turns per model** (sessions and their helpers)", "",
    `| Scope | ${modelNames.map(short).join(" | ")} |`, `|---|${modelNames.map(() => "---").join("|")}|`,
    ...scopes.map(([label, t]) => `| ${label} | ${modelNames.map((m) => t.models[m] || "").join(" | ")} |`),
    "", `≈ equiv = cache read × 0.1 + cache write × 1.25 + output × 5 (relative list prices: a comparison unit, not money), session and its helpers together. Forks of a session are counted once. Updated ${new Date().toISOString().slice(0, 16).replace("T", " ")}.`,
  ];
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
if (argv[0] === "--log") await logMode();
else if (argv.length >= 2) await deepMode(argv[0], argv.slice(1));
else { console.error("usage: session-stats.mjs --log   |   session-stats.mjs <out-dir> <transcript.jsonl>…"); process.exit(1); }
