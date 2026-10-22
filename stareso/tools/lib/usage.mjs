// Usage of a stareso project from Claude Code transcripts (JSONL under the Claude projects folder), shared by
// session-stats.mjs (writes the sessions dataset, prints the usage tables) and usage-report.mjs (reads the numbers).
//
//   collect(root, { live })   the session entries: from the transcripts (live) plus the records for sessions whose
//                             transcript is gone, or from the records only
//   model(root, entries)      numbered sessions, steps, totals, cost per slice, planning cost: unrounded numbers
//   renderBlock(m)            the old docs/USAGE.md block (markdown tables), for `session-stats --print`
//
// Numbers only: no paths, no names, no prompts.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { execSync } from "node:child_process";
import { GLOBAL_DATA, logLine, readBuilds, readSessions } from "./records.mjs";

export const PROJECTS = path.join(os.homedir(), ".claude", "projects");

export function localIso(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

// Every stareso step of a session, in order ("manager → build M27 → improve"); a repeat of the last one is skipped.
function addKind(s, name, rawArg) {
  const arg = (rawArg || "").trim().split(/\s+/)[0] || "";
  // Keep the argument only when it names a range or a profile (M23, M3.2-M3.6, all, eco, fast), not free text.
  const kind = (name + (/^([A-Za-z]?\d[\w.-]*|all|eco|fast)$/i.test(arg) ? " " + arg : "")).trim();
  if (s.kinds.at(-1) !== kind) s.kinds.push(kind);
  s.kind = s.kinds.join(" → ");
  return kind;
}

// A session that ran status (or a plain chat) and then works as the project's manager (it launches or messages other
// sessions, lists them, or is woken by their reports) is a manager: the status call that opened it joins the manager
// step, and after a plain chat the manager step starts at the request that led to it.
const MANAGER_TOOL = /(^|__)(start_session|send_message|SendMessage|list_sessions|clear_session|stop_session|set_session_model|set_session_permission_mode)$/;
const MANAGED_FROM = /^(status|usage|chat)$/;
// the workflow's steps, past ones included: another `/stareso-…` command (the panel's, a typo) starts no step
const STEPS = /^(init|retrofit|discuss|grill|setup|build|test|improve|status|retro|deploy|usage)$/;

// A status call costs about one turn and has no type of its own in the tables: a status step left alone (no manager
// after it) is shown as chat. A `usage` step (the retired /stareso-usage, now the panel's Usage tab) is manager work in
// a session that manages, chat otherwise. The records keep both kinds, which tell that the step never builds nor
// plans slices.
export const shownKind = (k, managed = false) => (k || "").replace(/\bstatus\b/g, "chat").replace(/\busage\b/g, managed ? "manager" : "chat")
  .split(" → ").filter((x, i, a) => !i || x !== a[i - 1]).join(" → ");

// ---------- gates: the project's verification commands, counted in the build and helper transcripts
// The gates are the rows of the project's Commands table (CLAUDE.md) with these names. A run is recognised by its
// launcher and script ("bash tools/check.sh", "--script res://tools/test_runner.gd"), never by a mention of the
// script, and a gate whose command has an environment word ("NO_WINDOW=1") needs it, so `check` and `check-full`
// stay apart. A command with no script is matched whole ("npm run check").
const GATE_NAMES = /^(check|check-full|test|tests|shot|reach|audit|lint|typecheck)$/;
export function gateKeys(root) {
  let md = "";
  try { md = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"); } catch { return []; }
  const gates = [];
  for (const line of md.split(/\r?\n/)) {
    const row = /^\|\s*`([\w-]+)`\s*\|\s*`([^`]+)`/.exec(line);
    if (!row || !GATE_NAMES.test(row[1])) continue;
    const toks = row[2].replace(/\[[^\]]*\]/g, "").split(/\s+/).filter(Boolean);
    const at = toks.findIndex((t) => /[\\/]/.test(t) && !/\$/.test(t));
    const env = toks.filter((t) => /^[A-Z_]+=\S+$/.test(t));
    if (at < 0) { gates.push({ name: row[1], script: toks.filter((t) => !env.includes(t)).join(" "), launcher: "", env }); continue; }
    const launcher = at > 0 && /^(bash|sh|node|python3?|--script|npx|pwsh)$/.test(toks[at - 1]) ? toks[at - 1] : "";
    gates.push({ name: row[1], script: toks[at].replace(/^res:\/\//, ""), launcher, env });
  }
  return gates;
}
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function gateOf(gates, cmd) {
  const c = ` ${cmd.replace(/\s+/g, " ")} `;
  const hits = gates.filter((g) => (g.launcher ? new RegExp(`${esc(g.launcher)} +(?:res://)?\\S*${esc(g.script)}(?=[\\s"'|;&)]|$)`).test(c) : c.includes(` ${g.script} `))
    && g.env.every((e) => c.includes(e)));
  return hits.sort((a, b) => b.env.length - a.env.length)[0]?.name ?? null;
}
// a failed run: a non-zero exit, or a FAIL summary line (an exit code lost in a pipe to tail)
const FAILED = /^\s*(?:[A-Z]+ )?FAIL(?:ED)?\b/m;
// what failed: the test names, else the gate's stage, else the gate
const failNames = (text, gate) => {
  const tests = [...text.matchAll(/^\s*FAIL:?\s+(test_\w+)/gm)].map((m) => m[1]);
  if (tests.length) return [...new Set(tests)];
  const stages = [...text.matchAll(/^\s*FAIL\s+([\w-]+)\s+\(exit code/gm)].map((m) => `${gate}: ${m[1]}`);
  return stages.length ? [...new Set(stages)] : [gate];
};
const EDITS = /^(Edit|Write|MultiEdit|NotebookEdit)$/;
// a shell command that changes files counts as an edit too (a stale file removed, a sed, a git checkout)
const SHELL_EDIT = /(\bsed -i|\bperl -pi|\bgit (checkout|restore|apply|stash|reset|merge|pull|rebase)\b|(^|[;&|]\s*)(cp|mv|rm|touch|mkdir|tee)\s|[^2&>]>\s*[^&\s>])/;
// a slice id in a helper's launch ("Build M11.7: …", "M3.tidy")
const SLICE_ID = /\b([A-Z]\d*\.(?:\d+[a-z]?|tidy\d*|[a-z]{2,8}\d*))\b/;

// A step no skill names is labelled "chat": no word of the user's messages reaches a record. The first words of the
// request (tags and paths dropped) only tell two such steps apart in memory, as the mark's key.
const chatKey = (txt) => {
  const words = (txt || "").replace(/<[^>]+>[^<]*<\/[^>]+>|<[^>]+>/g, " ").replace(/\S*[\\/]\S*/g, "").trim().split(/\s+/).slice(0, 4).join(" ").slice(0, 32);
  return "chat: " + words;
};

// Splits a session at its step marks (a stareso skill, or a request the app's task list marks as a new task).
// Each step gets its turns, tokens, active time and helpers; `carried` is the context it started with.
function splitSteps(s, helpers, fallback) {
  let marks = [...s.marks].sort((a, b) => a.ts.localeCompare(b.ts));
  // A new-task request that goes straight into a skill is one step, named after the skill.
  marks = marks.filter((m) => !(m.soft && marks.some((n) => !n.soft && n.ts === m.ts)));
  marks = marks.filter((m, i) => i === 0 || (m.key ?? m.kind) !== (marks[i - 1].key ?? marks[i - 1].kind));
  if (!marks.length || s.events.some((e) => e.a && e.ts < marks[0].ts)) marks.unshift({ ts: s.first, kind: (!marks.length && fallback) || (s.launchTs ? "launched" : "chat") });
  const steps = marks.map((m) => ({ kind: m.kind, first: m.ts, last: m.ts, turns: 0, user: 0, active: 0, carried: null,
    usage: { cache_read: 0, cache_create: 0, output: 0 }, hN: 0, hEquiv: 0, models: {} }));
  let i = 0, prev = null;
  for (const ev of s.events) {
    while (i + 1 < steps.length && ev.ts >= steps[i + 1].first) i++;
    const st = steps[i];
    const gap = prev ? new Date(ev.ts) - new Date(prev) : 0;
    if (gap > 0 && gap <= 15 * 60e3) st.active += gap;
    prev = ev.ts; st.last = ev.ts;
    if (ev.u) { st.user++; if (st.kind === "manager") (st.userTs ??= []).push(ev.ts.slice(0, 16)); }
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

export async function summarise(file, gates = []) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const s = { id: path.basename(file, ".jsonl"), first: null, last: null, models: {}, tools: {}, user: 0, assistant: 0, agents: 0,
    compactions: 0, active: 0, kind: null, kinds: [], events: [], marks: [], lastUserTs: null, lastUserText: "", firstText: "", usage: { input: 0, cache_read: 0, cache_create: 0, output: 0 }, byModel: {}, timeline: [],
    launchTs: null, launchText: "", launches: [], gateRuns: [], sliceLaunches: [] };
  const t = (ts) => (ts || "").slice(5, 16);
  // gate runs: the call waits for its result, the run for the turn that reads it (both turns are its cost); a failed
  // gate stays open until an edit, so a rerun with no edit between is a rerun of the same code (a flake when it passes)
  const calls = {}, reading = [], open = {};
  // the status call that opened a manager becomes its manager step; after a plain chat, the manager step starts at the
  // request that led to the first manager action (the user's go), or at the action itself. Nothing is marked when the
  // session is already a manager.
  const manage = (ts) => {
    const cur = s.marks.at(-1);
    if (cur ? !MANAGED_FROM.test(cur.kind) && !cur.conductor : s.launchTs) return;
    if (cur?.kind === "status" || cur?.kind === "usage") {
      s.kinds[s.kinds.lastIndexOf(cur.kind)] = "manager";
      cur.kind = "manager";
      s.kinds = s.kinds.filter((k, i, a) => !i || k !== a[i - 1]);
      s.kind = s.kinds.join(" → ");
      return;
    }
    s.marks.push({ ts: s.lastUserTs && (!cur || s.lastUserTs > cur.ts) ? s.lastUserTs : ts, kind: addKind(s, "manager") });
  };
  // A manager or a plain chat that builds slices itself (it starts a slice builder or merges with slice-done) is a
  // conductor for that stretch: a `build` step, until its next manager action. A launched build is a build already.
  const conduct = (ts) => {
    const cur = s.marks.at(-1);
    if (cur ? !(MANAGED_FROM.test(cur.kind) || cur.kind === "manager") : s.launchTs) return;
    s.marks.push({ ts: s.lastUserTs && (!cur || s.lastUserTs > cur.ts) ? s.lastUserTs : ts, kind: addKind(s, "build"), conductor: true });
  };
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
      // A message the app or another session sent (a manager's launch or relay, a child's status, a helper's hand-back,
      // a task notification, an interrupt mark) is not typed by the user: it is not counted in "You" and names no
      // chat step. The origin says so when the transcript has one, the text's opening otherwise.
      const fromApp = o.origin?.kind ? o.origin.kind !== "human" : o.turnOrigin === "sdk" || o.promptSource === "system";
      // a gate's result: pass or fail, what failed, and whether it reran a failed gate with no edit between
      for (const p of Array.isArray(c) ? c : []) {
        const call = p.type === "tool_result" && calls[p.tool_use_id];
        if (!call) continue;
        delete calls[p.tool_use_id];
        const text = typeof p.content === "string" ? p.content : (p.content || []).map((x) => x.text || "").join("\n");
        const fail = !!p.is_error || FAILED.test(text);
        const run = { ts: o.timestamp, gate: call.gate, fail, cost: call.cost, rerun: false, flake: false, names: fail ? failNames(text, call.gate) : [] };
        const was = open[call.key];
        if (was && !was.edited) {
          run.rerun = true;
          was.reruns.push(run);
          // a pass with no edit since the fail: the fail was a flake, and every rerun of it is its cost
          if (!fail) { run.flake = true; run.names = was.names; for (const r of was.reruns) r.flakeRun = true; }
        }
        if (fail) { if (!was || was.edited) open[call.key] = { names: run.names, edited: false, reruns: [] }; } else delete open[call.key];
        s.gateRuns.push(run);
        reading.push(run);
      }
      for (const txt of texts) {
        // A reminder the app adds to a message is not the user's text either.
        if (/^\s*<system-reminder>[\s\S]*<\/system-reminder>\s*$/.test(txt)) continue;
        if (fromApp || /^\s*(Another Claude session sent a message:|<cross-session-message|<task-notification>|\[Request interrupted by user)/.test(txt)) {
          s.timeline.push(`${t(o.timestamp)} M ${txt.replace(/\s+/g, " ").slice(0, 220)}`);
          s.events.push({ ts: o.timestamp });
          // A step a manager session launched: the app opens the new session with this background message.
          if (!s.launchTs && !s.assistant && /Background \(from the session that started this one\)/.test(txt)) { s.launchTs = o.timestamp; s.launchText = txt; }
          // a session woken by the reports of the sessions it started manages them
          if (/^\s*<side-sessions-event/.test(txt)) manage(o.timestamp);
          continue;
        }
        s.user++; s.timeline.push(`${t(o.timestamp)} U ${txt.replace(/\s+/g, " ").slice(0, 220)}`);
        s.events.push({ ts: o.timestamp, u: 1 });
        s.lastUserTs = o.timestamp; s.lastUserText = txt; s.firstText ||= txt;
        const k = /<command-name>\/stareso(?:-app)?-([\w-]+)<\/command-name>(?:\s*<command-message>[^<]*<\/command-message>)?(?:\s*<command-args>([^<]*)<\/command-args>)?/.exec(txt) || /^\/stareso(?:-app)?-([\w-]+)\s*(\S*)/.exec(txt);
        if (k && STEPS.test(k[1])) s.marks.push({ ts: o.timestamp, kind: addKind(s, k[1], k[2]) });
      }
    } else if (o.type === "assistant") {
      s.assistant++;
      if (m.model && !m.model.startsWith("<")) s.models[m.model] = (s.models[m.model] || 0) + 1;
      s.events.push({ ts: o.timestamp, a: 1, usage: m.usage, model: m.model && !m.model.startsWith("<") ? m.model : null });
      const turnCost = m.usage ? equiv({ cache_read: m.usage.cache_read_input_tokens || 0, cache_create: m.usage.cache_creation_input_tokens || 0, output: m.usage.output_tokens || 0 }) : 0;
      // the turn after a gate's result reads it: part of the gate's cost
      for (const r of reading.splice(0)) r.cost += turnCost;
      if (m.usage) {
        s.usage.input += m.usage.input_tokens || 0;
        s.usage.cache_read += m.usage.cache_read_input_tokens || 0;
        s.usage.cache_create += m.usage.cache_creation_input_tokens || 0;
        s.usage.output += m.usage.output_tokens || 0;
        if (m.model && !m.model.startsWith("<")) addKinds(s.byModel, m.model, { input: m.usage.input_tokens, cache_read: m.usage.cache_read_input_tokens, cache_create: m.usage.cache_creation_input_tokens, output: m.usage.output_tokens });
      }
      for (const p of m.content || []) {
        if (p.type !== "tool_use") continue;
        s.tools[p.name] = (s.tools[p.name] || 0) + 1;
        if (p.name === "Bash" && /slice-done\.mjs/.test(p.input?.command || "")) conduct(o.timestamp);
        if (p.name === "Bash" && gates.length) {
          const gate = gateOf(gates, p.input?.command || "");
          // the same command again (the same test file, scene or gate), its output piped or not, is a rerun
          if (gate) calls[p.id] = { gate, key: (p.input.command || "").split(/\s*(?:\||2?>|&&|;)\s*/).find((x) => gateOf(gates, x))?.trim() || gate, cost: turnCost };
        }
        if (EDITS.test(p.name) || (p.name === "Bash" && !calls[p.id] && SHELL_EDIT.test(p.input?.command || ""))) for (const g of Object.values(open)) g.edited = true;
        if (p.name === "Agent" || p.name === "Task") {
          s.agents++; s.timeline.push(`${t(o.timestamp)} A ${p.input?.subagent_type || "?"} ${(p.input?.description || "").slice(0, 80)}`);
          // a slice builder started for a slice: a second start of the same slice is a rebuild
          // a slice builder, a helper asked to build or fix, or one whose description opens with a slice id ("A1 …",
          // "M3.2 …", the ids of an older plan included)
          const desc = p.input?.description || "";
          const lead = /^([A-Z]\d+[a-z]?(?:\.\w+)?)\s/.exec(desc)?.[1];
          const builder = /slice-builder/.test(p.input?.subagent_type || "") || /^(build|rebuild|fix)\b/i.test(desc);
          const id = (builder && SLICE_ID.exec(`${desc} ${(p.input?.prompt || "").slice(0, 300)}`)?.[1]) || (!/checker|explore|plan/i.test(p.input?.subagent_type || "") && lead);
          if (id) { s.sliceLaunches.push({ ts: o.timestamp, id }); conduct(o.timestamp); }
        }
        if (p.name === "Skill") {
          s.timeline.push(`${t(o.timestamp)} S ${p.input?.skill}`);
          // A step the agent started itself (e.g. improve after a status) counts like a typed command.
          const k = /^stareso(?:-app)?-([\w-]+)$/.exec(p.input?.skill || "");
          if (k && STEPS.test(k[1])) s.marks.push({ ts: s.lastUserTs || s.launchTs || o.timestamp, kind: addKind(s, k[1], p.input?.args) });
        }
        // A launched session often starts its step by reading the skill file instead of calling the skill: its first
        // such read names the step, with the range the launch message gives after the skill's name, if any.
        if (p.name === "Read" && s.launchTs && !s.marks.length) {
          const k = /[\\/]skills[\\/]stareso-([\w-]+)[\\/]SKILL\.md$/i.exec(p.input?.file_path || "");
          if (k) s.marks.push({ ts: s.lastUserTs || s.launchTs, kind: addKind(s, k[1], (new RegExp(`stareso-${k[1]}\\s+(\\S+)`).exec(s.launchText) || [])[1]) });
        }
        if (/start_session$/.test(p.name)) s.launches.push(o.timestamp);
        if (MANAGER_TOOL.test(p.name)) manage(o.timestamp);
        // The app's task list says when a request is unrelated work: a new step, named from the request.
        if (/update_plan$/.test(p.name) && p.input?.scope === "new_task") s.marks.push({ ts: s.lastUserTs || o.timestamp, kind: "chat", key: chatKey(s.lastUserText), soft: true });
      }
    }
  }
  return s;
}

export const hours = (ms) => (ms / 3.6e6).toFixed(1);
export const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));
export const short = (model) => model.replace(/^claude-/, "").replace(/-\d.*$/, "");
export const modelsText = (models) => Object.entries(models).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${short(m)} ${n}`).join(", ");
// ≈ equiv, Claude Code's summary unit: frozen weights between token kinds (cache read 0.1, cache write 1.25,
// output 5), taken once from the standard tier's ratios. Not money, never updated, so old references stay valid.
export const equiv = (u) => u.cache_read * 0.1 + u.cache_create * 1.25 + u.output * 5;
// Tokens per model, kept by kind: kinds and models are never added together (stareso/metrics.md, "Token metrics").
export function addKinds(byModel, model, u) {
  const k = (byModel[model] ??= { input: 0, cache_read: 0, cache_create: 0, output: 0 });
  for (const key of Object.keys(k)) k[key] += u[key] || 0;
}

// The project folder (worktrees log the whole project) and its transcript folders.
export function transcriptDirs(root) {
  const projectRoot = root.replace(/[\\/]\.claude[\\/]worktrees[\\/].*$/, "");
  const slug = projectRoot.replace(/[^A-Za-z0-9]/g, "-");
  const dirs = fs.existsSync(PROJECTS) ? fs.readdirSync(PROJECTS).filter((d) => d === slug || d.startsWith(slug + "--claude-worktrees-")) : [];
  return { slug, dirs };
}

// Sessions spent on the workflow itself (a `/stareso-retro` run, or a worktree named for it) are listed
// apart and left out of the project totals: they are not the project's cost.
const isWorkflowSession = (s, dirName) => /workflow-review|retro/.test(s.kinds?.[0] || "") || /workflow-review|stareso-retro|workflow-improvement/.test(dirName);
const strip = (s) => ({ id: s.id, first: s.first, last: s.last, kind: s.kind, kinds: s.kinds, user: s.user, assistant: s.assistant, active: s.active, compactions: s.compactions, usage: s.usage, models: s.models, byModel: s.byModel, launchTs: s.launchTs, launches: s.launches });

// One session read from its transcript and its helpers' (null when it has no assistant turn).
async function sessionEntry(file, hFiles, d, slug, gates = []) {
  const s = await summarise(file, gates);
  if (!s.assistant) return null;
  const helpers = [];
  for (const hf of hFiles) helpers.push(await summarise(hf, gates));
  const h = helpers.reduce((a, x) => { a.n++; a.out += x.usage.output; a.cr += x.usage.cache_read; a.cw += x.usage.cache_create; a.equiv += equiv(x.usage); for (const [m, n] of Object.entries(x.models)) a.models[m] = (a.models[m] || 0) + n; for (const [m, u] of Object.entries(x.byModel)) addKinds(a.byModel, m, u); return a; }, { n: 0, out: 0, cr: 0, cw: 0, equiv: 0, models: {}, byModel: {} });
  const wf = isWorkflowSession(s, d);
  // A session with no step mark (e.g. a review run in a worktree named for it) keeps the session's label.
  const steps = splitSteps(s, helpers, wf ? "workflow review" : null);
  const gateNames = gateSteps(steps, s, helpers);
  return { id: s.id, s: strip(s), steps, h, inWorktree: d !== slug, wf, ...(gateNames ? { gateNames } : {}) };
}

// The gate runs of a session and its helpers, counted on the step running at the time (numbers only, saved with the
// step), and the names of the flaky tests (kept on the entry, never in the records). A slice started again after a
// gate failed since its last start counts as rebuilt.
function gateSteps(steps, s, helpers) {
  const runs = [...s.gateRuns, ...helpers.flatMap((x) => x.gateRuns)].sort((a, b) => a.ts.localeCompare(b.ts));
  if (!runs.length && !s.sliceLaunches.length) return null;
  const at = (ts) => [...steps].reverse().find((x) => x.first <= ts) || steps[0];
  const g = (st) => (st.gates ??= { runs: 0, fails: 0, reruns: 0, flakes: 0, flakeEquiv: 0, equiv: 0, byGate: {}, relaunched: 0, rebuilt: 0 });
  const names = {};
  for (const r of runs) {
    const x = g(at(r.ts));
    x.runs++; x.equiv += r.cost;
    const by = (x.byGate[r.gate] ??= [0, 0]); by[0]++;
    if (r.fail) { x.fails++; by[1]++; }
    if (r.rerun) x.reruns++;
    if (r.flakeRun) x.flakeEquiv += r.cost;
    if (r.flake) { x.flakes++; for (const n of r.names) names[n] = (names[n] || 0) + 1; }
  }
  const last = {};
  for (const l of s.sliceLaunches) {
    if (last[l.id]) {
      const x = g(at(l.ts));
      x.relaunched++;
      if (runs.some((r) => r.fail && r.ts > last[l.id] && r.ts < l.ts)) x.rebuilt++;
    }
    last[l.id] = l.ts;
  }
  for (const st of steps) if (st.gates) { st.gates.equiv = Math.round(st.gates.equiv); st.gates.flakeEquiv = Math.round(st.gates.flakeEquiv); }
  return Object.keys(names).length ? names : null;
}

// Per-machine cache of the session entries (numbers and step labels only, no prompt), keyed by the transcript files'
// sizes and times, so a live read parses only the transcripts that grew. CACHE_VERSION changes with summarise or
// splitSteps, which drops every old entry. The file is replaced in one rename: two panels may write at once.
const CACHE_VERSION = 12;
const CACHE_FILE = path.join(GLOBAL_DATA, "cache", "sessions.json");
function readCache() {
  let c = null;
  try { c = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch { /* first run */ }
  return { version: CACHE_VERSION, sessions: c?.version === CACHE_VERSION && c.sessions ? c.sessions : {}, seen: new Set() };
}
function writeCache({ version, sessions }) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version, sessions }));
    fs.renameSync(tmp, CACHE_FILE);
  } catch { /* the cache is a convenience */ }
}

// Every session entry of the project: { id, s, steps, h, inWorktree, wf, gone, rescued }. Live: read from the
// transcripts (through the cache), the cache and then the records adding the sessions whose transcript is gone
// (archiving or clearing a session deletes it). `rescued` marks a gone session the records do not hold yet (or hold
// in an older state), which `--log` saves. Not live: the records only (sessions.jsonl).
export async function collect(root, { live = true } = {}) {
  const stored = readSessions(root);
  const out = [];
  const seen = new Set();
  if (live) {
    const { slug, dirs } = transcriptDirs(root);
    const cache = readCache();
    // the project's gates: a change of its Commands table reads the transcripts again
    const gates = gateKeys(root);
    const gateSig = gates.map((x) => `${x.name}=${x.launcher} ${x.script} ${x.env.join(" ")}`).join(",");
    let changed = false;
    for (const d of dirs) {
      const dir = path.join(PROJECTS, d);
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
        const file = path.join(dir, f);
        const hDir = path.join(dir, f.slice(0, -6), "subagents");
        const hFiles = fs.existsSync(hDir) ? fs.readdirSync(hDir).filter((x) => x.endsWith(".jsonl")).sort().map((x) => path.join(hDir, x)) : [];
        // a session is read again only when its transcript or one of its helpers' changed (size or time)
        const key = [file, ...hFiles].map((x) => { const st = fs.statSync(x); return `${path.basename(x)}:${st.size}:${st.mtimeMs}`; }).join("|") + `|${d}|${gateSig}`;
        let entry = cache.sessions[file]?.key === key ? cache.sessions[file].entry : undefined;
        if (entry === undefined) {
          entry = await sessionEntry(file, hFiles, d, slug, gates);
          cache.sessions[file] = { key, entry };
          changed = true;
        }
        cache.seen.add(file);
        if (!entry) continue;
        out.push(entry);
        seen.add(entry.id);
      }
    }
    // A session of this project whose transcript is gone (archived or cleared in the app) keeps its last reading here,
    // so a session that any live read saw (the panel) is never lost before the next `--log` saves it.
    for (const [file, c] of Object.entries(cache.sessions)) {
      // this project's folders by name, even one the app removed with its last transcript
      const folder = path.relative(PROJECTS, file).split(path.sep)[0];
      if (cache.seen.has(file) || !c.entry || !(folder === slug || folder.startsWith(slug + "--claude-worktrees-"))) continue;
      if (!c.gone) { c.gone = new Date().toISOString().slice(0, 10); changed = true; }
      const s = stored[c.entry.id];
      if (seen.has(c.entry.id) || (s?.s && s.s.last >= c.entry.s.last)) continue;
      out.push({ ...c.entry, gone: true, rescued: true });
      seen.add(c.entry.id);
    }
    if (changed) writeCache(cache);
  }
  // without reading the transcripts, a session is gone when its file is (a stat per session, nothing read)
  const { dirs } = live ? { dirs: [] } : transcriptDirs(root);
  const exists = (id) => dirs.some((d) => fs.existsSync(path.join(PROJECTS, d, id + ".jsonl")));
  for (const [id, c] of Object.entries(stored)) if (!seen.has(id) && c.s && c.steps && c.h) out.push({ ...c, id, gone: live || !exists(id) });
  return out;
}

const newTotals = () => ({ sessions: 0, turns: 0, user: 0, active: 0, compactions: 0, out: 0, cr: 0, cw: 0, helpers: 0, hOut: 0, hCr: 0, hCw: 0, equiv: 0, models: {}, byModel: {} });

// Numbered sessions with their steps, totals, cost per slice and planning cost, unrounded.
export function model(root, entries, { costPerSlice = true, planning = true } = {}) {
  const rows = [], wfRows = [];
  for (const c of entries) {
    const r = { ...c, steps: c.steps.map((st) => ({ ...st })), first: c.s.first, turns: c.s.assistant, e: equiv(c.s.usage) + (c.h.equiv || 0) };
    (c.wf ? wfRows : rows).push(r);
  }
  // A forked or continued session shares its start timestamp with the original and repeats its turns:
  // keep the longest transcript per start time, so nothing is counted twice.
  const dedupe = (list) => {
    const byStart = new Map();
    for (const r of list) { const k = r.first; if (!byStart.has(k) || byStart.get(k).turns < r.turns) byStart.set(k, r); }
    return [...byStart.values()].sort((a, b) => a.first.localeCompare(b.first));
  };
  const kept = dedupe(rows), wfKept = dedupe(wfRows);
  const totals = newTotals(), wfTotals = newTotals();
  for (const r of [...kept, ...wfKept]) {
    const t = r.wf ? wfTotals : totals, s = r.s, h = r.h;
    t.sessions++; t.turns += s.assistant; t.user += s.user; t.active += s.active; t.compactions += s.compactions; t.out += s.usage.output; t.cr += s.usage.cache_read; t.cw += s.usage.cache_create;
    t.helpers += h.n; t.hOut += h.out; t.hCr += h.cr; t.hCw += h.cw; t.equiv += r.e;
    for (const [m, n] of Object.entries(s.models)) t.models[m] = (t.models[m] || 0) + n;
    for (const [m, n] of Object.entries(h.models)) t.models[m] = (t.models[m] || 0) + n;
    for (const [m, u] of [...Object.entries(s.byModel), ...Object.entries(h.byModel)]) addKinds(t.byModel, m, u);
  }
  // Short session numbers link the Sessions, Steps and Details tables (W1… for workflow sessions).
  kept.forEach((r, i) => { r.n = String(i + 1); }); wfKept.forEach((r, i) => { r.n = "W" + (i + 1); });
  const all = [...kept, ...wfKept];
  // A launched session names the session that launched it: the one whose start_session call came within
  // 5 min before the launch message (a manager running in another folder is not in this list: no link).
  for (const r of all) {
    if (!r.s.launchTs) continue;
    const t = new Date(r.s.launchTs).getTime();
    r.by = all.find((x) => x !== r && (x.s.launches || []).some((l) => t >= new Date(l).getTime() && t - new Date(l).getTime() <= 5 * 60e3))?.n;
  }
  // Base context: the median context at the first turn of the project's sessions (system prompt, tools, CLAUDE.md,
  // memory). Every new session pays it, so Carried counts only what lies above it.
  const firsts = kept.map((r) => r.steps[0].carried).filter((c) => c != null).sort((a, b) => a - b);
  const base = firsts.length ? firsts[Math.floor((firsts.length - 1) / 2)] : 0;
  // Carried = context at the step's start above the base (what any new session starts with) and its share of the
  // step's cost (extra × turns × 0.1): what a new session would have saved. None for a session's first step.
  for (const r of all) r.steps.forEach((st, i) => {
    st.equiv = equiv(st.usage) + st.hEquiv;
    st.extra = Math.max(0, (st.carried || 0) - base);
    st.carriedPct = i && st.turns ? Math.round(100 * Math.min(1, st.extra * st.turns * 0.1 / Math.max(1, st.equiv))) : null;
    st.label = shownKind(st.kind, r.steps.some((x) => x.kind === "manager")) + (!i && r.by ? ` (launched by #${r.by})` : "");
  });

  const builds = readBuilds(root);
  // Cost per slice: a build session often runs past its first milestone, so count the "Merge slice …" commits
  // (slice-done, every branch) made between the session's start and end, plus 5 min for the last merge.
  let merges = [];
  if (costPerSlice) try {
    const seenHash = new Set();
    merges = execSync("git log --all --merges --format=%H%x09%cI%x09%s", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n")
      .map((l) => l.split("\t")).filter(([h, , subj]) => h && /^Merge slice[ /]/.test(subj || "") && !seenHash.has(h) && seenHash.add(h))
      .map(([, date, subj]) => ({ t: new Date(date).getTime(), id: (/^Merge slice[ /]([A-Za-z]+\d*\.\w+|[A-Za-z]+\d+)/i.exec(subj) || [])[1] || "" }));
  } catch { /* not a git repository: no cost-per-slice table */ }
  // A slice whose build line shows helper tokens was built by a build session: its merge goes to a build step
  // only, never to a test or chat step that happened to be open (that session's transcript is gone: unlogged).
  const helperBuilt = new Set(builds.filter((e) => e.type === "slice" && e.tokens > 0 && !/inline|built in chat|not shown/i.test(logLine(e))).map((e) => e.id));
  // Windows can overlap (one session ends as the next starts, a manager's status runs while the build it launched
  // merges): a merge goes to a build step holding it, else to the latest-started step holding it, never to a status
  // or retro step, which do not build. An improve or test launched during a build only plans slices, so the build wins.
  // A merge only such a step holds was made by a session with no transcript here (deleted, or run in another folder).
  const allSteps = kept.flatMap((r) => r.steps.map((st) => ({ r, st, from: new Date(st.first).getTime(), to: new Date(st.last).getTime() + 5 * 60e3 })));
  const managerKind = (x) => /^(status|manager|retro|workflow)/.test(x.st.kind);
  const buildKind = (x) => /^build/.test(x.st.kind);
  const merged = new Map();
  let unlogged = 0;
  for (const { t: m, id } of merges) {
    const holding = allSteps.filter((x) => m >= x.from && m <= x.to);
    const owner = holding.filter((x) => !managerKind(x) && (!helperBuilt.has(id) || buildKind(x))).sort((a, b) => buildKind(b) - buildKind(a) || b.from - a.from)[0];
    if (!owner) { if (holding.length) unlogged++; continue; }
    merged.set(owner.st, { r: owner.r, n: (merged.get(owner.st)?.n || 0) + 1 });
  }
  const sliceList = [...merged.entries()].sort((a, b) => a[0].first.localeCompare(b[0].first)).map(([st, { r, n }]) => ({ st, r, n, se: st.equiv }));
  // Planning cost per planned slice: the slices an improve or test step added to the roadmap, counted from the
  // `- [ ] **<id> · …` lines its commits added (an id also removed in the same commit is a tick or a move, not new).
  // A commit goes to the latest-started step running then (no build priority here); only improve and test steps keep theirs.
  // A step that never writes slices (status, retro) hands its commit back to the session's last improve or test
  // before it: the test's records are often committed just after the user typed the next command.
  let planCommits = [];
  if (planning) try {
    planCommits = execSync("git log --all --no-merges --format=@@@%x09%H%x09%cI -p --unified=0 -- docs/roadmap roadmap docs/ROADMAP.md ROADMAP.md", { cwd: root, encoding: "utf8", maxBuffer: 256 * 2 ** 20, stdio: ["ignore", "pipe", "ignore"] })
      .split(/^@@@\t/m).slice(1).map((chunk) => {
        const [hash, date] = chunk.slice(0, chunk.indexOf("\n")).split("\t");
        const ids = { "+": new Set(), "-": new Set() };
        for (const l of chunk.split("\n")) { const k = /^([+-])\s*- \[[ xX]\] \*\*([^\s*·]+)/.exec(l); if (k) ids[k[1]].add(k[2]); }
        return { hash, t: new Date(date).getTime(), n: [...ids["+"]].filter((id) => !ids["-"].has(id)).length };
      }).filter((c, i, list) => c.n && list.findIndex((d) => d.hash === c.hash) === i);
  } catch { /* not a git repository: no planning table */ }
  const planned = new Map();
  for (const c of planCommits) {
    let owner = allSteps.filter((x) => c.t >= x.from && c.t <= x.to).sort((a, b) => b.from - a.from)[0];
    if (owner && managerKind(owner)) owner = allSteps.filter((x) => x.r === owner.r && x.from < owner.from).at(-1);
    if (!owner || !/^(improve|test)\b/.test(owner.st.kind)) continue;
    planned.set(owner.st, { r: owner.r, n: (planned.get(owner.st)?.n || 0) + c.n });
  }
  const planList = [...planned.entries()].sort((a, b) => a[0].first.localeCompare(b[0].first)).map(([st, { r, n }]) => ({ st, r, n, se: st.equiv }));
  // Conductor-built slices: build lines whose helper tokens are 0 or missing, or that say "built in chat"
  // (the conductor did the work itself); human slices (done by the user) are left out.
  const byDay = {};
  for (const e of builds) if (e.type === "slice" && e.conductor) byDay[e.t.slice(0, 10)] = (byDay[e.t.slice(0, 10)] || 0) + 1;
  return { rows: kept, wfRows: wfKept, base, totals, wfTotals, sliceList, unlogged, planList, byDay, conductorBuilt: Object.values(byDay).reduce((a, n) => a + n, 0) };
}

