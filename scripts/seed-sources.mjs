// node scripts/seed-sources.mjs [--local|--remote|--preview]: copy the repository's content files into D1's
// source_files, each with its git history as source_revisions, for every path D1 has never held. D1 is the source
// from then on, so a path it holds, or one a save deleted, is never written again from here. sync:content runs this
// first, and ship runs it before the pull (scripts/lib/content-source.mjs).
//
// "Never held" is: no source_files row, and no revision a save made (author admin, carrel or operator). Revisions of
// such a path can only be the leftovers of a seed that stopped half way, so they are removed and the path seeded
// again. A shallow clone has one commit, so its history is the one version.

import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blobSha, jsonRows, ROOT, SOURCE_PATHS } from "./lib/content-source.mjs";
import { resolveD1Address } from "./lib/d1-address.mjs";
import { sqlLiteral as sql } from "./lib/sql-literal.mjs";
import { splitOversizeStatements } from "./lib/split-statements.mjs";
import { runWrangler } from "./lib/wrangler-run.mjs";

const PREVIEW = process.argv.includes("--preview");
const DB_NAME = PREVIEW ? "dustinedwards-preview" : "dustinedwards";
const target = PREVIEW || process.argv.includes("--remote") ? "--remote" : "--local";

const git = (/** @type {string[]} */ args) =>
  execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

/** A path's versions, oldest first: each commit that touched it, and the file as that commit left it (null: deleted). */
function history(/** @type {string} */ file) {
  const log = git(["log", "--no-renames", "--format=%H%x09%an%x09%ct%x09%s", "--", file]).trim().split("\n").filter(Boolean).reverse();
  return log.map((line) => {
    const [sha, author, seconds, ...subject] = line.split("\t");
    let content = null;
    try {
      content = git(["show", `${sha}:${file}`]);
    } catch {
      content = null;
    }
    return { author: author ?? "", at: Number(seconds), message: subject.join("\t"), content };
  });
}

const read = (/** @type {string} */ query, /** @type {string} */ what) =>
  jsonRows(runWrangler(`d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command "${query}"`), what);

const held = new Set(
  read(
    "SELECT path FROM source_files UNION SELECT path FROM source_revisions WHERE author IN ('admin', 'carrel', 'operator');",
    "the held paths read",
  ).map((/** @type {{ path: string }} */ r) => r.path),
);

const tracked = git(["ls-files", "--", ...SOURCE_PATHS]).split("\n").filter(Boolean);
const fresh = tracked.filter((file) => !held.has(file));

if (fresh.length === 0) {
  console.log(`seed-sources: D1 holds all ${tracked.length} source file(s) already; nothing seeded.`);
  process.exit(0);
}

/** @type {string[]} */
const statements = [`DELETE FROM source_revisions WHERE path IN (${fresh.map(sql).join(", ")});`];
let versions = 0;
for (const file of fresh) {
  const now = git(["show", `HEAD:${file}`]);
  const past = history(file);
  // The last version must be the committed file, whatever the log said.
  if (past.length === 0 || past[past.length - 1]?.content !== now) past.push({ author: "seed", at: Math.floor(Date.now() / 1000), message: "Seed", content: now });
  for (const version of past) {
    versions += 1;
    const sha = version.content === null ? null : blobSha(version.content);
    statements.push(
      `INSERT INTO source_revisions (path, content, sha, message, author, created_at) VALUES (` +
        `${sql(file)}, ${sql(version.content)}, ${sql(sha)}, ${sql(version.message)}, ${sql(version.author)}, ${version.at});`,
    );
  }
  statements.push(
    `INSERT INTO source_files (path, content, sha, revision, updated_at) SELECT path, content, sha, id, created_at ` +
      `FROM source_revisions WHERE id = (SELECT MAX(id) FROM source_revisions WHERE path = ${sql(file)});`,
  );
}

const dir = path.join(os.tmpdir(), "dustinedwards-seed");
await mkdir(dir, { recursive: true });
const sqlFile = path.join(dir, `seed-sources-${target.slice(2)}.sql`);
await writeFile(sqlFile, splitOversizeStatements(statements.join("\n")), "utf8");
const applied = runWrangler(`d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --file "${sqlFile}" --yes`);
if (applied.status !== 0) {
  console.error(applied.output);
  throw new Error("seed-sources: the seed did not apply. Run it again: a path left half seeded is seeded again.");
}

const holding = read("SELECT COUNT(*) AS n FROM source_files;", "the seed read-back")[0].n;
console.log(`seed-sources: seeded ${fresh.length} file(s) with ${versions} version(s); D1 holds ${holding} source file(s).`);
