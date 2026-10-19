// Shared helpers for the roadmap tools: find the project, parse milestone files and slice lines,
// regenerate the overview table in docs/ROADMAP.md. Keeps each file's line endings (CRLF on Windows).
import fs from "node:fs";
import path from "node:path";

export function findRoot(start = process.cwd()) {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, "docs", "ROADMAP.md"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("No docs/ROADMAP.md found: run from inside a stareso project.");
    dir = parent;
  }
}

export function readText(file) {
  const raw = fs.readFileSync(file, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  return { lines: raw.split(/\r?\n/), eol };
}

export function writeText(file, lines, eol) {
  fs.writeFileSync(file, lines.join(eol));
}

// `M23.4` → `M23`, `H.1` → `H`, `P.1a` → `P`.
export function milestoneOf(sliceId) {
  const m = /^([A-Za-z]+\d*)\./.exec(sliceId);
  if (!m) throw new Error(`Not a slice id: ${sliceId}`);
  return m[1];
}

const SLICE_RE = /^- \[( |x)\] \*\*([A-Za-z]+\d*\.\w+) · (.+?)\*\*(.*)$/;

export function parseSlices(lines) {
  const out = [];
  lines.forEach((line, i) => {
    const m = SLICE_RE.exec(line);
    if (m) out.push({ line: i, done: m[1] === "x", id: m[2], title: m[3], rest: m[4], human: /\[human\]/.test(m[4]) });
  });
  return out;
}

// Milestone files: docs/roadmap/<ID>.md (new layout) or sections of docs/ROADMAP.md (old layout).
export function milestones(root) {
  const dir = path.join(root, "docs", "roadmap");
  const result = [];
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort(sortIds)) {
      const file = path.join(dir, name);
      const { lines, eol } = readText(file);
      const head = lines.find((l) => /^# /.test(l)) || "";
      const hm = /^# ([A-Za-z]+\d*)\. (.+)$/.exec(head);
      result.push({ file, eol, lines, id: hm ? hm[1] : path.basename(name, ".md"), title: hm ? hm[2] : head.replace(/^# /, ""), slices: parseSlices(lines), tested: lastTestMarker(lines) });
    }
  } else {
    const file = path.join(root, "docs", "ROADMAP.md");
    const { lines, eol } = readText(file);
    let cur = null;
    lines.forEach((l, i) => {
      const hm = /^## ([A-Za-z]+\d*)\. (.+)$/.exec(l);
      if (hm) { cur = { file, eol, id: hm[1], title: hm[2], start: i, lines: [] }; result.push(cur); }
      else if (cur) cur.lines.push(l);
    });
    for (const m of result) { m.slices = parseSlices(m.lines).map((s) => ({ ...s, line: s.line + m.start + 1 })); m.tested = lastTestMarker(m.lines); m.lines = lines; }
  }
  return result;
}

function sortIds(a, b) {
  const num = (s) => { const m = /^M(\d+)/.exec(s); return m ? Number(m[1]) : Infinity; };
  return num(a) - num(b) || a.localeCompare(b);
}

function lastTestMarker(lines) {
  let last = null;
  for (const l of lines) { const m = /<!-- test: (.+?) -->/.exec(l); if (m) last = m[1]; }
  return last;
}

export function findSlice(root, id) {
  for (const m of milestones(root)) {
    const s = m.slices.find((x) => x.id === id);
    if (s) return { milestone: m, slice: s };
  }
  return null;
}

export function overviewTable(root) {
  const rows = milestones(root).map((m) => {
    const done = m.slices.filter((s) => s.done).length;
    const human = m.slices.filter((s) => !s.done && s.human).length;
    const status = m.slices.length === 0 ? "—" : done === m.slices.length ? "done" : done > 0 ? "in progress" : "open";
    const file = fs.existsSync(path.join(root, "docs", "roadmap")) ? `[${m.id}](roadmap/${path.basename(m.file)})` : m.id;
    return `| ${file} | ${m.title} | ${done}/${m.slices.length} | ${human ? human + " [human]" : ""} | ${m.tested && m.tested !== "none yet" ? m.tested : ""} | ${status} |`;
  });
  return ["| Milestone | Title | Done | Waiting | Tested | Status |", "|---|---|---|---|---|---|", ...rows].join("\n");
}

export const OVERVIEW_START = "<!-- overview:start -->";
export const OVERVIEW_END = "<!-- overview:end -->";

// Replaces the table between the markers in docs/ROADMAP.md; returns false when the markers are missing.
export function writeOverview(root) {
  const file = path.join(root, "docs", "ROADMAP.md");
  const { lines, eol } = readText(file);
  const a = lines.indexOf(OVERVIEW_START), b = lines.indexOf(OVERVIEW_END);
  if (a < 0 || b < 0 || b < a) return false;
  const table = overviewTable(root).split("\n");
  writeText(file, [...lines.slice(0, a + 1), ...table, ...lines.slice(b)], eol);
  return true;
}

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; out[k] = v; }
    else out._.push(argv[i]);
  }
  return out;
}
