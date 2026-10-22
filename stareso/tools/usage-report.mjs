// Usage report of a stareso project, from its own records only: docs/data/sessions.jsonl (written by
// `session-stats --log`), docs/data/builds.jsonl (slice-done), the roadmap and the git merges. Never reads transcripts
// or code. A project not migrated yet (no docs/data/) is read from docs/USAGE.md and docs/BUILD-LOG.md as before.
//
//   node usage-report.mjs            markdown tables on stdout (the 30 most recent milestones)
//   node usage-report.mjs --all      every milestone (and every build with --builds)
//   node usage-report.mjs --json     the same numbers as compact JSON (one line, for the skills)
//   node usage-report.mjs --summary  one JSON line: workflow cost, sessions, slices, last build per slice, last retro
//   node usage-report.mjs --builds   the build records as log lines (`--since yyyy-mm-dd`, `--json` for the events)
//   node usage-report.mjs --projects the cross-project index (~/.claude/stareso/data/projects.jsonl), one row per project
//   node usage-report.mjs --charts   ready-made chart series as JSON (share by step type, cumulative cost, cost per slice
//                                    by milestone, context per turn by session, tokens against lines by tier)
//   node usage-report.mjs --panel    the chart series and the markdown tables (with the recent builds) in one JSON line,
//                                    for the status panel and the dashboard
//   --live                           reads the sessions from the transcripts as they are now (plus the records for the
//                                    sessions whose transcript is gone), so they are current and nothing is written
//
// Without --live, the report adds this project's summary to the cross-project index when it changed (outside the
// project). Run `session-stats --log` first so the records are fresh (or pass --live). Numbers only: no names, no prompts.
import fs from "node:fs";
import path from "node:path";
import { args, findRoot, milestones } from "./lib/roadmap.mjs";
import { collect, model } from "./lib/usage.mjs";
import { appendJsonl, logLine, mergesFromGit, mergesFromRecords, migrated, projectsFile, readBuilds, readProjects, SEED_REFERENCE } from "./lib/records.mjs";

const argv = process.argv.slice(2);
const opt = args(argv);
const ALL = argv.includes("--all");
const JSON_OUT = argv.includes("--json");
const CHARTS = argv.includes("--charts");
const PANEL = argv.includes("--panel");
const LIVE = argv.includes("--live");
const MAX_MILESTONES = 30, MAX_BUILDS = 30;

