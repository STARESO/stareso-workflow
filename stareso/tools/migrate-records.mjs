// One-shot move of a stareso project's machine records to the JSONL datasets (lib/records.mjs), or their creation in a
// new project (setup runs it). Converts, in this order:
//   docs/usage-sessions.json + the transcripts → docs/data/sessions.jsonl (one line per session)
//   docs/BUILD-LOG.md → docs/data/builds.jsonl (slice, caps and note events, then the merges with their lines, read
//                       from git once); the log itself moves to docs/archive/BUILD-LOG.md, frozen
//   the "## Retros" and "## Usage reports" sections of docs/USAGE.md → docs/RETROS.md; USAGE.md and
//                       usage-sessions.json are removed (git keeps them)
//   .gitattributes gets `docs/data/*.jsonl merge=union` (two branches that both append keep both lines), and
//   docs/README.md the rows of the new files.
//
// Usage:  node ~/.claude/stareso/tools/migrate-records.mjs [--root <project>] [--force]
//         With STARESO_DATA=<dir> (or --data <dir>) only the datasets are written, in <dir>, and the project is left
//         untouched: a read-only check (`usage-report` and `dashboard` read the same <dir> with the same variable).
// Nothing is committed: the step that runs it commits docs and .gitattributes.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { args, findRoot, stamp } from "./lib/roadmap.mjs";
import { collect, localIso } from "./lib/usage.mjs";
import { buildsFile, dataDir, mergesFromGit, parseLogLine, plainChat, sessionsFile, writeJsonl } from "./lib/records.mjs";

