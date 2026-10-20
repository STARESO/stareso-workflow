// Hook: tells a running Claude Code session that the stareso workflow changed since it last looked.
//
// Registered in the user's ~/.claude/settings.json (SessionStart, UserPromptSubmit, PostToolUse on Agent):
//   node "$HOME/.claude/stareso/tools/workflow-changed.mjs"
//
// Keeps the workflow repository's HEAD per session in the temp folder. Silent while nothing changed; when the
// HEAD moved, injects one note into the session (commits since, changed skills, agents and packs) so the
// conductor re-reads the skill it is running instead of following the copy loaded earlier. Never fails a prompt.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.join(os.homedir(), ".claude");
const STATE = path.join(os.tmpdir(), "stareso-sessions");
const git = (...args) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

try {
  const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  const session = String(input.session_id || "").replace(/[^\w-]/g, "");
  if (!session) process.exit(0);
  const head = git("rev-parse", "HEAD");
  fs.mkdirSync(STATE, { recursive: true });
  const file = path.join(STATE, `${session}.head`);
  const seen = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "";
  fs.writeFileSync(file, head);
  if (!seen || seen === head) process.exit(0);

  let commits = [], files = [];
  try {
    commits = git("log", "--format=%h %s", `${seen}..${head}`).split("\n").filter(Boolean);
    files = git("diff", "--name-only", seen, head).split("\n").filter(Boolean);
  } catch { /* the old HEAD is gone (rewritten history): report the change without details */ }
  const skills = [...new Set(files.filter((f) => f.startsWith("skills/")).map((f) => f.split("/")[1]))];
  const agents = files.filter((f) => f.startsWith("agents/")).map((f) => path.basename(f, ".md"));
  const shared = files.filter((f) => f.startsWith("stareso/") && !f.startsWith("stareso/tools/"));

  const lines = [
    `The stareso workflow changed since this session last checked (${commits.length || "some"} commit(s)):`,
    ...commits.slice(0, 8).map((c) => `- ${c}`),
    ...(commits.length > 8 ? [`- … ${commits.length - 8} more`] : []),
  ];
  if (skills.length) lines.push(`Changed skills: ${skills.join(", ")}. If one of them is running in this session, re-read ~/.claude/skills/<name>/SKILL.md now and follow the new text from the next step on.`);
  if (shared.length) lines.push(`Changed shared files: ${shared.slice(0, 8).join(", ")}${shared.length > 8 ? ", …" : ""}. Re-read the ones the current step relies on.`);
  if (agents.length) lines.push(`Changed helper definitions: ${agents.join(", ")}. Helpers started from this session may still use the definition loaded when it started: tell the user once, and suggest a new session for the next build.`);
  if (!skills.length && !shared.length && !agents.length) lines.push("Only tools changed: they are read from disk at each run, nothing to re-read.");
  lines.push("Mention this to the user in one line; do not re-run steps already done.");

  const event = input.hook_event_name || "UserPromptSubmit";
  process.stdout.write(JSON.stringify({
    systemMessage: `stareso workflow updated (${commits.length || "?"} commit(s)); this session will use the new version.`,
    hookSpecificOutput: { hookEventName: event, additionalContext: lines.join("\n") },
  }));
} catch {
  process.exit(0);
}