// The usage tables, as docs/USAGE.md held them before the datasets (`session-stats --print`).
export function renderBlock(m) {
  const { rows, wfRows, base, totals, wfTotals, sliceList, unlogged, planList, byDay, conductorBuilt } = m;
  const endOf = (first, last) => (last.slice(0, 10) === first.slice(0, 10) ? last.slice(11, 16) : last.slice(0, 16).replace("T", " "));
  const kindOf = (r) => (r.wf && !/workflow-review|stareso-retro/.test(r.s.kind || "") ? "workflow review" : shownKind(r.s.kind, r.steps.some((x) => x.kind === "manager")) || "chat") + (r.inWorktree ? " (worktree)" : "") + (r.gone ? " (transcript gone)" : "");
  const session = (r) => `| ${r.n} | ${r.s.first.slice(0, 10)} ${r.s.first.slice(11, 16)}–${endOf(r.s.first, r.s.last)} | ${kindOf(r)}${r.by ? ` (launched by #${r.by})` : ""} | ${hours(r.steps.reduce((a, st) => a + st.active, 0))} | ${modelsText(r.s.models) || "—"} | ${r.s.assistant} | ${r.s.user} | ${r.h.n || ""} | ${fmt(Math.round(r.e))} |`;
  const details = (r) => `| ${r.n} | ${r.s.compactions || ""} | ${fmt(Math.round(r.s.usage.cache_read / Math.max(1, r.s.assistant)))} | ${fmt(r.s.usage.output)} | ${fmt(r.s.usage.cache_read)} | ${fmt(r.s.usage.cache_create)} | ${r.h.n ? `${modelsText(r.h.models)} · out ${fmt(r.h.out)} · cache ${fmt(r.h.cr)}` : ""} |`;
  const stepLines = (r) => r.steps.map((st) => `| ${r.n} | ${st.first.slice(0, 10)} ${st.first.slice(11, 16)}–${endOf(st.first, st.last)} | ${st.label} | ${hours(st.active)} | ${st.turns} | ${st.user} | ${st.hN || ""} | ${fmt(Math.round(st.equiv))} | ${st.carriedPct != null ? `${st.carriedPct} % · ${fmt(st.extra)}` : ""} |`);
  const tables = (list) => [
    "| # | Date (start–end) | Steps | Active h | Models (turns) | Turns | You | Helpers | ≈ equiv |", "|---|---|---|---|---|---|---|---|---|",
    ...list.map(session), "",
    "| # | Start–end | Step | Active h | Turns | You | Helpers | ≈ equiv | Carried |", "|---|---|---|---|---|---|---|---|---|",
    ...list.flatMap(stepLines),
  ];
  const sliceRows = sliceList.map(({ st, r, n, se }) => `| ${r.n} | ${st.first.slice(0, 10)} ${st.first.slice(11, 16)} | ${st.kind} | ${n} | ${fmt(Math.round(se))} | ${fmt(Math.round(se / n))} |`);
  const planRows = planList.map(({ st, r, n, se }) => `| ${r.n} | ${st.first.slice(0, 10)} ${st.first.slice(11, 16)} | ${st.kind} | ${n} | ${fmt(Math.round(se))} | ${fmt(Math.round(se / n))} |`);
  if (planList.length > 1) {
    const [n, se] = planList.reduce(([a, b], x) => [a + x.n, b + x.se], [0, 0]);
    planRows.push(`| | | **All** | ${n} | ${fmt(Math.round(se))} | ${fmt(Math.round(se / n))} |`);
  }
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
    "| Steps | The stareso steps of the session in order (`chat → build M27 → improve`; `build M5` = started with M5, it may go on to later milestones). `chat` = work no skill names, or a request the task list marked as new (never words of the request). `manager` = a session that launches, messages or lists other sessions, or is woken by their reports, from the status call that opened it (or the request that led to it). A status call (or a usage read) left alone is a few turns of `chat`. A manager or chat that starts slice builders or merges slices itself is `build` (a conductor) for that stretch. `launched` = a session another session started, before its step began. `(launched by #10)` = session 10 started it (a manager). `(worktree)` = it ran in its own copy of the repo. `(transcript gone)` = the transcript was deleted after the session was logged: its numbers come from the sessions records, written at every `--log`. |",
    "| Step rows | One per step, split at the step's first message; helpers go to the step that started them. The session's totals are the sum of its steps. |",
    `| Carried | For a session's later steps: share of the step's cost spent re-reading the context it started with above the base (${fmt(base)}, the median context at the first turn of this project's sessions, which every new session pays), then that extra context's size. High = a new session would have been cheaper (target < 20 %). |`,
    "| Active h | Hours of work: time between consecutive messages, pauses over 15 min left out. |",
    "| Models (turns) | Models that answered in the session itself, with their turn counts. |",
    "| Turns | Responses in the session itself, helpers excluded. |",
    "| You | Messages typed by the user (including slash commands), not those a manager session or the app sent. |",
    "| Helpers | Fresh agents started for side tasks (their models and tokens are in Details). |",
    "| ≈ equiv | Session (or step) and its helpers together; formula at the bottom. |",
    "| Compact | (Details) Times the context filled up and was summarised (empty = never). |",
    "| Ctx/turn | (Details) Average text the model re-reads each turn (conversation, files, tool results) = cache read ÷ turns. |",
    "| Output | (Details) Tokens the session wrote (replies, code, commands). |",
    "| Cache read / write | (Details) Tokens re-read from the prompt cache (weight 0.1 in ≈ equiv) / stored into it the first time. |", "",
    "In **Totals**, Turns, Output, Cache read and Cache write cover the sessions only, the Helper columns cover the helpers, and ≈ equiv covers both. **Turns per model** counts sessions and helpers. **Cost per slice** divides the ≈ equiv of the step that merged slices (usually the build, its helpers included) by the `Merge slice …` commits made during it (never a status or retro step: a manager does not build). **Planning cost** divides the ≈ equiv of an improve or test step by the slices its commits added to the roadmap (target < 300k per slice). **Conductor-built slices** counts build lines with `0 tokens`, `tokens not shown` or `built in chat`, human slices left out (target 0).", "",
  ];
  return [
    "### Sessions and steps", "", ...tables(rows),
    ...(wfRows.length ? ["", "### Workflow improvement sessions (reviews of the workflow itself: not in the project totals)", "", ...tables(wfRows)] : []),
    "", "### Totals", "",
    "| Scope | Sessions | Turns | Output | Cache read | Cache write | Helpers | Helper output | Helper cache read | ≈ equiv |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...scopes.map(([label, t]) => `| ${label} | ${t.sessions} | ${t.turns} | ${fmt(t.out)} | ${fmt(t.cr)} | ${fmt(t.cw)} | ${t.helpers} | ${fmt(t.hOut)} | ${fmt(t.hCr)} | ${fmt(Math.round(t.equiv))} |`),
    "", ...scopes.map(([label, t]) => `**${label}:** ${highlights(t)}.`),
    ...(sliceRows.length ? ["", "**Cost per slice** (steps that merged slices; the cost of the tests that found the fixes is not included)", "",
      "| # | Step start | Step | Slices merged | ≈ equiv | ≈ equiv per slice |", "|---|---|---|---|---|---|", ...sliceRows] : []),
    ...(unlogged ? ["", `**Slices merged by an unlogged session:** ${unlogged} (no build step was running then, or only a status or retro step: the session that built them left no transcript in this project, so their cost is only in the BUILD-LOG helper tokens).`] : []),
    ...(planRows.length ? ["", "**Planning cost per planned slice** (improve and test steps that added slices to the roadmap)", "",
      "| # | Step start | Step | Slices planned | ≈ equiv | ≈ equiv per planned slice |", "|---|---|---|---|---|---|", ...planRows] : []),
    "", `**Conductor-built slices:** ${conductorBuilt}${conductorBuilt ? ` (${Object.entries(byDay).sort().map(([d, n]) => `${d} ${n}`).join(" · ")})` : ""}.`,
    "", "**Turns per model** (sessions and their helpers)", "",
    `| Scope | ${modelNames.map(short).join(" | ")} |`, `|---|${modelNames.map(() => "---").join("|")}|`,
    ...scopes.map(([label, t]) => `| ${label} | ${modelNames.map((x) => t.models[x] || "").join(" | ")} |`),
    "", "**Tokens per model** (sessions and their helpers, by kind: never add kinds or models together)", "",
    "| Scope | Model | Input | Cache read | Cache write | Output |", "|---|---|---|---|---|---|",
    ...scopes.flatMap(([label, t]) => modelNames.filter((x) => t.byModel[x]).map((x) => { const u = t.byModel[x]; return `| ${label} | ${short(x)} | ${fmt(u.input)} | ${fmt(u.cache_read)} | ${fmt(u.cache_create)} | ${fmt(u.output)} |`; })),
    "", "### Details (per session, for retros)", "",
    "| # | Compact | Ctx/turn | Output | Cache read | Cache write | Helpers (models · output · cache read) |", "|---|---|---|---|---|---|---|",
    ...[...rows, ...wfRows].map(details),
    "", ...glossary,
    "", `≈ equiv = cache read × 0.1 + cache write × 1.25 + output × 5, frozen weights between token kinds (a fixed exchange rate taken once from the standard tier's ratios, not money: they never follow prices), session and its helpers together. Forks of a session are counted once. Updated ${localIso(new Date()).slice(0, 16).replace("T", " ")}.`,
  ];
}

