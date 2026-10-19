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

const PROJECTS = path.join(os.homedir(), ".claude", "projects");

async function summarise(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const s = { id: path.basename(file, ".jsonl"), first: null, last: null, models: {}, tools: {}, user: 0, assistant: 0, agents: 0,
    compactions: 0, kind: null, usage: { input: 0, cache_read: 0, cache_create: 0, output: 0 }, timeline: [] };
  const t = (ts) => (ts || "").slice(5, 16);
  for await (const line of rl) {
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.timestamp) { s.first ??= o.timestamp; s.last = o.timestamp; }
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
  const newTotals = () => ({ sessions: 0, turns: 0, out: 0, cr: 0, cw: 0, helpers: 0, hOut: 0, hCr: 0, hCw: 0, equiv: 0, models: {} });
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
      const line = `| ${s.first.slice(0, 10)} ${s.first.slice(11, 16)}–${end} | ${wf && !/workflow-review/.test(s.kind || "") ? "workflow review" : s.kind || "chat"}${inWorktree ? " (worktree)" : ""} | ${modelsText(s.models) || "—"} | ${s.assistant} | ${fmt(Math.round(s.usage.cache_read / Math.max(1, s.assistant)))} | ${fmt(s.usage.output)} | ${fmt(s.usage.cache_read)} | ${h.n ? `${h.n} (${modelsText(h.models)}) · out ${fmt(h.out)} · cache ${fmt(h.cr)}` : ""} | ${fmt(Math.round(e))} |`;
      (wf ? wfRows : rows).push({ first: s.first, line });
      const t = wf ? wfTotals : totals;
      t.sessions++; t.turns += s.assistant; t.out += s.usage.output; t.cr += s.usage.cache_read; t.cw += s.usage.cache_create;
      t.helpers += h.n; t.hOut += h.out; t.hCr += h.cr; t.hCw += h.cw; t.equiv += e;
      for (const [m, n] of Object.entries(s.models)) t.models[m] = (t.models[m] || 0) + n;
      for (const [m, n] of Object.entries(h.models)) t.models[m] = (t.models[m] || 0) + n;
    }
  }
  rows.sort((a, b) => a.first.localeCompare(b.first));
  wfRows.sort((a, b) => a.first.localeCompare(b.first));

  const header = ["| Date | Session (start–end) | Kind | Models (turns) | Turns | Ctx/turn | Output | Cache read | Helpers | ≈ equiv |", "|---|---|---|---|---|---|---|---|---|---|"];
  const totalsLine = (t, label) => `**${label}:** ${t.sessions} sessions · ${t.turns} turns · output ${fmt(t.out)} · cache read ${fmt(t.cr)} · cache write ${fmt(t.cw)} · helpers ${t.helpers} (output ${fmt(t.hOut)}, cache read ${fmt(t.hCr)}) · models: ${modelsText(t.models) || "—"} · ≈ ${fmt(Math.round(t.equiv))} input-token equivalents`;
  const block = [
    ...header, ...rows.map((r) => r.line), "",
    totalsLine(totals, "Project totals") + ` (cache read 0.1, cache write 1.25, output 5; a comparison unit, not money). Updated ${new Date().toISOString().slice(0, 16).replace("T", " ")}.`,
  ];
  if (wfRows.length) block.push("", "**Workflow improvement sessions** (reviews of the workflow itself: not counted in the project totals)", "", ...header, ...wfRows.map((r) => r.line), "", totalsLine(wfTotals, "Workflow totals") + ".");
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
