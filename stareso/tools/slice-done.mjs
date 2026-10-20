// Closes one slice in one call: merge its branch into the current branch with --no-ff, delete the branch,
// tick the roadmap box, switch the IDEAS lines naming it from 🛠 to ✅, append the BUILD-LOG line,
// regenerate the roadmap overview and commit the docs. Prints the one-line report for the user.
//
// Usage (from the project folder, on main):
//   node ~/.claude/stareso/tools/slice-done.mjs M23.4 --model sonnet --tokens 42k --note "three dropdowns; checked at 280 px"
//   options: --result "ok" (default) | "ok after 1 fix" · --branch <name> (default: the slice/<id>-* branch) | none (built in chat)
//            --profile eco|fast (written in the log line) · --no-commit
//            --harness <h> · --helper subagent|session|inline · --tier strong|standard|light (written in the log line;
//            defaults: the `Harness:` and `Helpers:` lines of the project instructions, else claude-code and subagent,
//            and the brief's `tier:`, or its `model:` looked up in stareso/harness/<h>/models.md)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findRoot, findSlice, readText, writeText, writeOverview, stamp, args } from "./lib/roadmap.mjs";

const a = args(process.argv.slice(2));
const id = a._[0];
if (!id) { console.error("usage: slice-done.mjs <slice-id> [--model m] [--tokens n] [--note text] [--result r] [--branch b|none] [--profile p] [--harness h] [--helper m] [--tier t]"); process.exit(1); }

const root = findRoot();
const git = (...cmd) => execFileSync("git", cmd, { cwd: root, encoding: "utf8" }).trim();

const found = findSlice(root, id);
if (!found) { console.error(`Slice ${id} not found in docs/roadmap/ or docs/ROADMAP.md`); process.exit(1); }
const { milestone, slice } = found;
if (slice.done && !a.force) { console.error(`Slice ${id} is already ticked (use --force to log again).`); process.exit(1); }

// 1. Merge the slice branch.
let branch = a.branch;
if (branch !== "none") {
  if (!branch) {
    const list = git("branch", "--list", `slice/${id}-*`).split("\n").map((s) => s.replace(/^\*?\s*/, "")).filter(Boolean);
    if (list.length !== 1) { console.error(list.length ? `Several branches match slice/${id}-*: ${list.join(", ")}` : `No branch slice/${id}-* (pass --branch <name> or --branch none)`); process.exit(1); }
    branch = list[0];
  }
  // Untracked files (dev logs, generated AGENTS.md) do not block a merge; modified tracked files do.
  if (git("status", "--porcelain", "--untracked-files=no")) { console.error("Working tree not clean (modified tracked files): commit or discard first."); process.exit(1); }
  git("merge", "--no-ff", branch, "-m", `Merge slice ${id}: ${slice.title}`);
  git("branch", "-d", branch);
}

// 2. Tick the box.
{
  const { lines, eol } = readText(milestone.file);
  lines[slice.line] = lines[slice.line].replace("- [ ] ", "- [x] ");
  writeText(milestone.file, lines, eol);
}

// 3. IDEAS: 🛠 lines naming this slice become ✅.
let ideasFlipped = 0;
const ideasFile = path.join(root, "docs", "IDEAS.md");
if (fs.existsSync(ideasFile)) {
  const { lines, eol } = readText(ideasFile);
  const re = new RegExp(`(^|[^A-Za-z0-9.])${id.replace(/\./g, "\\.")}(?![0-9A-Za-z])`);
  const out = lines.map((l) => (l.startsWith("- 🛠") && re.test(l) ? (ideasFlipped++, l.replace("- 🛠", "- ✅")) : l));
  if (ideasFlipped) writeText(ideasFile, out, eol);
}

// 3b. QUESTIONS: an open [debt] line whose "→ slice <id>" names this slice is paid: tick it with the answer.
let debtPaid = 0;
const qFile = path.join(root, "docs", "QUESTIONS.md");
if (fs.existsSync(qFile)) {
  const { lines, eol } = readText(qFile);
  const out = lines.map((l) => {
    const m = /^- \[ \] \[debt\].*→ slice ([A-Za-z0-9.]+)/.exec(l);
    if (!m || m[1] !== id) return l;
    debtPaid++;
    return l.replace("- [ ] ", "- [x] ") + ` **Answer (${stamp().slice(0, 10)}): paid by ${id}.**`;
  });
  if (debtPaid) writeText(qFile, out, eol);
}

// 4. BUILD-LOG line. Harness, helper mode and tier let the retro compare harnesses (stareso/metrics.md).
const instructions = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"].map((f) => path.join(root, f)).filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
const harness = a.harness || (/\bHarness:\s*([\w-]+)/i.exec(instructions) || [])[1] || "claude-code";
const helper = a.helper || (/\bHelpers?:\s*(subagent|session|inline)\b/i.exec(instructions) || [])[1] || "subagent";
let tier = a.tier || (/\btier: (strong|standard|light)\b/.exec(slice.rest) || [])[1];
if (!tier) {
  // A `model:` brief: its tier is the row whose Id is that model (| Tier | Prose | Id | … |), in the harness's
  // models.md, then in Claude Code's, because `model: opus | sonnet | haiku` is the old name of the tier field.
  const brief = (/\bmodel: (\w+)/.exec(slice.rest) || [])[1];
  for (const h of brief ? [harness, "claude-code"] : []) {
    const models = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "harness", h, "models.md");
    const row = fs.existsSync(models) && fs.readFileSync(models, "utf8").split(/\r?\n/).map((l) => l.split("|").map((c) => c.trim()))
      .find((c) => /^(strong|standard|light)$/.test(c[1] || "") && (c[3] || "").toLowerCase() === brief.toLowerCase());
    if (row) { tier = row[1]; break; }
  }
}
const logFile = path.join(root, "docs", "BUILD-LOG.md");
const model = a.model || "?", tokens = a.tokens ? `${a.tokens} tokens` : "tokens not shown", result = a.result || "ok";
const parts = [stamp(), `${id} ${slice.title}`, model, result, tokens];
if (a.profile) parts.push(a.profile);
parts.push(harness, helper, tier || "tier ?");
if (a.note) parts.push(a.note);
const line = "- " + parts.join(" · ");
{
  const { lines, eol } = readText(logFile);
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  lines.push(line, "");
  writeText(logFile, lines, eol);
}

// 5. Overview and commit.
const overview = writeOverview(root);
if (!a["no-commit"]) {
  git("add", "docs");
  git("commit", "-q", "-m", `${id} done: roadmap, log${ideasFlipped ? ", ideas" : ""}${debtPaid ? ", debt" : ""}`);
}
console.log(`✓ ${id} ${slice.title} · ${model} · ${tokens}${ideasFlipped ? ` · ${ideasFlipped} idea(s) ✅` : ""}${debtPaid ? ` · ${debtPaid} debt line(s) paid` : ""}${overview ? "" : " · (no overview markers in ROADMAP.md)"}`);