// The helpers that built one slice, measured from their own transcripts: every builder helper of the project whose
// first message names the slice's branch (`branch slice/M7.3-…`; `slice/M7.tidy2` is not `slice/M7.tidy`). `context` is
// the last turn's context, the figure a helper reports as its tokens; the kinds and ≈ equiv are what it consumed.
// null when no transcript names the slice (built in chat, or the transcript is gone).
export async function helperUsage(root, id) {
  const { dirs } = transcriptDirs(root);
  const branch = new RegExp(`slice/${id.split(".").join("[.]")}(?=[^\\w.]|$)`);
  const files = [];
  for (const d of dirs) {
    const dir = path.join(PROJECTS, d);
    for (const sess of fs.readdirSync(dir, { withFileTypes: true }).filter((x) => x.isDirectory())) {
      const hDir = path.join(dir, sess.name, "subagents");
      if (!fs.existsSync(hDir)) continue;
      for (const f of fs.readdirSync(hDir).filter((x) => x.endsWith(".jsonl"))) {
        const file = path.join(hDir, f);
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, ".meta.json"), "utf8")); } catch { /* older transcripts have no meta */ }
        if (meta.agentType && !/builder/.test(meta.agentType)) continue;
        // the first message only (the brief): a sibling slice named later in the transcript is not this helper's
        const fd = fs.openSync(file, "r"), b = Buffer.alloc(8192), n = fs.readSync(fd, b, 0, b.length, 0);
        fs.closeSync(fd);
        if (branch.test(b.toString("utf8", 0, n).split("\n")[0])) files.push(file);
      }
    }
  }
  if (!files.length) return null;
  const u = { helpers: files.length, models: {}, turns: 0, input: 0, output: 0, cache_read: 0, cache_create: 0, context: 0, minutes: 0 };
  for (const file of files) {
    const s = await summarise(file);
    for (const [m, n] of Object.entries(s.models)) u.models[short(m)] = (u.models[short(m)] || 0) + n;
    u.turns += s.assistant; u.input += s.usage.input; u.output += s.usage.output; u.cache_read += s.usage.cache_read; u.cache_create += s.usage.cache_create;
    const last = s.events.filter((e) => e.a && e.usage).at(-1)?.usage || {};
    u.context = Math.max(u.context, (last.input_tokens || 0) + (last.cache_read_input_tokens || 0) + (last.cache_creation_input_tokens || 0) + (last.output_tokens || 0));
    u.minutes += Math.round(s.active / 60e3);
  }
  u.equiv = Math.round(equiv(u));
  return u;
}
