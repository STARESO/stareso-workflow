// Usage report of a stareso project, from its own records only: docs/USAGE.md (written by
// `session-stats --log`), docs/BUILD-LOG.md, the roadmap and the git merges. Never reads transcripts or code.
//
//   node usage-report.mjs            markdown tables on stdout (the 30 most recent milestones)
//   node usage-report.mjs --all      every milestone
//   node usage-report.mjs --json     the same numbers as JSON
//   node usage-report.mjs --charts   ready-made chart series as JSON (share by step type, cumulative cost, cost per slice
//                                    by milestone, context per turn by session, tokens against lines by tier)
//
// Run `session-stats --log` first so USAGE.md is fresh. Numbers only: no paths, no names, no prompts.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { findRoot, milestones } from "./lib/roadmap.mjs";

const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const JSON_OUT = argv.includes("--json");
const CHARTS = argv.includes("--charts");
const MAX_MILESTONES = 30;

const root = findRoot();
const read = (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : "");
const usage = read("docs/USAGE.md");
if (!usage.includes("<!-- usage:start -->")) {
  console.error("docs/USAGE.md has no usage block: run `node ~/.claude/stareso/tools/session-stats.mjs --log` first.");
  process.exit(1);
}

// ---------- number helpers
// "204.4M" / "907k" / "41k" → tokens; "" → null.
function eq(s) {
  const m = /([\d.]+)\s*([kM]?)/.exec(s || "");
  if (!m) return null;
  return Number(m[1]) * (m[2] === "M" ? 1e6 : m[2] === "k" ? 1e3 : 1);
}
// Local dates throughout: toISOString would shift a midnight to the previous UTC day.
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (n) => (n == null || isNaN(n) ? "n/a" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(Math.round(n)));
const pct = (a, b) => (b ? Math.round((100 * a) / b) + " %" : "n/a");
const median = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);

// ---------- markdown tables of USAGE.md: every table, with the heading or bold line above it.
function tables(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let label = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#+ |^\*\*/.test(l)) label = l;
    if (l.startsWith("|") && lines[i + 1]?.startsWith("|---")) {
      const head = l.split("|").slice(1, -1).map((c) => c.trim());
      const rows = [];
      let j = i + 2;
      for (; j < lines.length && lines[j].startsWith("|"); j++) rows.push(lines[j].split("|").slice(1, -1).map((c) => c.trim()));
      out.push({ label, head, rows });
      i = j - 1;
    }
  }
  return out;
}
const T = tables(usage.slice(usage.indexOf("<!-- usage:start -->"), usage.indexOf("<!-- usage:end -->")));
const byHead = (first, col, labelRe) => T.find((t) => t.head[0] === first && t.head.includes(col) && (!labelRe || labelRe.test(t.label)));
const col = (t, name) => t.head.indexOf(name);

// ---------- sessions (project table only; W rows are workflow improvement sessions)
const sessT = T.find((t) => t.head[1] === "Date (start–end)" && t.rows.some((r) => /^\d+$/.test(r[0])));
const sessions = sessT.rows.map((r) => {
  const [d, rest] = r[1].split(" ");
  return { n: Number(r[0]), date: d, start: new Date(`${d}T${rest.slice(0, 5)}`), hours: Number(r[3]), turns: Number(r[5]), you: Number(r[6]) || 0, helpers: Number(r[7]) || 0, equiv: eq(r[8]) };
});
const detT = T.find((t) => t.head[0] === "#" && t.head.includes("Ctx/turn"));
for (const r of detT?.rows || []) {
  const se = sessions.find((x) => String(x.n) === r[0]);
  if (!se) continue;
  se.ctx = eq(r[2]); se.compact = Number(r[1]) || 0; se.output = eq(r[3]);
  const h = /out (\S+) · cache (\S+)/.exec(r[6] || "");
  se.helperEquiv = h ? eq(h[1]) * 5 + eq(h[2]) * 0.1 : 0; // about: helper cache writes are not in the table
  se.conductorEquiv = se.equiv != null ? se.equiv - se.helperEquiv : null;
}
const year = sessions[0]?.date.slice(0, 4) || String(new Date().getFullYear());