const opt = args(process.argv.slice(2));
if (typeof opt.data === "string") process.env.STARESO_DATA = path.resolve(opt.data);
const root = findRoot(opt.root ? path.resolve(opt.root) : process.cwd());
const checkOnly = !!process.env.STARESO_DATA;
const docs = path.join(root, "docs");
const dir = dataDir(root);
const exists = (f) => fs.existsSync(f);
const git = (...a) => { try { return execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
const tracked = (f) => git("ls-files", "--error-unmatch", path.relative(root, f)) !== null;
const report = [];

if (exists(dir) && fs.readdirSync(dir).length && !opt.force) { console.error(`${path.relative(root, dir) || dir} already holds records: nothing done (--force writes them again).`); process.exit(1); }

// 1. sessions: read before the data folder exists, so the old records (usage-sessions.json) fill in the gone ones
const entries = (await collect(root, { live: true }).catch(() => [])).map(({ id, s, steps, h, inWorktree, wf, seeded, loggedOn }) => ({ id, s, steps, h, inWorktree, wf, ...(seeded ? { seeded } : {}), at: loggedOn || new Date().toISOString().slice(0, 16) })).map(plainChat);
entries.sort((a, b) => a.s.first.localeCompare(b.s.first));

// 2. builds: the log's dated lines in order, then every merge as usage-report counted it (lines outside docs/)
const logFile = path.join(docs, "BUILD-LOG.md");
const events = exists(logFile) ? fs.readFileSync(logFile, "utf8").split(/\r?\n/).map(parseLogLine).filter(Boolean) : [];
const slices = events.filter((e) => e.type === "slice").map((e) => ({ id: e.id, milestone: e.id.split(".")[0], time: new Date(e.t.replace(" ", "T")) }));
const merges = slices.length ? mergesFromGit(root, slices) : [];
const sec = (d) => localIso(d).slice(0, 19);
const builds = [...events, ...merges.map((m) => ({ type: "merge", id: m.id, at: sec(m.time), lines: m.lines, ...(m.fromLog ? { fromLog: true } : {}) }))];

fs.mkdirSync(dir, { recursive: true });
writeJsonl(sessionsFile(root), entries);
writeJsonl(buildsFile(root), builds);
report.push(`${entries.length} sessions → ${path.relative(root, sessionsFile(root)) || sessionsFile(root)}`);
report.push(`${events.filter((e) => e.type === "slice").length} slices, ${events.filter((e) => e.type === "caps").length} caps, ${events.filter((e) => e.type === "note").length} notes and ${merges.length} merges → ${path.relative(root, buildsFile(root)) || buildsFile(root)}`);

if (checkOnly) { console.log(`Check only (STARESO_DATA): the project is untouched.\n${report.join("\n")}`); process.exit(0); }

const move = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (tracked(from) && git("mv", path.relative(root, from), path.relative(root, to)) !== null) return;
  fs.renameSync(from, to);
};
const remove = (f) => { if (!exists(f)) return; if (!(tracked(f) && git("rm", "-q", path.relative(root, f)) !== null)) fs.rmSync(f); };
const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");

// 3. the log, frozen in the archive with a first line that says so
if (exists(logFile)) {
  const to = path.join(docs, "archive", "BUILD-LOG.md");
  move(logFile, to);
  const text = fs.readFileSync(to, "utf8"), eol = eolOf(text);
  fs.writeFileSync(to, `> Frozen on ${stamp().slice(0, 10)}: every line below is in docs/data/builds.jsonl, where slice-done writes the new ones (read them with \`usage-report.mjs --builds\` or on the dashboard).${eol}${eol}${text}`);
  report.push("docs/BUILD-LOG.md → docs/archive/BUILD-LOG.md (frozen)");
}

// 4. retro entries and kept usage reports → RETROS.md; USAGE.md and usage-sessions.json go
const usageFile = path.join(docs, "USAGE.md"), retrosFile = path.join(docs, "RETROS.md");
const template = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates", "RETROS.md");
let retros = exists(retrosFile) ? fs.readFileSync(retrosFile, "utf8") : exists(template) ? fs.readFileSync(template, "utf8") : "# Retros\n";
if (exists(usageFile)) {
  const text = fs.readFileSync(usageFile, "utf8");
  const end = text.indexOf("<!-- usage:end -->");
  const kept = (end >= 0 ? text.slice(end + "<!-- usage:end -->".length) : "").split(/\r?\n(?=## )/).filter((s) => /^## (Retros|Usage reports)/.test(s.trim()));
  // the entries keep their ### headings; the section headings become the file's own
  const body = kept.map((s) => s.trim().replace(/^## Retros\s*/, "").replace(/^## Usage reports\s*/, "## Usage reports (kept from USAGE.md)\n\n")).filter(Boolean).join("\n\n");
  if (body) retros = retros.trimEnd() + "\n\n" + body + "\n";
  remove(usageFile);
  report.push(`docs/USAGE.md removed${body ? ", its retro entries moved to docs/RETROS.md" : ""}`);
}
if (!exists(retrosFile) || retros !== fs.readFileSync(retrosFile, "utf8")) fs.writeFileSync(retrosFile, retros);
if (exists(path.join(docs, "usage-sessions.json"))) { remove(path.join(docs, "usage-sessions.json")); report.push("docs/usage-sessions.json removed"); }

// 5. union merge for the datasets
const ga = path.join(root, ".gitattributes");
const gaText = exists(ga) ? fs.readFileSync(ga, "utf8") : "";
if (!/docs\/data\/\*\.jsonl\s+merge=union/.test(gaText)) {
  const eol = gaText ? eolOf(gaText) : "\n";
  fs.writeFileSync(ga, (gaText && !gaText.endsWith("\n") ? gaText + eol : gaText) + `# stareso datasets: one event per line, both sides of a merge are kept${eol}docs/data/*.jsonl merge=union${eol}`);
  report.push(".gitattributes: docs/data/*.jsonl merge=union");
}

// 6. docs/README.md: the rows of the new files in place of BUILD-LOG and USAGE
const readmeFile = path.join(docs, "README.md");
if (exists(readmeFile)) {
  const text = fs.readFileSync(readmeFile, "utf8"), eol = eolOf(text);
  const rows = [
    "| `data/` | Machine records, one event per line: `sessions.jsonl` (`session-stats --log`), `builds.jsonl` (`slice-done`, `record.mjs`). Read with `usage-report.mjs` or the dashboard | setup | tools |",
    "| `RETROS.md` | Workflow reviews, newest at the bottom | setup | retro |",
    "| `reports/` | Dated usage reports kept on request (`dashboard.mjs --write`, standalone HTML) | usage | usage |",
    "| `archive/` | Finished material kept for reference (the frozen `BUILD-LOG.md`) | tools | — |",
  ].filter((r) => !text.includes(r.slice(0, r.indexOf("|", 2))));
  let lines = text.split(/\r?\n/).filter((l) => !/^\| `(BUILD-LOG|USAGE)\.md` \|/.test(l));
  const at = lines.findIndex((l) => /^\| `README\.md` \|/.test(l));
  const last = at >= 0 ? at : lines.map((l) => l.startsWith("|")).lastIndexOf(true) + 1;
  lines.splice(last, 0, ...rows);
  fs.writeFileSync(readmeFile, lines.join(eol));
  report.push("docs/README.md: rows for data/, RETROS.md, reports/, archive/");
}

console.log(report.join("\n") + "\nNothing committed: commit docs and .gitattributes.");
