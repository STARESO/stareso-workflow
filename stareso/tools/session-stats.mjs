// Token and model usage from Claude Code transcripts (JSONL under the Claude projects folder).
//
// Modes:
//   --log            from inside a stareso project: finds every session of this project (and of its worktrees),
//                    with their helper agents, and appends the sessions that changed to docs/data/sessions.jsonl
//                    (one line per session, the last line per session wins). Run at the end of a build or a test.
//                    A project with no docs/data/ is migrated first (migrate-records.mjs).
//                    `--log --dry-run` prints the tables and writes nothing.
//   --print          the usage tables (sessions, steps, totals, cost per slice, planning cost, details) from the
//                    records only, without reading the transcripts
//   --prune [--days 7] [--yes]   saves the sessions as --log does, then lists the conversation logs (and their helpers'
//                    logs) older than --days; --yes deletes them. Their usage stays in docs/data/sessions.jsonl.
//   <out> <files…>   deep retro: one summary line per transcript on stdout and, in <out>/, a text file per
//                    transcript with the header (models, tokens, tools) and the timeline of the user's messages.
//
// Prints prompts only (deep mode); never file contents or tool results. The records hold numbers only: no paths, no names.
import fs from "node:fs";
import path from "node:path";
import { collect, equiv, fmt, localIso, model, modelsText, PROJECTS, renderBlock, summarise, transcriptDirs } from "./lib/usage.mjs";
import { needMigrated, saveSessions, sessionsFile } from "./lib/records.mjs";

function docsRoot() {
  let root = process.cwd();
  while (!fs.existsSync(path.join(root, "docs")) && path.dirname(root) !== root) root = path.dirname(root);
  if (!fs.existsSync(path.join(root, "docs"))) { console.error("No docs/ folder: run from inside a stareso project."); process.exit(1); }
  return root;
}

async function logMode(dryRun) {
  const root = docsRoot();
  const entries = await collect(root, { live: true });
  if (!entries.length) { console.error("No transcripts found for this project."); process.exit(1); }
  const m = model(root, entries);
  const block = renderBlock(m);
  if (dryRun) { console.log(block.join("\n")); return; }
  const keep = ({ id, s, steps, h, inWorktree, wf, seeded }) => ({ id, s, steps, h, inWorktree, wf, ...(seeded ? { seeded } : {}) });
  needMigrated(root);
  const changed = saveSessions(root, entries.filter((e) => !e.gone || e.rescued).map(keep));
  console.log(`${m.rows.length} sessions (${m.wfRows.length} workflow), ≈ ${fmt(Math.round(m.totals.equiv))} · ${changed} line${changed === 1 ? "" : "s"} added to ${path.relative(root, sessionsFile(root)).replace(/\\/g, "/")}`);
}

// The conversation logs of this project's chats older than <days> days (and their helpers' logs), once the sessions
// dataset holds their usage: it saves every session first, as --log does, then lists the logs. They are deleted only
// with --yes. A deleted chat can no longer be reopened in the app nor read by a deep retro: its usage stays in the records.
async function pruneMode(days, yes) {
  const root = docsRoot();
  needMigrated(root);
  const entries = await collect(root, { live: true });
  const keep = ({ id, s, steps, h, inWorktree, wf, seeded }) => ({ id, s, steps, h, inWorktree, wf, ...(seeded ? { seeded } : {}) });
  const added = saveSessions(root, entries.filter((e) => !e.gone || e.rescued).map(keep));
  const cutoff = Date.now() - days * 864e5;
  const old = [];
  for (const d of transcriptDirs(root).dirs) {
    const dir = path.join(PROJECTS, d);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
      const file = path.join(dir, f), folder = path.join(dir, f.slice(0, -6));
      if (fs.statSync(file).mtimeMs > cutoff) continue;
      const size = (p) => { const st = fs.statSync(p); return st.isDirectory() ? fs.readdirSync(p).reduce((a, x) => a + size(path.join(p, x)), 0) : st.size; };
      const e = entries.find((x) => x.id === f.slice(0, -6));
      old.push({ file, folder, bytes: size(file) + (fs.existsSync(folder) ? size(folder) : 0), label: e ? `${e.s.first.slice(0, 16).replace("T", " ")} · ${e.s.kind || "chat"} · ${e.s.assistant} turns` : "no assistant turn" });
    }
  }
  console.log(`${added} session line${added === 1 ? "" : "s"} saved to docs/data/sessions.jsonl (commit docs/data/).`);
  if (!old.length) { console.log(`No conversation log older than ${days} days.`); return; }
  console.log(old.map((o) => `  ${o.label} · ${fmt(o.bytes)}B`).join("\n"));
  const total = fmt(old.reduce((a, o) => a + o.bytes, 0));
  if (!yes) { console.log(`${old.length} logs older than ${days} days, ${total}B: run again with --yes to delete them (those chats can no longer be reopened).`); return; }
  for (const o of old) { fs.rmSync(o.file, { force: true }); if (fs.existsSync(o.folder)) fs.rmSync(o.folder, { recursive: true, force: true }); }
  console.log(`Deleted ${old.length} conversation logs, ${total}B. Their usage stays in docs/data/sessions.jsonl.`);
}

async function printMode() {
  const root = docsRoot();
  console.log(renderBlock(model(root, await collect(root, { live: false }))).join("\n"));
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
if (argv[0] === "--log") await logMode(argv.includes("--dry-run"));
else if (argv[0] === "--print") await printMode();
else if (argv[0] === "--prune") await pruneMode(Number(argv[argv.indexOf("--days") + 1]) > 0 && argv.includes("--days") ? Number(argv[argv.indexOf("--days") + 1]) : 7, argv.includes("--yes"));
else if (argv.length >= 2) await deepMode(argv[0], argv.slice(1));
else { console.error("usage: session-stats.mjs --log [--dry-run]   |   session-stats.mjs --print   |   session-stats.mjs --prune [--days 7] [--yes]   |   session-stats.mjs <out-dir> <transcript.jsonl>…"); process.exit(1); }