// ---------- steps: "10-14 10:29–10-17 17:58" or "10-19 16:27–16:28"
function window(s) {
  const m = /^(\d\d-\d\d) (\d\d:\d\d)–(?:(\d\d-\d\d) )?(\d\d:\d\d)$/.exec(s);
  if (!m) return null;
  const a = new Date(`${year}-${m[1]}T${m[2]}`);
  const b = new Date(`${year}-${m[3] || m[1]}T${m[4]}:59`);
  return { a, b };
}
// Step type: the skill name; typos of a skill ("tesot", "sttus") and free chats become "chat".
const KNOWN = ["init", "retrofit", "discuss", "grill", "setup", "build", "test", "improve", "status", "retro", "deploy", "usage"];
const typeOf = (label) => { const w = label.replace(/\(launched by #\d+\)/, "").trim().split(/[\s:]/)[0]; return KNOWN.includes(w) ? w : "chat"; };
const stepRows = (t) => t.rows.map((r) => ({
  session: r[0], label: r[2], type: typeOf(r[2]), win: window(r[1]), hours: Number(r[3]), turns: Number(r[4]),
  you: Number(r[5]) || 0, equiv: eq(r[7]), carried: r[8] || "",
}));
const stepT = T.filter((t) => t.head[1] === "Start–end" && t.head.includes("Carried"));
const steps = stepRows(stepT[0]);
const workflowSteps = stepT[1] ? stepRows(stepT[1]) : [];

// The workflow starts at the first init or retrofit step (project or workflow-improvement table);
// sessions that started before it are shown but left out of the shares.
// No init or retrofit step logged (a project set up before the logging began): the workflow starts with the first session.
const firstInit = [...steps, ...workflowSteps].filter((s) => ["init", "retrofit"].includes(s.type) && s.win).map((s) => s.win.a).sort((a, b) => a - b)[0]
  || steps.filter((s) => s.win).map((s) => s.win.a).sort((a, b) => a - b)[0] || null;
const initLogged = [...steps, ...workflowSteps].some((s) => ["init", "retrofit"].includes(s.type));
const before = (s) => firstInit && s.win && s.win.a < firstInit;

// ---------- table 1: step types
const types = new Map();
for (const s of steps) {
  const k = before(s) ? "before the workflow" : s.type;
  const t = types.get(k) || { type: k, runs: 0, turns: 0, hours: 0, equiv: 0, carried: [] };
  t.runs++; t.turns += s.turns; t.hours += s.hours; t.equiv += s.equiv || 0;
  const c = /^(\d+) %/.exec(s.carried); if (c) t.carried.push(Number(c[1]));
  types.set(k, t);
}
const workflowTotal = sum([...types.values()].filter((t) => t.type !== "before the workflow").map((t) => t.equiv));
const typeRows = [...types.values()].sort((a, b) => (a.type === "before the workflow") - (b.type === "before the workflow") || b.equiv - a.equiv);

// ---------- BUILD-LOG: one line per slice
const log = read("docs/BUILD-LOG.md").split(/\r?\n/).map((l) => {
  if (!/^- \d{4}-\d\d-\d\d \d\d:\d\d · /.test(l)) return null;
  const p = l.slice(2).split(" · ").map((x) => x.trim());
  const id = p[1].split(" ")[0];
  if (!/^[A-Za-z]+\d*\./.test(id)) return null;
  const tok = /([\d.]+)\s*(k?) tokens/.exec(p[4] || "");
  const tokens = tok ? Number(tok[1]) * (tok[2] ? 1000 : 1) : null;
  const tier = p.find((x) => ["strong", "standard", "light"].includes(x)) || { opus: "strong", sonnet: "standard", haiku: "light" }[p[2]] || "";
  const inline = /inline|built in chat|not shown/.test(l) || (tok && Number(tok[1]) === 0);
  return { id, time: new Date(p[0].replace(" ", "T")), milestone: id.split(".")[0], model: p[2], tier, result: p[3], tokens: tokens || null, inline, profile: p.find((x) => ["eco", "fast", "night", "day"].includes(x)) || "" };
}).filter(Boolean);

// ---------- merges from git, with the lines they changed outside docs/
// Arguments as an array: no shell, so "^" (an escape character in cmd.exe) reaches git intact.
function git(...args) { try { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } }
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
// milestone logged without a merge of their own: they take the BUILD-LOG time, and the first one the branch's lines.
for (const m of merges.filter((x) => !x.id.includes("."))) {
  const own = log.filter((x) => x.milestone === m.id && !merges.some((y) => y.id === x.id));
  if (!own.length) continue;
  own.forEach((x, i) => merges.push({ id: x.id, time: x.time, lines: i ? null : m.lines, fromLog: true }));
  merges.splice(merges.indexOf(m), 1);
}
// A slice with no merge at all (committed straight on main): the BUILD-LOG time stands in, lines unknown.
for (const x of log) if (!merges.some((m) => m.id === x.id)) merges.push({ id: x.id, time: x.time, lines: null, fromLog: true });

// The step that merged a slice: a build step whose window holds the merge, else any non-status step. A slice that
// BUILD-LOG says a helper built came from a build session: with no build step holding it, that session left no
// transcript (unlogged), and no test or chat step is charged for it.
const helperBuilt = new Set(log.filter((x) => !x.inline && x.tokens).map((x) => x.id));
function stepOf(time, id) {
  const holding = steps.filter((s) => s.win && s.win.a <= time && time <= s.win.b && !["status", "retro", "usage"].includes(s.type));
  return holding.find((s) => s.type === "build") || (helperBuilt.has(id) ? null : holding.at(-1)) || null;
}
const mergedBy = new Map();
for (const m of merges) { const s = stepOf(m.time, m.id); m.step = s; if (s) mergedBy.set(s, (mergedBy.get(s) || 0) + 1); }

// ---------- table 3: milestones (≈ equiv per slice from the step that merged it, helpers included)
const ms = milestones(root).filter((m) => m.slices.length);
const msRows = ms.map((m) => {
  const lines = log.filter((x) => x.milestone === m.id);
  const mm = merges.filter((x) => x.id === m.id || x.id.startsWith(m.id + "."));
  const perSlice = mm.map((x) => (x.step && mergedBy.get(x.step) ? x.step.equiv / mergedBy.get(x.step) : null));
  const known = perSlice.filter((x) => x != null);
  const built = !lines.length ? "n/a" : lines.every((x) => x.inline) ? "in chat" : lines.some((x) => x.inline) ? "mixed" : lines.some((x) => x.tokens) ? "helpers" : "not logged";
  const models = ["opus", "sonnet", "haiku"].map((k) => [k[0].toUpperCase(), lines.filter((x) => x.model === k).length]).filter(([, n]) => n).map(([k, n]) => k + n).join(" ");
  return {
    id: m.id, title: m.title, kind: m.kind, slices: m.slices.length, done: m.slices.filter((s) => s.done).length,
    built, models, profile: [...new Set(lines.map((x) => x.profile).filter(Boolean))].join("/"),
    equivPerSlice: known.length ? sum(known) / known.length : null, measured: `${known.length}/${mm.length || m.slices.length}`,
    helperTokens: sum(lines.map((x) => x.tokens)) || null, lines: sum(mm.map((x) => x.lines)) || null,
    fixes: lines.filter((x) => /fix/.test(x.result)).length, tested: !!m.tested,
  };
});
const msShown = ALL ? msRows : msRows.slice(-MAX_MILESTONES);

// ---------- table 4: build steps compared (launched builds and chats that merged slices)
const buildRows = steps.filter((s) => mergedBy.get(s)).map((s) => {
  const se = sessions.find((x) => String(x.n) === s.session);
  // Conductor share: the session's cost minus its helpers', over the session (one step per launched build; a session
  // with several steps shares its helpers across them, so the share is the session's).
  const conductorShare = se?.helperEquiv != null && se.equiv ? (se.equiv - se.helperEquiv) / se.equiv : null;
  return {
    session: s.session, date: s.win ? localDate(s.win.a) : "", type: s.type, merged: mergedBy.get(s), turns: s.turns,
    turnsPerSlice: s.turns / mergedBy.get(s), equiv: s.equiv, equivPerSlice: s.equiv / mergedBy.get(s), conductorShare, helpers: se?.helpers || 0,
  };
});

// ---------- table 5: efficiency per tier (helper tokens per 100 changed lines, and each slice against its tier median)
const sliceEff = log.filter((x) => x.tokens && !x.inline).map((x) => {
  const m = merges.find((y) => y.id === x.id);
  return { ...x, lines: m?.lines || null, per100: m?.lines ? (100 * x.tokens) / m.lines : null };
});
const tierRows = ["light", "standard", "strong"].map((tier) => {
  const xs = sliceEff.filter((x) => x.tier === tier);
  const med = median(xs.map((x) => x.tokens));
  return {
    tier, model: [...new Set(xs.map((x) => x.model))].join("/"), slices: xs.length, medianTokens: med,
    medianLines: median(xs.map((x) => x.lines)), per100: median(xs.map((x) => x.per100)),
    over2x: xs.filter((x) => x.tokens > 2 * med).length, fixes: xs.filter((x) => /fix/.test(x.result)).length,
  };
}).filter((r) => r.slices);

// ---------- table 6: planning rounds (test and improve steps that added slices), named by type, number and date
const planT = byHead("#", "Slices planned");
let tn = 0, imn = 0;
const roundRows = (planT?.rows || []).filter((r) => r[0]).map((r) => {
  const type = typeOf(r[2]);
  const name = type === "test" ? `Test ${++tn}` : type === "improve" ? `Improve ${++imn}` : type;
  const step = steps.find((s) => s.session === r[0] && s.label === r[2]);
  return { name, date: r[1].slice(0, 16), session: r[0], planned: Number(r[3]), equiv: eq(r[4]), perPlanned: eq(r[5]), carried: step?.carried || "" };
});

// ---------- sessions table
const sessRows = sessions.map((s) => ({
  ...s, share: before({ win: { a: s.start } }) ? null : s.equiv / workflowTotal,
}));

const sliceList = log.map((x) => { const m = merges.find((y) => y.id === x.id); const st = m?.step; return { id: x.id, milestone: x.milestone, tier: x.tier, model: x.model, inline: x.inline, tokens: x.tokens, lines: m?.lines ?? null, time: m ? m.time.toISOString().slice(0, 16) : null, equivPerSlice: st && mergedBy.get(st) ? st.equiv / mergedBy.get(st) : null, stepType: st?.type || null, session: st?.session || null }; });
const stepList = steps.map((s) => ({ session: s.session, type: s.type, before: !!before(s), start: s.win ? s.win.a.toISOString().slice(0, 16) : null, hours: s.hours, turns: s.turns, equiv: s.equiv, carried: Number(/^(\d+) %/.exec(s.carried)?.[1]) || null, merged: mergedBy.get(s) || 0 }));
const report = { firstInit, workflowTotal, steps: stepList, slices: sliceList, types: typeRows, sessions: sessRows, milestones: msShown, milestonesHidden: msRows.length - msShown.length, builds: buildRows, tiers: tierRows, rounds: roundRows };

if (JSON_OUT) { console.log(JSON.stringify(report, null, 1)); process.exit(0); }

// ---------- chart series: everything a chart needs, so the report step copies and never reshapes
if (CHARTS) {
  const day0 = new Date((firstInit ? localDate(firstInit) : sessions[0].date) + "T00:00");
  const dayOf = (d) => Math.round(((d - day0) / 864e5) * 100) / 100;
  const dateOfDay = (n) => { const d = new Date(day0); d.setDate(d.getDate() + n); return localDate(d); };
  const group = (t) => (["status", "retro", "usage"].includes(t) ? "status & retro" : ["build", "test", "improve", "chat"].includes(t) ? t : "chat");
  const kinds = ["build", "test", "improve", "chat", "status & retro"];
  const cum = Object.fromEntries(kinds.map((k) => [k, 0]));
  const cumulative = [];
  for (const s of steps.filter((x) => !before(x) && x.win).sort((a, b) => a.win.a - b.win.a)) {
    cum[group(s.type)] += (s.equiv || 0) / 1e6;
    cumulative.push({ day: dayOf(s.win.a), ...Object.fromEntries(kinds.map((k) => [k, Math.round(cum[k] * 100) / 100])) });
  }
  const lastDay = Math.ceil(cumulative.at(-1)?.day || 1);
  const tierMed = Object.fromEntries(tierRows.map((t) => [t.tier, t.medianTokens]));
  const charts = {
    unit: "≈ equiv = cache read × 0.1 + cache write × 1.25 + output × 5 (frozen weights, not money)",
    tiles: (() => {
      const beforeEquiv = sum(steps.filter(before).map((s) => s.equiv));
      const activeHours = sum(steps.filter((s) => !before(s)).map((s) => s.hours));
      return [
        { label: "Workflow cost", value: fmt(workflowTotal) },
        beforeEquiv ? { label: "Before the workflow", value: fmt(beforeEquiv) } : { label: "Active hours", value: activeHours.toFixed(1) + " h" },
        { label: "Slices built", value: String(log.length) },
        { label: "Last build, per slice", value: fmt(buildRows.filter((b) => b.type === "build").at(-1)?.equivPerSlice ?? null) },
      ];
    })(),
    shareByType: typeRows.filter((t) => t.type !== "before the workflow").map((t) => ({ type: t.type, share: Math.round((100 * t.equiv) / workflowTotal), equiv: t.equiv, hours: t.hours, turns: t.turns })),
    cumulative: { kinds, days: Array.from({ length: lastDay + 1 }, (_, i) => ({ day: i, date: dateOfDay(i) })), points: cumulative },
    milestones: msRows.map((m) => ({ id: m.id, built: m.built, equivPerSlice: m.equivPerSlice, measured: m.measured, slices: m.slices })),
    referencePerSlice: { label: "project A M5 (2026-10-20)", equiv: 335e3 },
    conductorVsHelpers: buildRows.map((b) => { const se = sessions.find((x) => String(x.n) === b.session); return { session: b.session, date: b.date, type: b.type, merged: b.merged, conductor: se?.conductorEquiv ?? null, helpers: se?.helperEquiv ?? null, helperCount: b.helpers }; }),
    sessions: sessions.filter((s) => !before({ win: { a: s.start } })).map((s) => ({ n: s.n, date: s.date, ctx: s.ctx ?? null, turns: s.turns, equiv: s.equiv, helpers: s.helpers, over300: s.turns > 300 })),
    slices: sliceEff.filter((x) => x.lines != null).map((x) => ({ id: x.id, tier: x.tier, tokens: x.tokens, lines: x.lines, outlier: x.tokens > 2 * tierMed[x.tier] })),
    tierMedians: tierRows.map((t) => ({ tier: t.tier, model: t.model, tokens: t.medianTokens, lines: t.medianLines, per100: t.per100 })),
  };
  console.log(JSON.stringify(charts));
  process.exit(0);
}

// ---------- markdown
const md = (head, rows) => rows.length ? [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n") : "_none in the log_";
const out = [];
out.push(`≈ equiv = cache read × 0.1 + cache write × 1.25 + output × 5: one number per session that weighs the token kinds by their relative cost (frozen weights, not money). Everything below is in ≈ equiv unless it says "tokens".`);
out.push(`Workflow started ${firstInit ? localDate(firstInit) : "n/a"} (${initLogged ? "first init or retrofit" : "first logged session: no init or retrofit step in the log"}). Shares count only what came after.\n`);

out.push("**1. By type of step**\n");
out.push(md(["Share", "Step type", "Runs", "Active h", "Turns", "≈ equiv", "Median carried"], typeRows.map((t) => [
  t.type === "before the workflow" ? "—" : pct(t.equiv, workflowTotal), t.type, t.runs, t.hours.toFixed(1), t.turns, fmt(t.equiv), t.carried.length ? median(t.carried) + " %" : "",
])));

out.push("\n**2. Sessions**\n");
out.push(md(["Share", "Session", "Date", "Active h", "Turns", "You", "Turns per message", "Helpers", "≈ equiv"], sessRows.map((s) => [
  s.share == null ? "—" : pct(s.equiv, workflowTotal), "#" + s.n, s.date, s.hours.toFixed(1), s.turns, s.you, s.you ? (s.turns / s.you).toFixed(0) : "", s.helpers || "", fmt(s.equiv),
])));

out.push(`\n**3. Milestones** (${msShown.length} most recent${report.milestonesHidden ? `, ${report.milestonesHidden} older hidden: ask for all` : ""}; ≈ equiv per slice = the merging step's ≈ equiv ÷ slices it merged, helpers included, so chat and launched builds compare)\n`);
out.push(md(["Milestone", "Kind", "Slices", "Built by", "Models", "Profile", "≈ equiv per slice", "Measured", "Helper tokens", "Lines changed", "Fix rounds"], msShown.map((m) => [
  m.id, m.kind, `${m.done}/${m.slices}`, m.built, m.models, m.profile, fmt(m.equivPerSlice), m.measured, fmt(m.helperTokens), m.lines ?? "n/a", m.fixes,
])));

const unloggedSlices = merges.filter((m) => !m.step && helperBuilt.has(m.id)).length;
if (unloggedSlices) out.push(`\n${unloggedSlices} helper-built slices have no ≈ equiv per slice: the session that built them left no transcript (archived or deleted before a \`session-stats --log\` kept it; \`usage-seed\` can bring it back from an older USAGE.md). Their helper tokens are in BUILD-LOG and in table 5.`);
out.push("\n**4. Steps that merged slices**\n");
out.push(md(["Session", "Date", "Step type", "Slices", "Turns", "Turns per slice", "≈ equiv", "≈ equiv per slice", "Helpers", "Conductor share"], buildRows.map((b) => [
  b.session, b.date, b.type, b.merged, b.turns, b.turnsPerSlice.toFixed(1), fmt(b.equiv), fmt(b.equivPerSlice), b.helpers || "", b.conductorShare == null ? "n/a" : pct(b.conductorShare, 1),
])));

out.push("\n**5. Efficiency by tier** (helper tokens; tokens per 100 lines changed outside docs/; a slice over 2× its tier median is an outlier)\n");
out.push(md(["Tier", "Model", "Slices", "Median tokens", "Median lines", "Tokens per 100 lines", "Over 2× median", "Fix rounds"], tierRows.map((t) => [
  t.tier, t.model, t.slices, fmt(t.medianTokens), t.medianLines ?? "n/a", fmt(t.per100), t.over2x, t.fixes,
])));

out.push("\n**6. Planning rounds** (test and improve steps that added slices)\n");
out.push(md(["Round", "Started", "Session", "Slices planned", "≈ equiv", "Per planned slice", "Carried"], roundRows.map((r) => [
  r.name, r.date, r.session, r.planned, fmt(r.equiv), fmt(r.perPlanned), r.carried,
])));

console.log(out.join("\n"));
