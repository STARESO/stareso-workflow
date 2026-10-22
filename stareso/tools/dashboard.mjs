// Live stareso dashboard: a small local server for the side browser of the Claude desktop app (or any browser). It serves
// dashboard.html, which draws the progress graph and the six usage charts of /stareso-usage with Chart.js, and /data,
// which the page fetches every minute. No model call: /data is progress-graph.mjs --panel (read again after 50 s at
// most) and usage-report.mjs --live --panel (read in the background once five minutes old or after a merge).
//
// Usage:  node ~/.claude/stareso/tools/dashboard.mjs [--root <project>] [--port <n>] [--idle <minutes>]
//         The port defaults to one derived from the project folder, so each project keeps its own address. A second
//         start on a port that already serves the same project prints its address and exits. The server stops after
//         --idle minutes without a request (120 by default). It never writes in the project.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { args, findRoot } from "./lib/roadmap.mjs";

const opt = args(process.argv.slice(2));
const root = findRoot(opt.root ? path.resolve(opt.root) : process.cwd());
const here = path.dirname(fileURLToPath(import.meta.url));
const hash = [...root.toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const port = Number(opt.port) || 4500 + (hash % 400);
const idleMs = (Number(opt.idle) || 120) * 60e3;
const page = path.join(here, "dashboard.html");

const run = (script, argv) => new Promise((resolve) => {
  execFile(process.execPath, [path.join(here, script), ...argv], { cwd: root, maxBuffer: 64 << 20, timeout: 120e3, windowsHide: true },
    (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout, stderr }));
});
// the error itself, not the source line Node prints before it
const errorLine = (text) => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => /^\w*Error: /.test(l)) ?? lines[0] ?? "").replace(/^\w*Error: /, "").slice(0, 200);
};

let snap = null, snapAt = 0, snapError = "", snapping = null;
let usage = null, tables = "", usageAt = 0, usageMerge = null, usageError = "", reading = null;

async function readSnap() {
  if (snap && Date.now() - snapAt < 50e3) return;
  snapping ??= run("progress-graph.mjs", ["--root", root, "--panel", "--max-lanes", "99"]).then((r) => {
    if (r.code === 0) { snap = JSON.parse(r.stdout); snapAt = Date.now(); snapError = ""; } else snapError = errorLine(r.stderr);
  }).finally(() => { snapping = null; });
  await snapping;
}

// the usage report takes a few seconds: the page gets the last one at once, and the next when it is ready
function readUsage(force) {
  const merge = snap?.recentMerges?.[0]?.id ?? "";
  if (reading || (!force && usage && Date.now() - usageAt < 5 * 60e3 && merge === usageMerge)) return;
  reading = run("usage-report.mjs", ["--live", "--panel"]).then((r) => {
    usageAt = Date.now(); usageMerge = merge;
    if (r.code === 0) { const j = JSON.parse(r.stdout); usage = j.charts; tables = j.tables; usageError = ""; } else usageError = errorLine(`${r.stderr}\n${r.stdout}`);
  }).finally(() => { reading = null; });
}

let lastRequest = Date.now();
setInterval(() => { if (Date.now() - lastRequest > idleMs) process.exit(0); }, 60e3).unref();

const server = http.createServer(async (req, res) => {
  lastRequest = Date.now();
  const url = new URL(req.url, "http://localhost");
  const send = (code, type, body) => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
  try {
    if (url.pathname === "/") return send(200, "text/html; charset=utf-8", fs.readFileSync(page));
    if (url.pathname === "/health") return send(200, "application/json", JSON.stringify({ stareso: true, root }));
    if (url.pathname === "/data") {
      await readSnap();
      readUsage(url.searchParams.has("force"));
      return send(200, "application/json", JSON.stringify({
        root, at: Date.now(), snap, snapError, usage, tables, usageAt, usageError, usageReading: reading != null,
      }));
    }
    send(404, "text/plain", "not found");
  } catch (err) {
    send(500, "text/plain", String(err));
  }
});

server.on("error", async (err) => {
  if (err.code !== "EADDRINUSE") throw err;
  // the port is taken: by this project's own dashboard (say where it is), or by something else
  try {
    const h = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    if (h.stareso && h.root === root) { console.log(`stareso dashboard already running on http://127.0.0.1:${port}`); process.exit(0); }
  } catch { /* not ours */ }
  console.error(`Error: port ${port} is taken: pass --port <n>.`);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => console.log(`stareso dashboard on http://127.0.0.1:${port} for ${root}`));