const root = findRoot(opt.root ? path.resolve(opt.root) : process.cwd());
const read = (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : "");
const MIGRATED = migrated(root);
const builds = readBuilds(root);
const lastRetro = () => { const m = [...(read("docs/RETROS.md") + "\n" + read("docs/USAGE.md")).matchAll(/^### Retro (\d{4}-\d\d-\d\d)[^\n]*/gm)].at(-1); return m ? m[0].replace(/^### /, "") : null; };

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
// Step type: the skill name; typos of a skill ("tesot", "sttus") and free chats become "chat".
const KNOWN = ["init", "retrofit", "discuss", "grill", "setup", "build", "test", "improve", "status", "retro", "deploy", "usage"];
const typeOf = (label) => { const w = label.replace(/\(launched by #\d+\)/, "").trim().split(/[\s:]/)[0]; return KNOWN.includes(w) ? w : "chat"; };

// ---------- the build records as log lines (no session numbers needed: no transcript, no git)
if (argv.includes("--builds")) {
  const since = typeof opt.since === "string" ? opt.since : "";
  let list = builds.filter((e) => e.type !== "merge" && (!since || (e.t || "") >= since));
  if (!ALL && !since) list = list.slice(-MAX_BUILDS);
  console.log(JSON_OUT ? JSON.stringify(list) : list.map(logLine).join("\n"));
  process.exit(0);
}

// ---------- the cross-project index
if (argv.includes("--projects")) {
  const latest = new Map();
  for (const p of readProjects()) latest.set(p.reference ? "reference:" + p.label : p.root, p);
  const rows = [...latest.values()];
  if (JSON_OUT) { console.log(JSON.stringify(rows)); process.exit(0); }
  console.log(["| Project | Updated | Workflow cost | Sessions | Slices | Launched build, median per slice | Milestones measured |", "|---|---|---|---|---|---|---|",
    ...rows.map((p) => p.reference ? `| ${p.label} (reference) | ${p.t} | | | | ${fmt(p.equiv)} | |` : `| ${p.name} | ${p.t} | ${fmt(p.workflowEquiv)} | ${p.sessions} | ${p.slices} | ${fmt(p.launchedPerSlice)} | ${p.milestones?.length ?? 0} |`)].join("\n"));
  process.exit(0);
}

// ---------- sessions and steps: from the records (or the transcripts with --live), else from the old USAGE.md tables
let sessions, steps, workflowSteps, planRows;
const SUMMARY = argv.includes("--summary");
if (LIVE || MIGRATED) {
  const m = model(root, await collect(root, { live: LIVE }), { costPerSlice: false, planning: !SUMMARY });
  const minute = (iso) => new Date(iso.slice(0, 16));
  const stepsOf = (r) => r.steps.map((st) => ({
    session: r.n, label: st.label, type: typeOf(st.label), win: { a: minute(st.first), b: new Date(st.last.slice(0, 16) + ":59") },
    hours: st.active / 3.6e6, turns: st.turns, you: st.user || 0, equiv: st.equiv, carried: st.carriedPct != null ? `${st.carriedPct} %` : "",
  }));
  sessions = m.rows.map((r) => ({
    n: Number(r.n), date: r.s.first.slice(0, 10), start: minute(r.s.first), hours: sum(r.steps.map((st) => st.active)) / 3.6e6, turns: r.s.assistant, you: r.s.user || 0,
    helpers: r.h.n || 0, equiv: r.e, ctx: r.s.usage.cache_read / Math.max(1, r.s.assistant), compact: r.s.compactions || 0, output: r.s.usage.output,
    helperEquiv: r.h.equiv || 0, conductorEquiv: r.e - (r.h.equiv || 0),
  }));
  steps = m.rows.flatMap(stepsOf);
  workflowSteps = m.wfRows.flatMap(stepsOf);
  planRows = m.planList.map(({ st, r, n, se }) => [r.n, `${st.first.slice(0, 10)} ${st.first.slice(11, 16)}`, st.kind, n, se, se / n]);
} else {
  const usage = read("docs/USAGE.md");
  if (!usage.includes("<!-- usage:start -->")) {
    console.error("No usage records: run `node ~/.claude/stareso/tools/session-stats.mjs --log` first (or pass --live).");
    process.exit(1);
  }
  ({ sessions, steps, workflowSteps, planRows } = fromUsageMd(usage));
}

// The old docs/USAGE.md: every markdown table with the heading or bold line above it, numbers as printed (rounded).
function fromUsageMd(usage) {
  const lines = usage.slice(usage.indexOf("<!-- usage:start -->"), usage.indexOf("<!-- usage:end -->")).split(/\r?\n/);
  const T = [];
  let label = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#+ |^\*\*/.test(l)) label = l;
    if (l.startsWith("|") && lines[i + 1]?.startsWith("|---")) {
      const head = l.split("|").slice(1, -1).map((c) => c.trim());
      const rows = [];
      let j = i + 2;
      for (; j < lines.length && lines[j].startsWith("|"); j++) rows.push(lines[j].split("|").slice(1, -1).map((c) => c.trim()));
      T.push({ label, head, rows });
      i = j - 1;
    }
  }
  // sessions (project table only; W rows are workflow improvement sessions)
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
  // steps: "10-14 10:29–10-17 17:58" or "10-19 16:27–16:28"
  const window = (s) => {
    const m = /^(\d\d-\d\d) (\d\d:\d\d)–(?:(\d\d-\d\d) )?(\d\d:\d\d)$/.exec(s);
    return m ? { a: new Date(`${year}-${m[1]}T${m[2]}`), b: new Date(`${year}-${m[3] || m[1]}T${m[4]}:59`) } : null;
  };
  const stepRows = (t) => t.rows.map((r) => ({
    session: r[0], label: r[2], type: typeOf(r[2]), win: window(r[1]), hours: Number(r[3]), turns: Number(r[4]),
    you: Number(r[5]) || 0, equiv: eq(r[7]), carried: r[8] || "",
  }));
  const stepT = T.filter((t) => t.head[1] === "Start–end" && t.head.includes("Carried"));
  const planT = T.find((t) => t.head[0] === "#" && t.head.includes("Slices planned"));
  return {
    sessions, steps: stepRows(stepT[0]), workflowSteps: stepT[1] ? stepRows(stepT[1]) : [],
    planRows: (planT?.rows || []).filter((r) => r[0]).map((r) => [r[0], r[1].slice(0, 16), r[2], Number(r[3]), eq(r[4]), eq(r[5])]),
  };
}
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


// ---------- build records: one event per slice
const log = builds.filter((e) => e.type === "slice").map((e) => ({
  id: e.id, title: e.title, time: new Date(e.t.replace(" ", "T")), milestone: e.id.split(".")[0], model: e.model, tier: e.tier, result: e.result,
  tokens: e.tokens || null, inline: e.inline, profile: e.profile || "", note: e.note || "",
}));

// ---------- merges, with the lines they changed outside docs/: kept in the build records, else from git (one diff per merge)
const merges = MIGRATED ? mergesFromRecords(builds) : mergesFromGit(root, log);

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
let tn = 0, imn = 0;
const roundRows = planRows.map((r) => {
  const type = typeOf(r[2]);
  const name = type === "test" ? `Test ${++tn}` : type === "improve" ? `Improve ${++imn}` : type;
  const step = steps.find((s) => s.session === r[0] && s.label === r[2]);
  return { name, date: r[1], session: r[0], planned: r[3], equiv: r[4], perPlanned: r[5], carried: step?.carried || "" };
});

// ---------- sessions table
const sessRows = sessions.map((s) => ({
  ...s, share: before({ win: { a: s.start } }) ? null : s.equiv / workflowTotal,
}));

const sliceList = log.map((x) => { const m = merges.find((y) => y.id === x.id); const st = m?.step; return { id: x.id, milestone: x.milestone, tier: x.tier, model: x.model, inline: x.inline, tokens: x.tokens, lines: m?.lines ?? null, time: m ? m.time.toISOString().slice(0, 16) : null, equivPerSlice: st && mergedBy.get(st) ? st.equiv / mergedBy.get(st) : null, stepType: st?.type || null, session: st?.session || null }; });
const stepList = steps.map((s) => ({ session: s.session, type: s.type, before: !!before(s), start: s.win ? s.win.a.toISOString().slice(0, 16) : null, hours: s.hours, turns: s.turns, equiv: s.equiv, carried: Number(/^(\d+) %/.exec(s.carried)?.[1]) || null, merged: mergedBy.get(s) || 0 }));
const report = { firstInit, workflowTotal, steps: stepList, slices: sliceList, types: typeRows, sessions: sessRows, milestones: msShown, milestonesHidden: msRows.length - msShown.length, builds: buildRows, tiers: tierRows, rounds: roundRows };


// ---------- this project in the cross-project index (records only: --live numbers move every minute)
const reference = readProjects().filter((p) => p.reference).at(-1) || SEED_REFERENCE;
if (!LIVE) {
  const entry = {
    root, name: path.basename(root), workflowEquiv: Math.round(workflowTotal), sessions: sessions.length, slices: log.length,
    launchedPerSlice: Math.round(median(buildRows.filter((b) => b.type === "build").map((b) => b.equivPerSlice)) || 0) || null,
    milestones: msRows.filter((m) => m.equivPerSlice != null).map((m) => ({ id: m.id, built: m.built, equivPerSlice: Math.round(m.equivPerSlice) })),
  };
  const known = readProjects();
  const last = known.filter((p) => p.root === root).at(-1);
  const same = last && JSON.stringify({ ...last, t: 0 }) === JSON.stringify({ t: 0, ...entry });
  try { if (!same) appendJsonl(projectsFile(), [...(fs.existsSync(projectsFile()) ? [] : [SEED_REFERENCE]), { t: localDate(new Date()), ...entry }]); } catch { /* the index is a convenience */ }
}

if (SUMMARY) {
  console.log(JSON.stringify({
    workflowCost: Math.round(workflowTotal), before: Math.round(sum(steps.filter(before).map((s) => s.equiv))) || 0, sessions: sessions.length,
    activeHours: +sum(steps.filter((s) => !before(s)).map((s) => s.hours)).toFixed(1), slices: log.length,
    lastBuildPerSlice: Math.round(buildRows.filter((b) => b.type === "build").at(-1)?.equivPerSlice || 0) || null,
    conductorBuilt: builds.filter((e) => e.type === "slice" && e.conductor).length, lastRetro: lastRetro(), records: MIGRATED ? "datasets" : "USAGE.md",
  }));
  process.exit(0);
}
if (JSON_OUT) { console.log(JSON.stringify(report)); process.exit(0); }

// ---------- chart series: everything a chart needs, so the report step copies and never reshapes
let charts = null;
if (CHARTS || PANEL) {
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
  charts = {
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
    referencePerSlice: { label: reference.label, equiv: reference.equiv },
    conductorVsHelpers: buildRows.map((b) => { const se = sessions.find((x) => String(x.n) === b.session); return { session: b.session, date: b.date, type: b.type, merged: b.merged, conductor: se?.conductorEquiv ?? null, helpers: se?.helperEquiv ?? null, helperCount: b.helpers }; }),
    sessions: sessions.filter((s) => !before({ win: { a: s.start } })).map((s) => ({ n: s.n, date: s.date, ctx: s.ctx ?? null, turns: s.turns, equiv: s.equiv, helpers: s.helpers, over300: s.turns > 300 })),
    slices: sliceEff.filter((x) => x.lines != null).map((x) => ({ id: x.id, tier: x.tier, tokens: x.tokens, lines: x.lines, outlier: x.tokens > 2 * tierMed[x.tier] })),
    tierMedians: tierRows.map((t) => ({ tier: t.tier, model: t.model, tokens: t.medianTokens, lines: t.medianLines, per100: t.per100 })),
  };
  if (CHARTS) { console.log(JSON.stringify(charts)); process.exit(0); }
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

// the panel takes the chart series and the tables from one run, with the recent builds (the build log is frozen in
// migrated projects: this table is where it is read now)
if (PANEL) {
  const shown = ALL ? log : log.slice(-MAX_BUILDS);
  out.push(`\n**7. Builds** (${shown.length === log.length ? "every slice" : `the ${shown.length} most recent of ${log.length}`}, newest first; lines changed outside docs/)\n`);
  out.push(md(["Merged", "Slice", "Title", "Model", "Tier", "Result", "Helper tokens", "Lines", "Profile", "Note"], [...shown].reverse().map((x) => {
    const m = merges.find((y) => y.id === x.id);
    return [localDate(x.time) + " " + x.time.toTimeString().slice(0, 5), x.id, x.title, x.model, x.tier, x.result, x.inline ? "in chat" : fmt(x.tokens), m?.lines ?? "n/a", x.profile, x.note.replace(/\|/g, "/")];
  })));
  console.log(JSON.stringify({ charts, tables: out.join("\n") }));
}
else console.log(out.join("\n"));
