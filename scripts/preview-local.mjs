// `npm run preview:local`: build, then serve the build on http://localhost:4173 until Ctrl+C.
//
// It never touches wrangler.jsonc. PREVIEW_LOCAL=1 is set in the build's and the server's
// environment only, and vite.config.ts leaves AI_SEARCH and IMAGES out of that build, the two
// bindings that would otherwise need a Cloudflare token for a remote proxy session.
//
// Every child is recorded in .gate-pids/preview-local.jsonl as it starts. A normal exit, Ctrl+C or
// an uncaught error kills the tree and clears the record; a crash that runs no handler at all
// leaves the record, and the next run's preflight kills what it names before building.

import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ChildRegistry,
  descendantPids,
  killTree,
  normaliseCommand,
  readProcessTable,
} from "./lib/child-processes.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4173;
const SERVER_NEEDLES = ["vite", "preview", String(PORT)];
const env = { ...process.env, PREVIEW_LOCAL: "1" };

const registry = new ChildRegistry(join(root, ".gate-pids", "preview-local.jsonl"));

{
  const swept = registry.preflight();
  const parts = [`${swept.cleared} cleared`, `${swept.stale} stale`, `${swept.reused} reused`];
  if (swept.failed > 0) parts.push(`${swept.failed} FAILED TO KILL`);
  if (swept.unverifiable > 0) parts.push(`${swept.unverifiable} unverifiable`);
  console.log(`preview:local: last run's children, ${parts.join(", ")}`);
  for (const note of swept.notes) console.log(`  ${note}`);
  if (swept.failed > 0) {
    console.error("preview:local REFUSED: a leftover from the last run could not be killed.");
    process.exit(1);
  }
}
registry.record(process.pid, "the preview:local command", ["preview-local.mjs"]);

/** @type {import("node:child_process").ChildProcess | null} */
let server = null;

function cleanup() {
  if (server?.pid) killTree(server.pid);
  registry.clear();
}

/** @param {number} code */
function stop(code) {
  cleanup();
  process.exit(code);
}

process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));
process.on("SIGHUP", () => stop(129));
process.on("uncaughtException", (error) => {
  console.error(error);
  stop(1);
});
process.on("exit", cleanup);

console.log("preview:local: building with PREVIEW_LOCAL=1 (no AI_SEARCH, no IMAGES) ...");
const built = spawnSync("npm", ["run", "build"], { cwd: root, env, shell: true, stdio: "inherit" });
if (built.status !== 0) {
  console.error(`preview:local: the build failed (exit ${built.status ?? "on a signal"}).`);
  stop(1);
}

// `--strictPort`, or vite binds the next port and a stale server keeps answering on this one.
server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: root,
  env,
  shell: true,
  stdio: "inherit",
});
// The spawned pid is a shell above vite; its tree is what the kill takes.
registry.record(server.pid, "the vite preview server", SERVER_NEEDLES);

// Descendants are recorded too, so a crash that also takes the shell still leaves vite named.
const recorded = new Set();
const recordSurvivors = () => {
  if (!server?.pid) return;
  const table = readProcessTable();
  for (const pid of descendantPids(server.pid, table)) {
    const live = table.get(pid);
    if (recorded.has(pid) || !live) continue;
    if (!SERVER_NEEDLES.every((needle) => live.command.includes(normaliseCommand(needle)))) continue;
    registry.record(pid, "the vite preview server", SERVER_NEEDLES);
    recorded.add(pid);
  }
};
const survivorTimer = setInterval(recordSurvivors, 5000);

server.on("exit", (code, signal) => {
  clearInterval(survivorTimer);
  console.log(`preview:local: the server exited (code ${code}, signal ${signal}).`);
  stop(code ?? 1);
});
