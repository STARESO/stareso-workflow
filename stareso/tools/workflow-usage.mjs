// What the stareso workflow itself costs to keep up: the chats run in ~/.claude (retro chats that change the workflow,
// the panel, the tools), which no project's usage counts. Numbers only: no titles, no prompts.
//
// Usage:  node ~/.claude/stareso/tools/workflow-usage.mjs          one line per chat (helpers included) and the total
//         node ~/.claude/stareso/tools/workflow-usage.mjs --log    also keeps them in ~/.claude/stareso/data/
//                                                                  workflow-sessions.jsonl, so a chat whose transcript
//                                                                  is deleted later still counts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GLOBAL_DATA, readJsonl, writeJsonl } from "./lib/records.mjs";
import { PROJECTS, equiv, fmt, hours, summarise } from "./lib/usage.mjs";

// the transcripts folder of ~/.claude, named as Claude Code names it: every character but letters and digits a dash
const dir = path.join(PROJECTS, path.join(os.homedir(), ".claude").replace(/[^A-Za-z0-9]/g, "-"));
const file = path.join(GLOBAL_DATA, "workflow-sessions.jsonl");

const kept = Object.fromEntries(readJsonl(file).map((e) => [e.id, e]));
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl")) : []) {
  const s = await summarise(path.join(dir, f));
  if (!s.assistant) continue;
  // the chat's helpers, in <id>/subagents/
  const hDir = path.join(dir, f.slice(0, -6), "subagents");
  let helpers = 0;
  for (const h of fs.existsSync(hDir) ? fs.readdirSync(hDir).filter((x) => x.endsWith(".jsonl")) : []) helpers += equiv((await summarise(path.join(hDir, h))).usage);
  kept[s.id] = { id: s.id, first: s.first, last: s.last, active: s.active, turns: s.assistant, equiv: Math.round(equiv(s.usage)), helpers: Math.round(helpers) };
}

const rows = Object.values(kept).sort((a, b) => (a.first || "").localeCompare(b.first || ""));
if (process.argv.includes("--log")) writeJsonl(file, rows);
let total = 0;
for (const e of rows) {
  total += e.equiv + e.helpers;
  console.log(`${(e.first || "").slice(0, 10)}  ${e.id.slice(0, 8)}  ${hours(e.active).padStart(5)} h  ${String(e.turns).padStart(5)} turns  ≈ ${fmt(e.equiv + e.helpers).padStart(6)}`);
}
console.log(`workflow upkeep: ${rows.length} chats, ≈ ${fmt(total)} equiv (cache read × 0.1 + cache write × 1.25 + output × 5)`);
