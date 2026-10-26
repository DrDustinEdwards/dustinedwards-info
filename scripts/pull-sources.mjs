// node scripts/pull-sources.mjs [--local|--remote|--preview]: write D1's content source over the checkout, so a
// build reads what the site holds, not the repository's seed (scripts/lib/content-source.mjs). A file D1 does not
// hold is removed: a save deleted it, and building it would put it back. What was written goes in PULL_MANIFEST
// with its blob sha and the day D1 last changed it, which the clean-tree checks and the source dates read.
//
// `--restore` puts the checkout back as git has it and removes the manifest. Ship runs it when it exits.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { blobSha, isSourcePath, jsonRows, PULL_MANIFEST, readPullManifest, ROOT, SOURCE_PATHS } from "./lib/content-source.mjs";
import { resolveD1Address } from "./lib/d1-address.mjs";
import { runWrangler } from "./lib/wrangler-run.mjs";

const git = (/** @type {string[]} */ args) =>
  execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

if (process.argv.includes("--restore")) {
  const pulled = readPullManifest();
  if (!pulled) {
    console.log("pull-sources: no pull to restore.");
    process.exit(0);
  }
  const tracked = new Set(git(["ls-files", "--", ...SOURCE_PATHS]).split("\n").filter(Boolean));
  const back = Object.keys(pulled).filter((file) => tracked.has(file));
  if (back.length > 0) git(["checkout", "--", ...back]);
  for (const file of Object.keys(pulled)) if (!tracked.has(file)) rmSync(path.join(ROOT, file), { force: true });
  rmSync(path.join(ROOT, PULL_MANIFEST), { force: true });
  console.log(`pull-sources: restored ${Object.keys(pulled).length} file(s) to the repository's copy.`);
  process.exit(0);
}

const PREVIEW = process.argv.includes("--preview");
const DB_NAME = PREVIEW ? "dustinedwards-preview" : "dustinedwards";
const target = PREVIEW || process.argv.includes("--remote") ? "--remote" : "--local";

/** @type {Array<{ path: string, content: string, sha: string, updated_at: number }>} */
const rows = jsonRows(
  runWrangler(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command "SELECT path, content, sha, updated_at FROM source_files;"`,
  ),
  "the source read",
);
// An empty store is a seed that never ran: pulling it would delete every file and build an empty site.
if (rows.length === 0) throw new Error("pull-sources: D1 holds no source files. Run node scripts/seed-sources.mjs first; nothing was written.");

/** @type {Record<string, { sha: string | null, day: string | null }>} */
const files = {};
let changed = 0;
for (const row of rows) {
  if (!isSourcePath(row.path)) throw new Error(`pull-sources: D1 holds ${row.path}, which is outside the source paths; nothing was written.`);
  if (blobSha(row.content) !== row.sha) throw new Error(`pull-sources: ${row.path} does not hash to its stored sha ${row.sha}; the read was cut short.`);
}
for (const row of rows) {
  const at = path.join(ROOT, row.path);
  let before = null;
  try {
    before = readFileSync(at, "utf8");
  } catch {
    before = null;
  }
  if (before !== row.content) {
    mkdirSync(path.dirname(at), { recursive: true });
    writeFileSync(at, row.content, "utf8");
    changed += 1;
  }
  files[row.path] = { sha: row.sha, day: new Date(row.updated_at * 1000).toISOString().slice(0, 10) };
}
const held = new Set(rows.map((r) => r.path));
const gone = git(["ls-files", "--", ...SOURCE_PATHS]).split("\n").filter((file) => file && !held.has(file));
for (const file of gone) {
  rmSync(path.join(ROOT, file), { force: true });
  files[file] = { sha: null, day: null };
}

writeFileSync(path.join(ROOT, PULL_MANIFEST), `${JSON.stringify({ pulled: new Date().toISOString(), target: target.slice(2), files }, null, 2)}\n`, "utf8");
console.log(`pull-sources: ${rows.length} file(s) from ${target.slice(2)} D1, ${changed} differing from the checkout, ${gone.length} removed.`);
