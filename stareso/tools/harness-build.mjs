// Generates the Claude Code skills and agents from the harness-neutral core, so a step never reads
// capabilities/, harness/ or models.md while it runs: every Claude Code file is self-contained.
//
// Sources: stareso/skills/<name>/SKILL.md (steps), stareso/roles/<role>.md (helpers), and
// stareso/harness/claude-code/: models.md (tiers → model names), extras/wording.md (phrase table),
// extras/blocks.md (passages marked <!-- harness:<id> -->), extras/skill-frontmatter.json, extras/agent-heads.json.
// Output: ~/.claude/skills/<name>/SKILL.md and ~/.claude/agents/<agent>.md (tracked in this repository).
//
// Usage: node ~/.claude/stareso/tools/harness-build.mjs            writes the files, prints chars before → after
//        node ~/.claude/stareso/tools/harness-build.mjs --check    writes nothing, exits 1 when a file would change
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STARESO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.dirname(STARESO);
const HARNESS = path.join(STARESO, "harness", "claude-code");
const check = process.argv.includes("--check");
const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const warnings = [];

// Markdown table rows → arrays of cells (header and separator rows dropped).
const tableRows = (text) => text.split("\n").filter((l) => /^\|.*\|$/.test(l) && !/^\|[-| ]+\|$/.test(l))
  .map((l) => l.slice(1, -1).split(" | ").map((c) => c.trim())).slice(1);

// models.md: | Tier | Prose | Id | Used for |
const tiers = {};
for (const [tier, prose, id] of tableRows(read(path.join(HARNESS, "models.md")))) if (/^(strong|standard|light)$/.test(tier)) tiers[tier] = { prose, id };
if (Object.keys(tiers).length !== 3) throw new Error("models.md must map strong, standard and light");
const fill = (s) => s.replace(/\{tier-map\}/g, Object.entries(tiers).map(([t, m]) => `${t} = ${m.id}`).join(", "))
  .replace(/\{(strong|standard|light)\.id\}/g, (_, t) => tiers[t].id);

// extras/blocks.md: "## <id>" then a ```text fence holding the replacement (without its last newline).
const blocks = {};
for (const m of read(path.join(HARNESS, "extras", "blocks.md")).matchAll(/^## (\S+)\n[\s\S]*?```text\n([\s\S]*?)\n?```/gm)) blocks[m[1]] = fill(m[2]);
const wording = tableRows(read(path.join(HARNESS, "extras", "wording.md"))).map(([a, b]) => [a, fill(b)]).sort((x, y) => y[0].length - x[0].length);
const used = new Set();

function convert(text, where) {
  let out = text.replace(/<!-- harness:([\w-]+) -->([\s\S]*?)<!-- \/harness -->/g, (all, id, neutral) => {
    if (!(id in blocks)) { warnings.push(`${where}: no Claude Code block "${id}", neutral text kept`); return neutral; }
    used.add(`block:${id}`);
    return blocks[id];
  });
  for (const [a, b] of wording) if (out.includes(a)) { out = out.split(a).join(b); used.add(a); }
  const T = "(strong|standard|light)";
  out = out
    .replace(new RegExp("`tier: " + T + "`", "g"), (_, t) => "`model: " + tiers[t].id + "`")
    .replace(new RegExp("\\b(?:[Tt]he )?" + T + " tier\\b", "gi"), (_, t) => tiers[t.toLowerCase()].prose)
    .replace(new RegExp("\\b" + T + "-tier model\\b", "g"), (_, t) => `${tiers[t].prose}-class model`)
    .replace(new RegExp("`" + T + "`", "g"), (_, t) => "`" + tiers[t].id + "`");
  for (const left of ["<stareso", "AGENTS.md", "<!-- harness", "-tier", "<model>"]) if (out.includes(left)) warnings.push(`${where}: "${left}" left in the output`);
  return out;
}

const split = (raw, file) => {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`${file}: no frontmatter`);
  return { fm: Object.fromEntries(m[1].split("\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()])), body: m[2] };
};

const outputs = [];
const frontmatter = JSON.parse(read(path.join(HARNESS, "extras", "skill-frontmatter.json")));
for (const name of fs.readdirSync(path.join(STARESO, "skills")).sort()) {
  const file = path.join(STARESO, "skills", name, "SKILL.md");
  const { fm, body } = split(read(file), file);
  if (fm.name !== name) throw new Error(`${file}: name "${fm.name}" differs from its folder`);
  const head = [`name: ${fm.name}`, `description: ${convert(fm.description, name)}`, ...(frontmatter[name] || [])];
  outputs.push({ file: path.join(ROOT, "skills", name, "SKILL.md"), text: `---\n${head.join("\n")}\n---\n${convert(body, name)}` });
}
for (const [agent, { role, tools }] of Object.entries(JSON.parse(read(path.join(HARNESS, "extras", "agent-heads.json"))))) {
  const file = path.join(STARESO, "roles", `${role}.md`);
  const { fm, body } = split(read(file), file);
  if (!tiers[fm.tier]) throw new Error(`${file}: tier "${fm.tier}" is not strong, standard or light`);
  const head = [`name: ${fm.name}`, `description: ${convert(fm.description, role)}`, `model: ${tiers[fm.tier].id}`, `tools: ${tools}`];
  outputs.push({ file: path.join(ROOT, "agents", `${agent}.md`), text: `---\n${head.join("\n")}\n---\n${convert(body, role)}` });
}

for (const [a] of wording) if (!used.has(a)) warnings.push(`wording.md: "${a}" no longer occurs in the core`);
for (const id of Object.keys(blocks)) if (!used.has(`block:${id}`)) warnings.push(`blocks.md: "${id}" no longer occurs in the core`);

// The read guard: every folder of capabilities/read-guard.md must be denied by templates/settings.json.
const deny = JSON.parse(read(path.join(STARESO, "templates", "settings.json"))).permissions.deny.join(" ");
const guarded = [...read(path.join(STARESO, "capabilities", "read-guard.md")).matchAll(/^- `([^`]+)`( \(analysis packs\))?$/gm)].map((m) => m[1]);
for (const g of guarded) if (!g.startsWith("data/") && !deny.includes(`./${g.replace(/\*$/, "")}`)) warnings.push(`templates/settings.json does not deny ${g}`);

let drift = 0;
for (const { file, text } of outputs) {
  const old = fs.existsSync(file) ? read(file) : "";
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (old === text) { if (!check) console.log(`  ${rel} · ${text.length} chars, unchanged`); continue; }
  drift++;
  const pct = old ? ` (${text.length >= old.length ? "+" : ""}${(100 * (text.length - old.length) / old.length).toFixed(1)} %)` : "";
  console.log(`${check ? "drift" : "wrote"} ${rel} · ${old.length} → ${text.length} chars${pct}`);
  if (!check) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
}
for (const w of warnings) console.log(`warning: ${w}`);
if (check) console.log(drift ? `${drift} generated file(s) differ from the core: run harness-build.mjs` : "Claude Code files match the core.");
process.exit(check && (drift || warnings.length) ? 1 : 0);
