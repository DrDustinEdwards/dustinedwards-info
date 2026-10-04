// RUNBOOK 4b step 3: turns the concatenated per-table export into a file D1 will load. A row whose INSERT is
// over D1's 100 KB statement cap (paper text, a long protocol) is written as an INSERT plus UPDATEs that
// append the rest. Usage: node scripts/split-dump.mjs <_restore.sql> [<out.sql>]; without <out.sql> the input is rewritten.

import { readFile, writeFile } from "node:fs/promises";

import { migrationSchema } from "./lib/dump-schema.mjs";
import { splitOversizeStatements } from "./lib/split-statements.mjs";

const [input, output = input] = process.argv.slice(2);
if (!input) {
  console.error("usage: node scripts/split-dump.mjs <_restore.sql> [<out.sql>]");
  process.exit(2);
}
const before = await readFile(input, "utf8");
const after = splitOversizeStatements(before, migrationSchema());
await writeFile(output, after, "utf8");
console.log(`split-dump: ${input} -> ${output} (${Buffer.byteLength(before)} -> ${Buffer.byteLength(after)} bytes)`);
