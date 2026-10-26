// node scripts/remove-source.mjs <path> [--local|--remote]: remove one file from D1's content source, for a kind
// with no delete through Carrel (a phage, a cohort). It writes a revision with no content, as a save's delete does
// (app/lib/source/store.server.ts), so the history keeps the file; the next deploy's pull drops the file and its sync
// removes the row. The repository's seed copy is never written again, because D1 has held the path.

import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { isSourcePath, jsonRows } from "./lib/content-source.mjs";
import { resolveD1Address } from "./lib/d1-address.mjs";
import { sqlLiteral as sql } from "./lib/sql-literal.mjs";
import { runWrangler } from "./lib/wrangler-run.mjs";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const target = process.argv.includes("--remote") ? "--remote" : "--local";
if (!file || !isSourcePath(file)) {
  console.error("usage: node scripts/remove-source.mjs content/<kind>/<file> [--local|--remote]");
  process.exit(1);
}

const address = resolveD1Address("dustinedwards", target);
const held = jsonRows(runWrangler(`d1 execute ${address} ${target} --json --command "SELECT sha FROM source_files WHERE path = ${sql(file)};"`), "the source read");
if (held.length === 0) {
  console.error(`remove-source: D1 holds no ${file}; nothing was removed.`);
  process.exit(1);
}

const dir = path.join(os.tmpdir(), "dustinedwards-seed");
await mkdir(dir, { recursive: true });
const sqlFile = path.join(dir, "remove-source.sql");
await writeFile(
  sqlFile,
  `INSERT INTO source_revisions (path, content, sha, message, author) VALUES (${sql(file)}, NULL, NULL, ${sql(`Remove ${file}`)}, 'admin');\n` +
    `DELETE FROM source_files WHERE path = ${sql(file)};\n`,
  "utf8",
);
const applied = runWrangler(`d1 execute ${address} ${target} --file "${sqlFile}" --yes`);
if (applied.status !== 0) {
  console.error(applied.output);
  process.exit(1);
}
console.log(`remove-source: removed ${file} from ${target.slice(2)} D1. The next deploy removes its row.`);
