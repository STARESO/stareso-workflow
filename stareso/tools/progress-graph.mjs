// Progress graph of a stareso project, from the records only (never code, never writes in the project).
// Reads docs/roadmap/*.md (slice lines, `after:`, [human]), docs/ROADMAP.md, docs/QUESTIONS.md, the build records,
// `git worktree list` (branches slice/<id>-…, the running helpers) and the newest `Merge slice` commits.
//
// Usage:  node ~/.claude/stareso/tools/progress-graph.mjs [--root <project>] [--max-lanes 8]
//           (no other flag)  compact JSON: lanes, nodes, edges, running, ready, human, questions, pace, text lines
//         --write [dir]      also writes progress.svg (standalone, light and dark, with a tooltip on every node) and
//                            progress.html (a page that wraps it), for a harness with no panel; the default folder is
//                            the system temp folder, never the project. Paths come back in `files`.
//         --brief            the brief in sections: head, progress, helpers, usage, pace, waits, could start
//         --five <pct>@<reset>  --week <pct>@<reset>   the usage windows the host shows (percent used, ISO reset time):
//                            kept in ~/.claude/stareso/data/plan-windows.jsonl (per machine) to work out the burn rate
//         --caps <start>/<pause>/<weekly>   stop caps in percent, when the build records hold no caps event
//         --panel            for the stareso-status panel: the brief, every lane and slice (state, deps, ETA, helper),
//                            and the alert data, as one JSON line (pass --max-lanes 99 for every open lane)
//         --status           the answer of /stareso-status: 3 to 6 short lines, the rule table applied, the next step
//                            (`--models opus/sonnet/haiku` names the tiers; nothing written but the plan readings)
//         `lines` holds the one-line status items ready to print: running, usage, pace, waits, ready.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { args, findRoot, milestones, stamp } from "./lib/roadmap.mjs";
import { appendJsonl, planWindowsFile, readBuilds, readJsonlTail } from "./lib/records.mjs";

const opt = args(process.argv.slice(2));

// ---------- --status: the answer of /stareso-status, a few lines with the step that comes next ----------
// The tiers come as names from the harness (`--models opus/sonnet/haiku`, strong/standard/light), else as tier words.
const tierName = (() => { const [strong, standard, light] = String(opt.models || "").split("/"); return { strong: strong || "strong tier", standard: standard || "standard tier", light: light || "light tier" }; })();
const next = (cmd, tier, ...more) => `\`${cmd}\` (${[tierName[tier], ...more].join(", ")})`;
// Before a roadmap exists (no project, discussion, grilling, setup), PLAN.md alone gives the answer.
if (opt.status) {
  const start = opt.root ? path.resolve(opt.root) : process.cwd();
  let dir = start, plan = null;
  for (;;) {
    if (fs.existsSync(path.join(dir, "docs", "ROADMAP.md"))) break;
    if (fs.existsSync(path.join(dir, "docs", "PLAN.md"))) { plan = dir; break; }
    const up = path.dirname(dir);
    if (up === dir) { dir = null; break; }
    dir = up;
  }
  if (!dir) {
    const empty = fs.readdirSync(start).filter((f) => !f.startsWith(".")).length === 0;
    console.log(`${path.basename(start)} · not a stareso project\n▶ ${next(empty ? "/stareso-init <name>" : "/stareso-retrofit", "strong", "new session")}`);
    process.exit(0);
  }
  if (plan) {
    const phase = (/^Phase: (\S+)/m.exec(fs.readFileSync(path.join(plan, "docs", "PLAN.md"), "utf8")) || [])[1] || "?";
    const step = { discussion: ["discussing", `${next("/stareso-discuss", "strong")}, then "let's grill"`], grilling: ["grilling", `go on with ${next("/stareso-grill", "strong")}`] }[phase]
      || ["plan done, no roadmap", next("/stareso-setup", "strong", "new session")];
    console.log(`${path.basename(plan)} · ${step[0]}\n▶ ${step[1]}`);
    process.exit(0);
  }
}

const root = opt.root ? findRoot(path.resolve(opt.root)) : findRoot();
const maxLanes = Number(opt["max-lanes"]) || 8;

