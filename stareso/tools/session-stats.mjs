// Session statistics from Claude Code transcripts (JSONL in ~/.claude/projects/<project>/).
// Prints, per session and per helper (subagent) file: dates, turns, models, exact token usage
// (cache read / cache write / output), tool counts, and a timeline of the user's own messages
// (first 220 characters) so a retro can see the real sequence of events without reading the transcript.
//
// Usage:
//   node ~/.claude/stareso/tools/session-stats.mjs <out-dir> <transcript.jsonl>...
//   node ~/.claude/stareso/tools/session-stats.mjs out ~/.claude/projects/D--…-scriba/*.jsonl
//   helpers:  … out $(find ~/.claude/projects/D--…-scriba -mindepth 2 -name '*.jsonl')
// One summary line per file on stdout; the full header and timeline in <out-dir>/<name>.txt.
// Prints prompts only; never file contents or tool results.
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";

const [, , outDir, ...files] = process.argv;
if (!outDir || files.length === 0) {
  console.error("usage: session-stats.mjs <out-dir> <transcript.jsonl>...");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const totals = { files: 0, user: 0, assistant: 0, agents: 0, output: 0, cache_read: 0, cache_create: 0 };

for (const file of files) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const s = { first: null, last: null, models: {}, tools: {}, user: 0, assistant: 0, agents: 0, compactions: 0, skills: {},
    usage: { input: 0, cache_read: 0, cache_create: 0, output: 0 }, timeline: [] };
  const t = (ts) => (ts || "").slice(5, 16);
  for await (const line of rl) {
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.timestamp) { s.first ??= o.timestamp; s.last = o.timestamp; }
    if (o.isCompactSummary) s.compactions++;
    const m = o.message; if (!m) continue;
    if (o.type === "user") {
      const c = m.content;
      const texts = typeof c === "string" ? [c] : Array.isArray(c) ? c.filter((p) => p.type === "text" && !o.isMeta).map((p) => p.text) : [];
      for (const txt of texts) { s.user++; s.timeline.push(`${t(o.timestamp)} U ${txt.replace(/\s+/g, " ").slice(0, 220)}`); }
    } else if (o.type === "assistant") {
      s.assistant++;
      if (m.model) s.models[m.model] = (s.models[m.model] || 0) + 1;
      if (m.usage) {
        s.usage.input += m.usage.input_tokens || 0;
        s.usage.cache_read += m.usage.cache_read_input_tokens || 0;
        s.usage.cache_create += m.usage.cache_creation_input_tokens || 0;
        s.usage.output += m.usage.output_tokens || 0;
      }
      for (const p of m.content || []) {
        if (p.type !== "tool_use") continue;
        s.tools[p.name] = (s.tools[p.name] || 0) + 1;
        if (p.name === "Agent" || p.name === "Task") { s.agents++; s.timeline.push(`${t(o.timestamp)} A ${p.input?.subagent_type || "?"} ${(p.input?.description || "").slice(0, 80)}`); }
        if (p.name === "Skill") { const k = p.input?.skill; s.skills[k] = (s.skills[k] || 0) + 1; s.timeline.push(`${t(o.timestamp)} S ${k}`); }
      }
    }
  }
  const name = path.basename(path.dirname(file)).replace(/^D--documents-work-stareso-applications-/i, "") + "_" + path.basename(file, ".jsonl");
  const hours = s.first && s.last ? ((new Date(s.last) - new Date(s.first)) / 3.6e6).toFixed(1) : "?";
  const avgCtx = Math.round(s.usage.cache_read / Math.max(1, s.assistant) / 1000);
  const hdr = { file: name, first: s.first, last: s.last, hours, user: s.user, assistant: s.assistant, agents: s.agents, compactions: s.compactions,
    avgContextK: avgCtx, models: s.models, usage: s.usage, skills: s.skills, tools: s.tools };
  fs.writeFileSync(path.join(outDir, name + ".txt"), JSON.stringify(hdr, null, 1) + "\n\n" + s.timeline.join("\n") + "\n");
  console.log(`${name} · ${t(s.first)} → ${t(s.last)} (${hours} h) · user ${s.user} · turns ${s.assistant} · agents ${s.agents} · ctx ${avgCtx}k/turn · out ${s.usage.output} · cacheRead ${s.usage.cache_read} · cacheWrite ${s.usage.cache_create} · ${JSON.stringify(s.models)}`);
  totals.files++; totals.user += s.user; totals.assistant += s.assistant; totals.agents += s.agents;
  totals.output += s.usage.output; totals.cache_read += s.usage.cache_read; totals.cache_create += s.usage.cache_create;
}
// Input-token equivalents: cache read 0.1, cache write 1.25, output 5 (relative list prices; not dollars).
const equiv = Math.round(totals.cache_read * 0.1 + totals.cache_create * 1.25 + totals.output * 5);
console.log(`TOTAL ${totals.files} files · user ${totals.user} · turns ${totals.assistant} · agents ${totals.agents} · out ${totals.output} · cacheRead ${totals.cache_read} · cacheWrite ${totals.cache_create} · ≈ ${equiv} input-token equivalents`);
