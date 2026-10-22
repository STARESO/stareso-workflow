// Progress graph of a stareso project, from the records only (never code, never writes in the project).
// Reads docs/roadmap/*.md (slice lines, `after:`, [human]), docs/ROADMAP.md, docs/QUESTIONS.md, docs/BUILD-LOG.md,
// `git worktree list` (branches slice/<id>-…, the running helpers) and the newest `Merge slice` commits.
//
// Usage:  node ~/.claude/stareso/tools/progress-graph.mjs [--root <project>] [--max-lanes 8]
//           (no other flag)  compact JSON: lanes, nodes, edges, running, ready, human, questions, pace, text lines
//         --text             only the text fallback, one line per lane (■ done, ▶ running, □ waiting)
//         --write [dir]      also writes progress.svg (standalone, light and dark), progress-widget.svg (host color
//                            classes, for the visualize tool) and progress.html (page that wraps the SVG); the default
//                            folder is the system temp folder, never the project. Paths come back in `files`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { args, findRoot, milestones, stamp } from "./lib/roadmap.mjs";

const opt = args(process.argv.slice(2));
const root = opt.root ? findRoot(path.resolve(opt.root)) : findRoot();
const maxLanes = Number(opt["max-lanes"]) || 8;

const git = (...a) => { try { return execFileSync("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
const read = (rel) => { try { return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };

// ---------- records ----------
const ms = milestones(root).filter((m) => m.slices.length > 0);
const lettered = (m) => !/^M\d+$/.test(m.id);
const numOf = (id) => Number(id.replace(/\D/g, "")) || 0;
const afterOf = (s) => (((/after: ([A-Za-z0-9., ]+?)(?: ·|$)/.exec(s.rest) || [])[1]) || "").split(/[ ,]+/).filter((x) => /^[A-Za-z]+\d*\.\w+$/.test(x));
const byId = new Map(ms.flatMap((m) => m.slices.map((s) => [s.id, { ...s, ms: m.id, after: afterOf(s) }])));

// running helpers: worktrees (or the main folder) on a branch slice/<id>-…
const running = [];
let cur = {};
for (const line of (git("worktree", "list", "--porcelain") + "\n").split("\n")) {
  if (line.startsWith("worktree ")) cur = { path: line.slice(9) };
  else if (line.startsWith("branch ")) {
    const m = /^refs\/heads\/slice\/([A-Za-z]+\d*\.\w+)(?:-|$)/.exec(line.slice(7));
    if (m && byId.has(m[1])) running.push({ id: m[1], branch: line.slice(18), path: cur.path });
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
    nodes: m.slices.map((s) => ({ id: s.id, short: shortId(s.id), s: stateOf(s), ...(s.human && !s.done ? { h: 1 } : {}) })) };
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

// ---------- pace, from the merge times of BUILD-LOG ----------
const merges = read("docs/BUILD-LOG.md").split("\n").map((l) => /^- (\d{4}-\d\d-\d\d) (\d\d:\d\d) · (\S+) .*? · (?:[\w.-]+) · ok · [^·]*· ([\w-]+)/.exec(l)).filter(Boolean)
  .map((m) => ({ id: m[3], profile: m[4], t: new Date(`${m[1]}T${m[2]}:00`).getTime() })).sort((a, b) => a.t - b.t);
const gaps = merges.slice(1).map((m, i) => (m.t - merges[i].t) / 60000).filter((g) => g > 0 && g <= 90).slice(-20);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const med = median(gaps);
const remaining = openNumbered.filter((s) => !s.human).length;
// longest chain of still open slices (a chain cannot be parallelised)
const depth = new Map();
const chain = (id) => {
  if (depth.has(id)) return depth.get(id);
  depth.set(id, 1);
  const s = byId.get(id);
  const d = 1 + Math.max(0, ...s.after.filter((a) => byId.has(a) && !byId.get(a).done).map(chain));
  depth.set(id, d); return d;
};
const longest = Math.max(0, ...openNumbered.map((s) => chain(s.id)));
const pace = med == null ? null : {
  medianMinutes: Math.round(med), samples: gaps.length, lastMerge: merges.length ? stamp(new Date(merges.at(-1).t)) : null,
  remaining, etaHours: +(remaining * med / 60).toFixed(1), longestChain: longest, chainFloorHours: +(longest * med / 60).toFixed(1),
};

// ---------- build mode: the profile of the newest logged merge (eco, fast, night, day), the helpers running now, the pack's profiles ----------
const pack = (/^Pack: (\S+)/m.exec(read("docs/PLAN.md")) || [])[1] || "";
const packFile = (f) => { try { return fs.readFileSync(path.join(fileURLToPath(new URL("..", import.meta.url)), "packs", pack, f), "utf8"); } catch { return ""; } };
const packDoc = pack ? packFile("README.md") + packFile("guide.md") : "";
const lastProfile = merges.map((m) => m.profile).filter((p) => /^(eco|fast|night|day)$/.test(p)).at(-1) || null;
const nightPack = /night runs?|stareso-build.*night|`night`/i.test(packDoc);
const mode = { pack, last: lastProfile, helpers: runningIds.size, available: ["eco", "fast", ...(nightPack ? ["night", "day"] : [])] };
mode.label = runningIds.size ? `${lastProfile || (runningIds.size > 1 ? "fast" : "eco")} · ${runningIds.size} helper${runningIds.size > 1 ? "s" : ""}` : lastProfile ? `idle · last run ${lastProfile}` : "idle";

// ---------- text fallback ----------
const mark = { d: "■", r: "▶", w: "□" };
const text = [`mode: ${mode.label} (profiles of this pack: ${mode.available.join(", ")})`];
if (bannerText) text.push(bannerText);
for (const l of shown) text.push(`${l.id.padEnd(3)} ${String(l.done).padStart(2)}/${l.total}  ${l.block ? `block${l.human ? `, ${l.human} for you` : ""}${l.running ? ", running" : ""}` : l.nodes.map((n) => mark[n.s]).join("")}`);
if (hidden.length) text.push(`+ ${hidden.length} more open: ${hidden.join(", ")}`);
text.push("■ done  ▶ a helper is running  □ waiting");

// ---------- SVG ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const NW = 34, NH = 26, GAP = 10, X0 = 120, W = 680, RIGHT = 640, ROW = NH + 8;
const perRow = Math.floor((RIGHT - X0 + GAP) / (NW + GAP));
const cls = { d: "c-teal", r: "c-amber", w: "c-gray" };

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
    if (l.block) {
      const w = 200, c = l.running ? "c-amber" : "c-gray", label = l.human ? `${l.total - l.done} for you` : `${l.total - l.done} open`;
      out.push(`<g class="${c}"><rect x="${X0}" y="${y}" width="${w}" height="${NH}" rx="6" stroke-width="0.5"${l.human && !l.running ? ' stroke-dasharray="4 3"' : ""}/><text class="ts" x="${X0 + w / 2}" y="${y + NH / 2}" text-anchor="middle" dominant-baseline="central">${esc(label)}</text></g>`);
    } else {
      l.nodes.forEach((n, i) => {
        const r = Math.floor(i / perRow), x = X0 + (i % perRow) * (NW + GAP), ny = y + r * ROW;
        if (i % perRow && edges.some(([a, b]) => a === l.nodes[i - 1].id && b === n.id)) out.push(`<line x1="${x - GAP}" y1="${ny + NH / 2}" x2="${x}" y2="${ny + NH / 2}" stroke="var(--b)" stroke-width="1.5"/>`);
        out.push(`<g class="${cls[n.s]}"><rect x="${x}" y="${ny}" width="${NW}" height="${NH}" rx="6" stroke-width="0.5"${n.h ? ' stroke-dasharray="4 3"' : ""}/><text class="ts" x="${x + NW / 2}" y="${ny + NH / 2}" text-anchor="middle" dominant-baseline="central">${esc(n.short)}</text></g>`);
      });
    }
    y += (l.block ? 1 : rows) * ROW + 10;
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
  return { body: out.join("\n"), height: y + 52 };
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

function svg(standalone) {
  const { body, height } = svgBody();
  const desc = `Build progress: ${shown.map((l) => `${l.id} ${l.done} of ${l.total}`).join(", ")}${bannerText ? `, ${bannerText}` : ""}.`;
  return `<svg ${standalone ? 'xmlns="http://www.w3.org/2000/svg" ' : ""}width="100%" viewBox="0 0 ${W} ${height}" role="img"><title>Build progress</title><desc>${esc(desc)}</desc>${standalone ? STYLE : ""}\n${body}\n</svg>\n`;
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
${svg(true)}
${running.length ? `<h2>Running now</h2><ul>${li(running.filter((r) => runningIds.has(r.id)).map((r) => `${r.id} ${byId.get(r.id).title}`))}</ul>` : ""}
${ready.length ? `<h2>Could start now, no helper</h2><ul>${li(ready.slice(0, 8).map((id) => `${id} ${byId.get(id).title}`))}</ul>` : ""}
${pace ? `<h2>Pace</h2><ul>${li([`${pace.medianMinutes} min per merged slice (median of ${pace.samples} gaps), about ${pace.etaHours} h for ${pace.remaining} slices in a row`, `the longest chain alone needs ${pace.chainFloorHours} h`])}</ul>` : ""}
</main></body></html>
`;
}

// ---------- output ----------
const result = {
  project: path.basename(root), generated: stamp(),
  mode, banner: bannerText, lanes: shown.map(({ id, title, kind, done, total, running: r, human, block, nodes }) => ({ id, title, kind, done, total, ...(r ? { running: r } : {}), ...(human ? { human } : {}), ...(block ? { block: true } : {}), ...(block ? {} : { nodes: nodes.map((n) => `${n.short}:${n.s}${n.h ? "h" : ""}`).join(" ") }) })),
  hidden, edges: edges.map(([a, b]) => `${a}>${b}`).join(" "),
  running: [...runningIds].map((id) => ({ id, title: byId.get(id).title, branch: running.find((r) => r.id === id).branch })),
  recentMerges: recent, ready, humanSlices, questions: { open: questions.length, blocking: questions.filter((q) => q.blocks.some((b) => byId.has(b) && !byId.get(b).done)).map((q) => ({ text: q.text, blocks: q.blocks })) }, pace, text,
};

if (opt.text) { console.log(text.join("\n")); process.exit(0); }
if (opt.write) {
  const dir = typeof opt.write === "string" ? path.resolve(opt.write) : path.join(os.tmpdir(), `stareso-progress-${path.basename(root)}`);
  if (dir.toLowerCase().startsWith(root.toLowerCase() + path.sep)) { console.error("Refusing to write inside the project."); process.exit(1); }
  fs.mkdirSync(dir, { recursive: true });
  const files = { svg: path.join(dir, "progress.svg"), widget: path.join(dir, "progress-widget.svg"), html: path.join(dir, "progress.html") };
  fs.writeFileSync(files.svg, svg(true)); fs.writeFileSync(files.widget, svg(false)); fs.writeFileSync(files.html, html());
  result.files = files;
}
// one line per key, one line per lane or helper
const rows = (a) => `[\n  ${a.map((x) => JSON.stringify(x)).join(",\n  ")}\n ]`;
console.log(`{\n${Object.entries(result).map(([k, v]) => ` ${JSON.stringify(k)}: ${Array.isArray(v) && v.length && typeof v[0] === "object" ? rows(v) : JSON.stringify(v)}`).join(",\n")}\n}`);