const git = (...a) => { try { return execFileSync("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
const read = (rel) => { try { return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };
const now = Date.now();
const p2 = (n) => String(n).padStart(2, "0");
// "17:05", with "tomorrow" or the date when it is not today
const clock = (t) => { const d = new Date(t), n = new Date(now); const day = d.toDateString() === n.toDateString() ? "" : d.getTime() - now < 36 * 3600e3 ? " tomorrow" : ` ${d.getMonth() + 1}/${d.getDate()}`; return `${p2(d.getHours())}:${p2(d.getMinutes())}${day}`; };
const hours = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${+h.toFixed(1)} h`);

// ---------- records ----------
const ms = milestones(root).filter((m) => m.slices.length > 0);
const lettered = (m) => !/^M\d+$/.test(m.id);
const numOf = (id) => Number(id.replace(/\D/g, "")) || 0;
const afterOf = (s) => (((/after: ([A-Za-z0-9., ]+?)(?: ·|$)/.exec(s.rest) || [])[1]) || "").split(/[ ,]+/).filter((x) => /^[A-Za-z]+\d*\.\w+$/.test(x));
const opusOf = (s) => /(?:model: opus|tier: strong)/.test(s.rest);
const modelOf = (s) => (/(?:model|tier): (\w+)/.exec(s.rest) || [])[1] || "";
const byId = new Map(ms.flatMap((m) => m.slices.map((s) => [s.id, { ...s, ms: m.id, after: afterOf(s), opus: opusOf(s), model: modelOf(s) }])));

// running helpers: worktrees (or the main folder) on a branch slice/<id>-…
const running = [];
let cur = {};
for (const line of (git("worktree", "list", "--porcelain") + "\n").split("\n")) {
  if (line.startsWith("worktree ")) cur = { path: line.slice(9) };
  else if (line.startsWith("branch ")) {
    const m = /^refs\/heads\/slice\/([A-Za-z]+\d*\.\w+)(?:-|$)/.exec(line.slice(7));
    if (m && byId.has(m[1])) {
      let minutes = null;
      try { const b = fs.statSync(cur.path); minutes = Math.max(0, Math.round((now - (b.birthtimeMs || b.ctimeMs)) / 60000)); } catch { /* folder gone */ }
      running.push({ id: m[1], branch: line.slice(18), path: cur.path, minutes });
    }
  }
}
const runningIds = new Set(running.filter((r) => !byId.get(r.id).done).map((r) => r.id));

const recent = git("log", "-n", "6", "--grep=^Merge slice", "--format=%cI\t%s").split("\n").filter(Boolean).map((l) => {
  const [at, subject] = l.split("\t");
  return { id: (/^Merge slice ([A-Za-z]+\d*\.\w+)/.exec(subject) || [])[1], at: at.slice(0, 16).replace("T", " ") };
}).filter((r) => r.id);

// open questions (not debt): what blocks which slices
const questions = read("docs/QUESTIONS.md").split("\n").filter((l) => /^- \[ \]/.test(l) && !/\[debt\]/.test(l)).map((l) => {
  const blocks = ((/blocks: ([^*]*?)(?: \*\*|$)/.exec(l) || [])[1] || "").split(/[ ,]+/).filter((x) => /^[A-Za-z]+\d*\.\w+$/.test(x));
  return { text: l.replace(/^- \[ \]\s*(\([^)]*\)\s*)?/, "").replace(/\s*· blocks:.*$/, "").slice(0, 90), blocks };
});
const blockedByQuestion = new Set(questions.flatMap((q) => q.blocks));

// ---------- lanes ----------
const stateOf = (s) => (s.done ? "d" : runningIds.has(s.id) ? "r" : "w");
const shortId = (id) => { const [a, b] = id.split("."); return /^\d+$/.test(b) ? `${a.replace(/^M/, "")}.${b}` : b; };
const laneOf = (m) => {
  const done = m.slices.filter((s) => s.done).length;
  const run = m.slices.filter((s) => runningIds.has(s.id)).length;
  const human = m.slices.filter((s) => !s.done && s.human).length;
  return { id: m.id, title: m.title, kind: m.kind, done, total: m.slices.length, running: run, human, block: lettered(m),
    nodes: m.slices.map((s) => ({ id: s.id, short: shortId(s.id), s: stateOf(s), ...(s.human && !s.done ? { h: 1 } : {}), ...(byId.get(s.id).opus ? { o: 1 } : {}) })) };
};
const all = ms.map(laneOf);
const finished = all.filter((l) => l.done === l.total);
const open = all.filter((l) => l.done < l.total);
const priority = (l) => (l.running || l.done ? 0 : 1) + (l.block ? 2 : 0);
const shown = [...open].sort((a, b) => priority(a) - priority(b) || numOf(a.id) - numOf(b.id)).slice(0, maxLanes)
  .sort((a, b) => Number(a.block) - Number(b.block) || numOf(a.id) - numOf(b.id) || a.id.localeCompare(b.id));
const hidden = open.filter((l) => !shown.includes(l)).map((l) => l.id);

// "M1 to M5, M8, M9, M10, H": runs of four or more numbered milestones are shortened
function banner(lanes) {
  const nums = lanes.filter((l) => !l.block).map((l) => numOf(l.id)).sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < nums.length;) {
    let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    if (j - i >= 3) parts.push(`M${nums[i]} to M${nums[j]}`); else for (let k = i; k <= j; k++) parts.push(`M${nums[k]}`);
    i = j + 1;
  }
  parts.push(...lanes.filter((l) => l.block).map((l) => l.id));
  return parts.length ? `${parts.join(", ")} · every slice done` : "";
}
const bannerText = banner(finished);

// edges: a slice waits on another one of the same lane
const edges = [];
for (const l of shown) if (!l.block) for (const n of l.nodes) for (const a of byId.get(n.id).after) if (l.nodes.some((x) => x.id === a)) edges.push([a, n.id]);

// ---------- what could start, what waits for the user ----------
const isDone = (id) => !byId.has(id) || byId.get(id).done;
const openNumbered = [...byId.values()].filter((s) => !s.done && /^M\d+$/.test(s.ms));
// only numbered milestones (a lettered one is for the user, or a queue that only a night run takes); a tidy slice waits for the rest of its milestone
const ready = openNumbered.filter((s) => !s.human && !runningIds.has(s.id) && !blockedByQuestion.has(s.id) && !/waits on \/stareso/.test(s.rest)
  && s.after.every(isDone) && (!/\.tidy$/.test(s.id) || ms.find((m) => m.id === s.ms).slices.every((x) => x.done || x.id === s.id))).map((s) => s.id);
const humanSlices = [...byId.values()].filter((s) => !s.done && s.human).map((s) => s.id);

// ---------- pace, from the merge times of the build records ----------
const builds = readBuilds(root);
const merges = builds.filter((e) => e.type === "slice" && e.result === "ok" && e.t.length > 10)
  .map((e) => ({ id: e.id, profile: e.profile || e.harness, t: new Date(e.t.replace(" ", "T") + ":00").getTime() })).sort((a, b) => a.t - b.t);
// gaps over 90 min (a night, a pause) are left out; gaps between two serial merges (eco, day) are the time one slice takes
const pairs = merges.slice(1).map((m, i) => [merges[i], m]);
const gapsOf = (pred) => pairs.filter(([a, b]) => pred(a) && pred(b)).map(([a, b]) => (b.t - a.t) / 60000).filter((g) => g > 0 && g <= 90).slice(-20);
const gaps = gapsOf(() => true);
const serialGaps = gapsOf((m) => /^(eco|day)$/.test(m.profile));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const med = median(gaps);
const remaining = openNumbered.filter((s) => !s.human).length;
// longest chain of still open slices (a chain cannot be parallelised)
const depth = new Map();
const chain = (id) => {
  if (depth.has(id)) return depth.get(id);
  depth.set(id, 1);
  const s = byId.get(id);
  // a tidy slice waits for every other slice of its milestone
  const deps = [...s.after, ...(/\.tidy$/.test(id) ? ms.find((m) => m.id === s.ms).slices.filter((x) => x.id !== id).map((x) => x.id) : [])];
  const d = 1 + Math.max(0, ...deps.filter((a) => byId.has(a) && !byId.get(a).done && /^M\d+$/.test(byId.get(a).ms)).map(chain));
  depth.set(id, d); return d;
};
const longest = Math.max(0, ...openNumbered.map((s) => chain(s.id)));
// With the time of one slice, the helpers running now share the slices, but the longest chain stays serial: the ETA is the
// larger of the two. Without serial merges, the recent gap already holds the parallelism of that run, so it is not divided.
const perSlice = serialGaps.length >= 3 ? median(serialGaps) : null;
const helpers = Math.max(1, runningIds.size);

// ---------- ETA learning: what the predictions missed, and the factor that corrects the next ones ----------
// When a helper is first seen running, its predicted merge time is kept (one line per slice run, in this machine's
// stareso/data/eta/<project>.jsonl, never in the project). Once the slice merges, actual ÷ predicted duration is one
// sample; the median of the last 20 (at least 4) scales the time of one slice, clamped to 0.5–3. Each prediction keeps
// the factor it used, so the samples measure the raw estimate and the factor does not compound.
const etaFile = path.join(path.dirname(planWindowsFile()), "eta", `${path.basename(root).replace(/[^\w.-]+/g, "_")}.jsonl`);
const etaRecords = readJsonlTail(etaFile, 64e3).filter((x) => x && x.id && x.start && x.predEnd);
const mergedAt = new Map();
for (const e of builds) if (e.type === "slice") {
  const at = Date.parse(e.merge?.at || (e.t ? e.t.replace(" ", "T") + ":00" : ""));
  if (!isNaN(at)) (mergedAt.get(e.id) || mergedAt.set(e.id, []).get(e.id)).push(at);
}
const etaSamples = etaRecords.map((x) => {
  const actual = (mergedAt.get(x.id) || []).find((at) => at >= x.start - 60e3);
  const predMin = (x.predEnd - x.start) / 60000, actMin = actual ? (actual - x.start) / 60000 : null;
  return actual && predMin >= 3 && actMin > 0 ? { id: x.id, at: actual, predicted: Math.round(predMin), actual: Math.round(actMin), raw: (actMin / predMin) * (x.factor || 1) } : null;
}).filter(Boolean).sort((a, b) => a.at - b.at);
const recentSamples = etaSamples.slice(-20);
const etaFactor = recentSamples.length >= 4 ? Math.min(3, Math.max(0.5, median(recentSamples.map((x) => x.raw)))) : 1;
const etaTrack = {
  factor: +etaFactor.toFixed(2), samples: etaSamples.length,
  medianMissPct: etaSamples.length ? Math.round(median(etaSamples.slice(-20).map((x) => ((x.actual - x.predicted) / x.predicted) * 100))) : null,
  rows: etaSamples.slice(-12).map(({ id, predicted, actual, at }) => ({ id, predicted, actual, at: clock(at) })),
};
const unit = (perSlice ?? med) == null ? null : (perSlice ?? med) * etaFactor;
let pace = null;
if (unit != null) {
  const rowH = remaining * unit / 60, chainH = longest * unit / 60, shareH = perSlice != null ? remaining * unit / helpers / 60 : rowH;
  const etaH = Math.max(chainH, shareH), binds = chainH >= shareH ? "chain" : "slices";
  pace = {
    medianMinutes: med == null ? null : Math.round(med), perSliceMinutes: perSlice == null ? null : Math.round(perSlice), samples: gaps.length,
    lastMerge: merges.length ? stamp(new Date(merges.at(-1).t)) : null, remaining, helpers, longestChain: longest,
    etaHours: +etaH.toFixed(1), binds, inARowHours: +rowH.toFixed(1), chainFloorHours: +chainH.toFixed(1),
  };
  pace.line = remaining === 0 ? null : perSlice != null && helpers > 1
    ? `${Math.round(unit)} min per slice, so about ${hours(etaH)} for ${remaining} slices with ${helpers} helpers (${binds === "chain" ? `the longest chain, ${longest} slices, binds` : "the slice count binds"}), at most ${hours(rowH)} in a row`
    : `${Math.round(unit)} min per ${perSlice != null ? "slice" : "merged slice lately"}, about ${hours(etaH)} for ${remaining} slices (the longest chain, ${longest} slices, needs ${hours(chainH)} on its own)`;
}

// ---------- build mode: the profile of the newest logged merge (eco, fast, night, day), the helpers running now, the pack's profiles ----------
const pack = (/^Pack: (\S+)/m.exec(read("docs/PLAN.md")) || [])[1] || "";
const packFile = (f) => { try { return fs.readFileSync(path.join(fileURLToPath(new URL("..", import.meta.url)), "packs", pack, f), "utf8"); } catch { return ""; } };
const packDoc = pack ? packFile("README.md") + packFile("guide.md") : "";
const lastProfile = merges.map((m) => m.profile).filter((p) => /^(eco|fast|night|day)$/.test(p)).at(-1) || null;
const nightPack = /night runs?|stareso-build.*night|`night`/i.test(packDoc);
const mode = { pack, last: lastProfile, helpers: runningIds.size, available: ["eco", "fast", ...(nightPack ? ["night", "day"] : [])] };
mode.label = runningIds.size ? `${lastProfile || (runningIds.size > 1 ? "fast" : "eco")} · ${runningIds.size} helper${runningIds.size > 1 ? "s" : ""}` : lastProfile ? `idle · last run ${lastProfile}` : "idle";

// ---------- ETA per slice and per milestone: a small simulation of the rest of the build ----------
// Every open slice of a numbered milestone takes `unit` minutes. A running one has `unit` minus its minutes left (at least 5).
// The helpers running now (or the profile's usual count when idle) take the slices in roadmap order as soon as their
// `after:` slices are merged, and a tidy slice waits for the rest of its milestone. A slice that waits on the user
// (a [human] slice, a blocking question, an open slice of a lettered milestone) gets no ETA, nor what waits on it.
// Not modelled: shared files in fast, pauses for the usage caps, the checker at the end of a milestone.
const simHelpers = runningIds.size || ({ eco: 1, day: 1, fast: 3, night: 3 }[lastProfile] || 1);
const eta = { helpers: simHelpers, minutesPerSlice: unit == null ? null : Math.round(unit), bySlice: {}, byMilestone: {}, allDone: null };
if (unit != null) {
  const depsOf = (s) => [...s.after, ...(/\.tidy$/.test(s.id) ? ms.find((m) => m.id === s.ms).slices.filter((x) => x.id !== s.id).map((x) => x.id) : [])].filter((d) => byId.has(d) && !byId.get(d).done);
  const waitMemo = new Map();
  const waitsOnUser = (id) => {
    if (waitMemo.has(id)) return waitMemo.get(id);
    waitMemo.set(id, false);
    const s = byId.get(id);
    const w = !/^M\d+$/.test(s.ms) || s.human || blockedByQuestion.has(id) || /waits on \/stareso/.test(s.rest) || depsOf(s).some(waitsOnUser);
    waitMemo.set(id, w); return w;
  };
  const order = shown.filter((l) => !l.block).flatMap((l) => l.nodes.map((n) => n.id)).concat(openNumbered.map((s) => s.id));
  const pending = [...new Set(order)].filter((id) => !byId.get(id).done && !runningIds.has(id) && !waitsOnUser(id));
  const finish = new Map();
  let active = running.filter((r) => runningIds.has(r.id) && !waitsOnUser(r.id)).map((r) => ({ id: r.id, end: Math.max(5, unit - (r.minutes ?? 0)) }));
  let t = 0;
  const merged = (d, at) => byId.get(d).done || (finish.has(d) && finish.get(d) <= at);
  for (let guard = 0; guard < 2000 && (pending.length || active.length); guard++) {
    for (let i = 0; i < pending.length && active.length < simHelpers;) {
      const s = byId.get(pending[i]);
      if (depsOf(s).every((d) => merged(d, t))) { active.push({ id: s.id, end: t + unit }); pending.splice(i, 1); } else i++;
    }
    if (!active.length) break;
    active.sort((a, b) => a.end - b.end);
    t = active[0].end;
    for (const a of active.filter((x) => x.end === t)) finish.set(a.id, t);
    active = active.filter((x) => x.end !== t);
  }
  for (const [id, m] of finish) eta.bySlice[id] = clock(now + m * 60000);
  // a running slice seen for the first time: its prediction is kept, to be compared with its merge
  const fresh = running.filter((r) => runningIds.has(r.id) && finish.has(r.id)).map((r) => {
    const start = r.minutes != null && r.minutes < 12 * 60 ? now - r.minutes * 60000 : now;
    return { t: stamp(), id: r.id, start, predEnd: now + finish.get(r.id) * 60000, unit: Math.round(unit), factor: +etaFactor.toFixed(2), helpers: simHelpers, profile: lastProfile };
  }).filter((x) => !etaRecords.some((y) => y.id === x.id && Math.abs(y.start - x.start) < 30 * 60000));
  try { if (fresh.length) appendJsonl(etaFile, fresh); } catch { /* the learning is a convenience */ }
  for (const l of shown.filter((x) => !x.block)) {
    const open = l.nodes.filter((n) => n.s !== "d").map((n) => n.id);
    const times = open.filter((id) => finish.has(id)).map((id) => finish.get(id));
    const waiting = open.filter((id) => !finish.has(id)).length;
    eta.byMilestone[l.id] = { at: times.length ? clock(now + Math.max(...times) * 60000) : null, waiting };
  }
  if (finish.size) { const end = Math.max(...finish.values()); eta.allDone = clock(now + end * 60000); eta.allDoneHours = +(end / 60).toFixed(1); }
}
const etaLane = (id) => { const e = eta.byMilestone[id]; return !e ? "" : e.at ? `≈ ${e.at}${e.waiting ? `, ${e.waiting} wait on you` : ""}` : e.waiting ? "waits on you" : ""; };

// ---------- usage windows: readings of the plan's windows, burn rate, stop caps ----------
const outDir = typeof opt.write === "string" ? path.resolve(opt.write) : path.join(os.tmpdir(), `stareso-progress-${path.basename(root)}`);
if (outDir.toLowerCase().startsWith(root.toLowerCase() + path.sep)) { console.error("Refusing to write inside the project."); process.exit(1); }
// The readings live in ~/.claude/stareso/data/plan-windows.jsonl (the plan is the account's, so one file per machine for
// every project): one line { t, w, pct, reset } when the percent or the window changes, or 10 min after the window's
// last line, so the history stays small and its newest line recent. The rate uses the window's last three hours.
const readings = { five: [], week: [] };
for (const x of readJsonlTail(planWindowsFile(), 64e3)) if (readings[x.w] && x.t > now - 3 * 3600e3) readings[x.w].push({ t: x.t, pct: x.pct, reset: x.reset });
const fresh = [];
for (const k of ["five", "week"]) {
  const m = /^(\d+(?:\.\d+)?)@(.+)$/.exec(String(opt[k] || ""));
  const latest = m && !isNaN(Date.parse(m[2])) ? { t: now, pct: Number(m[1]), reset: Date.parse(m[2]) } : null;
  const ref = latest || readings[k].at(-1);
  // same window (same reset time) only
  const same = ref ? readings[k].filter((x) => Math.abs(x.reset - ref.reset) < 600e3) : [];
  if (latest) {
    const last = same.at(-1);
    if (!last || last.pct !== latest.pct || now - last.t >= 600e3) fresh.push({ t: now, w: k, pct: latest.pct, reset: latest.reset });
    readings[k] = [...same.filter((x) => now - x.t > 30e3), latest].slice(-8);
  } else readings[k] = same.slice(-8);
}
try { appendJsonl(planWindowsFile(), fresh); } catch { /* the readings are a convenience */ }

// stop caps: --caps, else the newest caps event of the build records (record.mjs caps), 36 h at most
let caps = null;
const capEvent = builds.filter((e) => e.type === "caps" && e.t.length > 10).at(-1);
if (opt.caps) {
  const [start, pause, weekly] = String(opt.caps).split("/").map((x) => Number(x) || null);
  caps = { start, pause, weekly, deadline: null, source: "given" };
} else if (capEvent && now - new Date(capEvent.t.replace(" ", "T") + ":00").getTime() < 36 * 3600e3) {
  caps = { start: capEvent.start, pause: capEvent.pause, weekly: capEvent.weekly, deadline: capEvent.deadline, source: `build records ${capEvent.t}` };
}

// rate from the oldest reading of the window (at least 10 min back), else the average since the window opened
function windowOf(k, span, capList) {
  const list = readings[k], last = list.at(-1);
  if (!last || last.t < now - 3600e3) return null;
  let rate = null, basis = null;
  if (list.length > 1 && last.t - list[0].t >= 600e3) { rate = Math.max(0, (last.pct - list[0].pct) / ((last.t - list[0].t) / 3600e3)); basis = "last readings"; }
  else { const elapsed = (span - (last.reset - now)) / 3600e3; if (elapsed > 0.1) { rate = last.pct / elapsed; basis = "window average"; } }
  const reach = capList.filter(([, c]) => c).map(([name, c]) => {
    if (last.pct >= c) return { name, cap: c, at: "reached" };
    const t = rate > 0 ? now + (c - last.pct) / rate * 3600e3 : Infinity;
    return { name, cap: c, at: t < last.reset ? clock(t) : null, t };
  });
  return { pct: last.pct, resets: clock(last.reset), ratePerHour: rate == null ? null : +rate.toFixed(1), basis, reach };
}
const usage = {
  five: windowOf("five", 5 * 3600e3, [["helper-start", caps?.start], ["pause", caps?.pause]]),
  week: windowOf("week", 7 * 24 * 3600e3, [["weekly", caps?.weekly]]),
  caps,
};
const reachText = (w) => w.reach.map((r) => `${r.name} cap ${r.cap} % ${r.at === "reached" ? "reached" : r.at ? `at about ${r.at}` : "not before the reset"}`);
const usageParts = [];
if (usage.five) usageParts.push([`5-hour ${usage.five.pct} %${usage.five.ratePerHour != null ? ` (+${usage.five.ratePerHour} %/h, ${usage.five.basis})` : ""}`, ...reachText(usage.five), `resets ${usage.five.resets}`].join(", "));
if (usage.week) usageParts.push([`weekly ${usage.week.pct} %`, ...reachText(usage.week), `resets ${usage.week.resets}`].join(", "));
if (!usageParts.length && caps) usageParts.push(`caps ${[caps.start && `helper start ${caps.start} %`, caps.pause && `pause ${caps.pause} %`, caps.weekly && `weekly ${caps.weekly} %`].filter(Boolean).join(", ")}, no usage reading`);
if (caps?.deadline) usageParts.push(`deadline ${caps.deadline}`);

// ---------- the one-line status items ----------
const blocking = questions.filter((q) => q.blocks.some((b) => byId.has(b) && !byId.get(b).done));
const runningNow = running.filter((r) => runningIds.has(r.id));
const lines = {
  running: runningNow.length ? `${mode.label}: ${runningNow.map((r) => `${r.id}${r.minutes != null ? ` ${r.minutes} min` : ""}`).join(", ")}` : `no helper running (${mode.label})`,
  usage: usageParts.length ? usageParts.join(" · ") : null,
  pace: pace?.line ?? null,
  waits: humanSlices.length || questions.length ? `${humanSlices.length} slice${humanSlices.length === 1 ? "" : "s"} for you${humanSlices.length ? ` (${humanSlices.slice(0, 6).join(", ")}${humanSlices.length > 6 ? ", …" : ""})` : ""}, ${questions.length} open question${questions.length === 1 ? "" : "s"}, ${blocking.length} blocking a slice` : null,
  ready: ready.length ? `${ready.length} could start now with no helper: ${ready.slice(0, 6).join(", ")}${ready.length > 6 ? ", …" : ""}` : remaining ? "none could start now: every open slice waits on a chain, a helper or the user" : null,
};

// ---------- head line: phase, pack, branch and tree, ideas, debt ----------
const plan = read("docs/PLAN.md");
const phase = (/^Phase: (.+)$/m.exec(plan) || [])[1] || "?";
const branch = git("branch", "--show-current").trim() || "detached";
const changed = git("status", "--porcelain", "--untracked-files=no").split("\n").filter(Boolean).length;
const ideas = (read("docs/IDEAS.md").match(/💭/g) || []).length;
const debt = read("docs/QUESTIONS.md").split("\n").filter((l) => /^- \[ \] \[debt\]/.test(l)).length;
const head = [path.basename(root), `Phase: ${phase}`, pack && `Pack: ${pack}`, `${branch}, ${changed ? `${changed} changed` : "clean"}`,
  ideas && `${ideas} 💭 ideas`, debt && `${debt} debt`, /\(open:/.test(plan) && "PLAN has open points"].filter(Boolean).join(" · ");

// ---------- text fallback ----------
const mark = { d: "■", r: "▶", w: "□" };
const text = [`mode: ${mode.label} (profiles of this pack: ${mode.available.join(", ")})`];
if (bannerText) text.push(bannerText);
// the open questions are counted on the first lane that waits on the user (H)
const qLane = shown.find((l) => l.block && l.human);
const qText = questions.length ? `${questions.length} questions, ${blocking.length} blocking` : "";
for (const l of shown) text.push(`${l.id.padEnd(3)} ${String(l.done).padStart(2)}/${l.total}  ${l.block ? `block${l.human ? `, ${l.human} for you` : ""}${l.running ? ", running" : ""}${l === qLane && qText ? ` · ${qText}` : ""}` : l.nodes.map((n) => mark[n.s]).join("")}`);
if (hidden.length) text.push(`+ ${hidden.length} more open: ${hidden.join(", ")}`);
text.push("■ done  ▶ a helper is running  □ waiting");

// ---------- SVG ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const NW = 34, NH = 26, GAP = 10, X0 = 120, W = 680, RIGHT = 640, ROW = NH + 8;
const perRow = Math.floor((RIGHT - X0 + GAP) / (NW + GAP));
const cls = { d: "c-teal", r: "c-amber", w: "c-gray" };

// a tooltip per node (slice title, and for a running one its branch and minutes since its worktree started)
const tip = (id) => {
  const s = byId.get(id), r = running.find((x) => x.id === id && runningIds.has(id));
  return `<title>${esc([`${id} ${s.title}`, s.opus ? "Opus slice" : "", r ? `${r.branch}${r.minutes != null ? `, ${r.minutes} min` : ""}` : "", eta.bySlice[id] ? `done ≈ ${eta.bySlice[id]}` : ""].filter(Boolean).join(" · "))}</title>`;
};

function svgBody() {
  const out = [];
  let y = 16;
  const mw = mode.label.length * 6.4 + 36, bw = bannerText ? Math.min(RIGHT - 40, bannerText.length * 6.4 + 28) : 0;
  const side = bw + mw + 12 <= RIGHT - 40;
  const pill = (py) => `<g class="${runningIds.size ? "c-amber" : "c-gray"}"><rect x="${RIGHT - mw}" y="${py}" width="${mw}" height="28" rx="14" stroke-width="0.5"/><text class="ts" x="${RIGHT - mw / 2}" y="${py + 14}" text-anchor="middle" dominant-baseline="central">mode: ${esc(mode.label)}</text></g>`;
  if (!side) { out.push(pill(y)); y += 28 + 10; }
  if (bannerText) {
    const w = bw;
    if (side) out.push(pill(y));
    out.push(`<g class="c-teal"><rect x="40" y="${y}" width="${w}" height="28" rx="8" stroke-width="0.5"/><text class="ts" x="${40 + w / 2}" y="${y + 14}" text-anchor="middle" dominant-baseline="central">${esc(bannerText)}</text></g>`);
    y += 28 + 18;
  }
  for (const l of shown) {
    const rows = l.block ? 1 : Math.ceil(l.nodes.length / perRow);
    out.push(`<text class="th" x="40" y="${y + 11}" dominant-baseline="central">${esc(l.id)}</text><text class="ts" x="40" y="${y + 28}" dominant-baseline="central">${l.done} of ${l.total}</text>`);
    // the milestone's ETA under its label, short: "≈ 17:59", "≈ 04:11+1" (tomorrow), "for you" when it waits on the user
    const e = l.block ? null : eta.byMilestone[l.id];
    const laneEta = !e ? "" : e.at ? `≈ ${e.at.replace(" tomorrow", "+1")}` : e.waiting ? "for you" : "";
    if (laneEta) out.push(`<text class="ts" x="40" y="${y + 44}" dominant-baseline="central">${esc(laneEta)}</text>`);
    if (l.block) {
      const c = l.running ? "c-amber" : "c-gray";
      const label = (l.human ? `${l.total - l.done} for you` : `${l.total - l.done} open`) + (l === qLane && qText ? ` · ${qText}` : "");
      const w = Math.max(200, label.length * 6.4 + 28);
      out.push(`<g class="${c}"><rect x="${X0}" y="${y}" width="${w}" height="${NH}" rx="6" stroke-width="0.5"${l.human && !l.running ? ' stroke-dasharray="4 3"' : ""}/><text class="ts" x="${X0 + w / 2}" y="${y + NH / 2}" text-anchor="middle" dominant-baseline="central">${esc(label)}</text></g>`);
    } else {
      l.nodes.forEach((n, i) => {
        const r = Math.floor(i / perRow), x = X0 + (i % perRow) * (NW + GAP), ny = y + r * ROW;
        if (i % perRow && edges.some(([a, b]) => a === l.nodes[i - 1].id && b === n.id)) out.push(`<line x1="${x - GAP}" y1="${ny + NH / 2}" x2="${x}" y2="${ny + NH / 2}" stroke="var(--b)" stroke-width="1.5"/>`);
        out.push(`<g class="${cls[n.s]}">${tip(n.id)}<rect x="${x}" y="${ny}" width="${NW}" height="${NH}" rx="6" stroke-width="0.5"${n.h ? ' stroke-dasharray="4 3"' : ""}/><text class="ts" x="${x + NW / 2}" y="${ny + NH / 2}" text-anchor="middle" dominant-baseline="central">${esc(n.short)}</text></g>`);
        if (n.o) out.push(`<circle cx="${x + NW - 4}" cy="${ny + 4}" r="2.5" fill="var(--t)"/>`);
      });
    }
    y += Math.max((l.block ? 1 : rows) * ROW, laneEta ? 52 : 0) + 10;
  }
  if (hidden.length) { out.push(`<text class="ts" x="40" y="${y + 6}" dominant-baseline="central">+ ${hidden.length} more open: ${esc(hidden.join(", "))}</text>`); y += 26; }
  y += 6;
  const items = [["c-teal", "done"], ["c-amber", "a helper is running"], ["c-gray", "waiting"]];
  let x = 40;
  for (const [c, label] of items) {
    out.push(`<g class="${c}"><rect x="${x}" y="${y}" width="14" height="14" rx="3" stroke-width="0.5"/></g><text class="ts" x="${x + 20}" y="${y + 7}" dominant-baseline="central">${label}</text>`);
    x += 20 + label.length * 6.2 + 22;
  }
  out.push(`<text class="ts" x="40" y="${y + 30}" dominant-baseline="central">A line means the next slice waits on the one before it. A dashed outline is a slice for you.</text>`);
  out.push(`<circle cx="44" cy="${y + 48}" r="2.5" fill="var(--t)"/><text class="ts" x="54" y="${y + 48}" dominant-baseline="central">A dot marks an Opus slice, the costly ones.</text>`);
  return { body: out.join("\n"), height: y + 70 };
}

const STYLE = `<style>
:root{--t:#2c2c2a;--s:#5f5e5a;--b:#888780}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--t:#f1efe8;--s:#b4b2a9;--b:#888780}}
text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--t)}
.t{font-size:14px}.ts{font-size:12px;fill:var(--s)}.th{font-size:14px;font-weight:500}
.c-teal>rect{fill:#E1F5EE;stroke:#0F6E56}.c-teal>text{fill:#085041}
.c-amber>rect{fill:#FAEEDA;stroke:#854F0B}.c-amber>text{fill:#633806}
.c-gray>rect{fill:#F1EFE8;stroke:#5F5E5A}.c-gray>text{fill:#444441}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .c-teal>rect{fill:#085041;stroke:#5DCAA5}:root:not([data-theme=light]) .c-teal>text{fill:#9FE1CB}
:root:not([data-theme=light]) .c-amber>rect{fill:#633806;stroke:#EF9F27}:root:not([data-theme=light]) .c-amber>text{fill:#FAC775}
:root:not([data-theme=light]) .c-gray>rect{fill:#444441;stroke:#B4B2A9}:root:not([data-theme=light]) .c-gray>text{fill:#D3D1C7}}
</style>`;

function svg() {
  const { body, height } = svgBody();
  const desc = `Build progress: ${shown.map((l) => `${l.id} ${l.done} of ${l.total}`).join(", ")}${bannerText ? `, ${bannerText}` : ""}.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${W} ${height}" role="img"><title>Build progress</title><desc>${esc(desc)}</desc>${STYLE}\n${body}\n</svg>\n`;
}

function html() {
  const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Build progress</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#2c2c2a;--mut:#5f5e5a}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1f1e1c;--fg:#f1efe8;--mut:#b4b2a9}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:680px;margin:0 auto}h1{font-size:18px;font-weight:500;margin:0 0 12px}h2{font-size:14px;font-weight:500;margin:16px 0 4px}ul{margin:0;padding-left:20px;color:var(--mut)}
</style></head><body><main>
<h1>Build progress · ${esc(path.basename(root))}</h1>
${svg()}
${runningNow.length ? `<h2>Running now</h2><ul>${li(runningNow.map((r) => `${r.id} ${byId.get(r.id).title}${r.minutes != null ? ` · ${r.minutes} min` : ""}`))}</ul>` : ""}
${ready.length ? `<h2>Could start now, no helper</h2><ul>${li(ready.slice(0, 8).map((id) => `${id} ${byId.get(id).title}`))}</ul>` : ""}
${lines.pace || lines.usage ? `<h2>Pace and usage</h2><ul>${li([lines.pace, lines.usage].filter(Boolean))}</ul>` : ""}
</main></body></html>
`;
}

// ---------- output ----------
const result = {
  project: path.basename(root), generated: stamp(), head,
  mode, banner: bannerText, lanes: shown.map(({ id, title, kind, done, total, running: r, human, block, nodes }) => ({ id, title, kind, done, total, ...(r ? { running: r } : {}), ...(human ? { human } : {}), ...(block ? { block: true } : {}), ...(block ? {} : { nodes: nodes.map((n) => `${n.short}:${n.s}${n.h ? "h" : ""}${n.o ? "o" : ""}`).join(" ") }) })),
  hidden, edges: edges.map(([a, b]) => `${a}>${b}`).join(" "),
  running: runningNow.map((r) => ({ id: r.id, title: byId.get(r.id).title, branch: r.branch, minutes: r.minutes, ...(byId.get(r.id).opus ? { opus: true } : {}) })),
  recentMerges: recent, ready, humanSlices, questions: { open: questions.length, blocking: blocking.map((q) => ({ text: q.text, blocks: q.blocks })) }, pace, eta, etaTrack, usage, lines, text,
};
// the fast status, in sections that read at a glance: progress, helpers (one line each), usage, pace, what waits, what could start
function brief() {
  const out = [head, ""];
  const pad = (s, n) => String(s).padEnd(n);
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  out.push("Progress   ■ done  ▶ running  □ waiting");
  if (bannerText) out.push(`  ${bannerText}`);
  const graphWidth = Math.max(0, ...shown.filter((l) => !l.block).map((l) => l.nodes.length));
  for (const l of shown) {
    const body = l.block
      ? [l.human ? `${l.total - l.done} for you` : `${l.total - l.done} open`, l.running ? "running" : "", l === qLane ? qText : ""].filter(Boolean).join(" · ")
      : `${pad(l.nodes.map((n) => mark[n.s]).join(""), graphWidth)}  ${etaLane(l.id)}`.trimEnd();
    out.push(`  ${pad(l.id, 5)} ${pad(`${l.done}/${l.total}`, 6)} ${body}`);
  }
  if (hidden.length) out.push(`  + ${hidden.length} more open: ${hidden.join(", ")}`);

  out.push("", runningNow.length ? `Helpers   ${mode.last || "build"} profile, ${runningNow.length} running` : `Helpers   none running (${mode.label})`);
  if (runningNow.length) out.push(`  ${pad("Slice", 8)} ${pad("Model", 7)} ${pad("Started", 7)} ${pad("Running", 8)} ${pad("ETA", 8)} Title`);
  for (const r of [...runningNow].sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))) {
    const s = byId.get(r.id);
    const started = r.minutes != null ? clock(now - r.minutes * 60000) : "";
    out.push(`  ${pad(r.id, 8)} ${pad(s.model || "?", 7)} ${pad(started, 7)} ${pad(r.minutes != null ? `${r.minutes} min` : "", 8)} ${pad(eta.bySlice[r.id] ? `≈ ${eta.bySlice[r.id]}` : "", 8)} ${cut(s.title, 48)}`);
  }

  if (usage.five || usage.week || caps) {
    out.push("", "Usage");
    const win = (name, w) => {
      if (!w) return;
      out.push(`  ${pad(name, 8)} ${pad(`${w.pct} %`, 6)} ${w.ratePerHour != null ? `+${w.ratePerHour} %/h (${w.basis})` : ""}`.trimEnd());
      for (const r of w.reach) out.push(`           ${r.name} cap ${r.cap} %: ${r.at === "reached" ? "reached" : r.at ? `at about ${r.at}` : "not before the reset"}`);
      out.push(`           resets ${w.resets}`);
    };
    win("5-hour", usage.five);
    win("weekly", usage.week);
    if (!usage.five && !usage.week) out.push(`  ${usageParts.join(" · ")}`);
    else if (caps?.deadline) out.push(`  deadline ${caps.deadline}`);
  }

  if (pace && remaining) {
    out.push("", "Pace");
    out.push(`  ${pace.perSliceMinutes ?? pace.medianMinutes} min per slice, ${remaining} slices left, ${helpers} helper${helpers > 1 ? "s" : ""}`);
    if (eta.allDone) out.push(`  all done ≈ ${eta.allDone} (about ${hours(eta.allDoneHours)} with ${eta.helpers} helper${eta.helpers > 1 ? "s" : ""}, ${pace.binds === "chain" ? `the longest chain, ${longest} slices, binds` : "the slice count binds"})`);
    else out.push(`  about ${hours(pace.etaHours)} (${pace.binds === "chain" ? `the longest chain, ${longest} slices, binds` : "the slice count binds"})`);
    out.push(`  at most ${hours(pace.inARowHours)} if run one after the other`);
    if (etaTrack.samples) out.push(`  learned from ${etaTrack.samples} merged slice${etaTrack.samples > 1 ? "s" : ""}: times ×${etaTrack.factor}${etaTrack.medianMissPct != null ? `, median miss ${etaTrack.medianMissPct > 0 ? "+" : ""}${etaTrack.medianMissPct} %` : ""}`);
  }

  if (humanSlices.length || questions.length) {
    out.push("", "Waits for you");
    if (humanSlices.length) out.push(`  ${humanSlices.length} slice${humanSlices.length > 1 ? "s" : ""}: ${humanSlices.join(", ")}`);
    if (questions.length) out.push(`  ${questions.length} open question${questions.length > 1 ? "s" : ""}, ${blocking.length} blocking a slice${blocking.length ? `: ${blocking.map((q) => q.blocks.join(", ")).join("; ")}` : ""}`);
  }

  out.push("", "Could start now", `  ${ready.length ? ready.join(", ") : remaining ? "none: every open slice waits on a chain, a helper or the user" : "nothing for a helper: what is left waits on you"}`);
  return out.join("\n");
}
if (opt.brief) { console.log(brief()); process.exit(0); }

// The rule table of the status step (stareso-status §2), first match wins, then 3 to 6 short lines: the head (project,
// step, mode, the number that matters), ⚠ a blocking question and one line per usage window, □ what waits on the user, ▶ the next step. Everything
// else is left to the panel.
function status() {
  const gitDir = git("rev-parse", "--git-dir").trim(), common = git("rev-parse", "--git-common-dir").trim();
  const name = path.basename(root) + (gitDir && common && path.resolve(root, gitDir) !== path.resolve(root, common) ? " (worktree)" : "");
  const numbered = all.filter((l) => /^M\d+$/.test(l.id));
  const waitsOnYou = (s) => s.human || blockedByQuestion.has(s.id) || /waits on \/stareso/.test(s.rest);
  // the newest FEEDBACK block (newest first) with points not yet segmented ("→ slice …", "→ IDEAS", …)
  const newest = (read("docs/FEEDBACK.md").split(/\n(?=## )/).find((b) => /^## /.test(b)) || "");
  const unsegmented = newest.split("\n").filter((l) => /^- \[/.test(l) && !/→/.test(l)).length;
  // the newest numbered milestone with every slice done, untested when its last test marker misses its last slice
  const doneMs = ms.filter((m) => /^M\d+$/.test(m.id) && m.slices.every((s) => s.done)).sort((a, b) => numOf(a.id) - numOf(b.id)).at(-1);
  const untested = doneMs && !(doneMs.tested && doneMs.tested.includes(doneMs.slices.at(-1).id)) ? doneMs : null;
  const decision = openNumbered.some((s) => /waits on \/stareso-improve/.test(s.rest)) || /\(open:/.test(plan)
    || (blocking.length && openNumbered.filter((s) => !s.human).every((s) => blockedByQuestion.has(s.id)));
  const fmt = (l) => `${l.id} ${l.done}/${l.total}`;
  const test = next("/stareso-test", "standard", "new session");

  let head, go, youLine = true;
  if (runningNow.length) {
    const lane = numbered.find((l) => l.running) || open.find((l) => l.running);
    const end = eta.byMilestone[lane.id]?.at;
    head = `build ${fmt(lane)} · ${mode.last || (runningNow.length > 1 ? "fast" : "eco")}${end ? ` · ends ≈ ${end}` : ""}`;
    go = `after ${lane.id}: ${test}`;
  } else if (/^build$/.test(phase) && ready.length) {
    const m = byId.get(ready[0]).ms, lane = all.find((l) => l.id === m);
    head = `build ${fmt(lane)} · idle${mode.last ? ` (last run ${mode.last})` : ""}`;
    go = next(`/stareso-build ${m} eco`, "standard", "new session", "auto");
  } else if (untested) {
    head = `${untested.id} built, untested`;
    go = test;
  } else if (unsegmented) {
    head = `test not segmented (${unsegmented} points)`;
    go = `"end test" in the test session, or ${next("/stareso-test", "standard")}`;
  } else if (decision) {
    head = "a decision is missing";
    go = next("/stareso-improve", "strong", "new session");
  } else if (openNumbered.length && openNumbered.every(waitsOnYou)) {
    head = "waiting for you";
    go = `your steps ${humanSlices.slice(0, 4).join(", ")}${humanSlices.length > 4 ? " …" : ""}, then \`/stareso-build\``;
    youLine = false;
  } else if (/^build$/.test(phase) && !openNumbered.length) {
    head = "ready to publish or deliver";
    go = next("/stareso-deploy", "strong", "new session");
  } else {
    head = `${phase}, in use`;
    go = `new ideas: ${next("/stareso-improve", "strong", "new session")}`;
  }
  const out = [`${name} · ${head}`];

  // ⚠ a question that blocks slices, then one line per usage window (5-hour, weekly) when it matters now: a cap
  // reached, the first cap the run reaches before the reset, or a window past 90 %. Each line names its window.
  const blockedNumbered = openNumbered.filter((s) => blockedByQuestion.has(s.id)).map((s) => s.id);
  if (blockedNumbered.length) out.push(`⚠ ${blockedNumbered.length} slice${blockedNumbered.length > 1 ? "s wait" : " waits"} on a question: ${blockedNumbered.slice(0, 3).join(", ")}${blockedNumbered.length > 3 ? " …" : ""}`);
  const active = runningNow.length || ready.length;
  for (const [w, u] of [["5-hour", usage.five], ["weekly", usage.week]]) {
    if (!u) continue;
    const hit = u.reach.find((r) => r.at === "reached");
    const soon = u.reach.filter((r) => r.at && r.at !== "reached").sort((a, b) => a.t - b.t)[0];
    const cap = (r) => (w === "weekly" ? `cap ${r.cap} %` : `${r.name} cap ${r.cap} %`);
    if (hit) out.push(`⚠ ${w} ${u.pct} %: ${cap(hit)} reached`);
    else if (soon && active) out.push(`⚠ ${w} ${u.pct} %: ${cap(soon)} ≈ ${soon.at}`);
    else if (u.pct >= 90) out.push(`⚠ ${w} ${u.pct} %, resets ${u.resets}`);
  }

  const you = [humanSlices.length && `${humanSlices.length} human slice${humanSlices.length > 1 ? "s" : ""}`, questions.length && `${questions.length} question${questions.length > 1 ? "s" : ""}`].filter(Boolean);
  if (youLine && you.length) out.push(`□ ${you.join(", ")} wait${you.length > 1 || humanSlices.length > 1 || questions.length > 1 ? "" : "s"} on you`);
  out.push(`▶ ${go}`);
  return out.join("\n");
}
if (opt.status) { console.log(status()); process.exit(0); }
// for the live status panel: the brief, every milestone and slice for its own drawing of the graph, and what the panel's
// alerts compare between refreshes. A slice is done, running, ready (could start now), you (waits on the user: a [human]
// slice, a blocking question, a lettered milestone) or waiting (on a chain or a helper).
function panelGraph() {
  const readySet = new Set(ready);
  const runOf = new Map(runningNow.map((r) => [r.id, r]));
  const slices = {};
  for (const s of byId.values()) {
    const r = runOf.get(s.id);
    const q = questions.find((x) => x.blocks.includes(s.id));
    const state = s.done ? "done" : r ? "running" : readySet.has(s.id) ? "ready"
      : s.human || q || /waits on \/stareso/.test(s.rest) || lettered({ id: s.ms }) ? "you" : "waiting";
    slices[s.id] = { title: s.title, ms: s.ms, state, after: s.after, ...(s.model ? { model: s.model } : {}), ...(s.opus ? { opus: true } : {}),
      ...(r ? { minutes: r.minutes, started: r.minutes != null ? clock(now - r.minutes * 60000) : null, branch: r.branch } : {}),
      ...(eta.bySlice[s.id] ? { eta: eta.bySlice[s.id] } : {}), ...(q ? { question: q.text } : {}) };
  }
  const lane = (l) => ({ id: l.id, title: l.title, kind: l.kind, done: l.done, total: l.total, block: l.block, eta: etaLane(l.id), slices: l.nodes.map((n) => n.id) });
  return { mode: mode.label, allDone: eta.allDone ?? null, pace: pace?.line ?? null, lanes: shown.map(lane), finished: finished.map(lane), hidden, slices };
}
if (opt.panel) {
  console.log(JSON.stringify({ project: path.basename(root), root, brief: brief(), graph: panelGraph(), recentMerges: recent,
    running: runningNow.map((r) => ({ id: r.id, minutes: r.minutes })), perSliceMinutes: pace?.perSliceMinutes ?? null, usage, etaTrack }));
  process.exit(0);
}
if (opt.write) {
  const dir = outDir;
  fs.mkdirSync(dir, { recursive: true });
  const files = { svg: path.join(dir, "progress.svg"), html: path.join(dir, "progress.html") };
  fs.writeFileSync(files.svg, svg()); fs.writeFileSync(files.html, html());
  result.files = files;
}
// one line per key, one line per lane or helper
const rows = (a) => `[\n  ${a.map((x) => JSON.stringify(x)).join(",\n  ")}\n ]`;
console.log(`{\n${Object.entries(result).map(([k, v]) => ` ${JSON.stringify(k)}: ${Array.isArray(v) && v.length && typeof v[0] === "object" ? rows(v) : JSON.stringify(v)}`).join(",\n")}\n}`);
