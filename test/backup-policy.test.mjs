import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { credentialProblems, standardProblems } from "@dustinedwards/d1-dump";

import { EXCLUDED_TABLES, NON_DERIVED_TABLES, REQUIRED_TABLES } from "../app/lib/backup/policy.mjs";

// The real schema: every migration applied in order, as D1 would, then read back from sqlite_master.
function realSchema() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  return db
    .prepare("SELECT type, name, sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL")
    .all();
}

const schema = realSchema();
const tableNames = schema.map((t) => t.name);

// The checks themselves are d1-dump's and tested there; what is this site's is that its lists fit its real schema.
await test("a dump of every table in the real schema passes runCheckedBackup's checks with this site's lists", () => {
  const dump = { tables: tableNames.filter((n) => !EXCLUDED_TABLES.includes(n)).map((name) => ({ name, rows: 1 })), excluded: [...EXCLUDED_TABLES] };
  assert.deepEqual(standardProblems(dump, { exclude: [...EXCLUDED_TABLES], required: [...REQUIRED_TABLES] }), []);
  assert.deepEqual(credentialProblems(dump, schema), []);
});

await test("every required table exists in the migrated schema, so the list cannot name a dropped table", () => {
  for (const name of REQUIRED_TABLES) assert.ok(tableNames.includes(name), `${name} is not a table`);
  assert.deepEqual(REQUIRED_TABLES, Object.keys(NON_DERIVED_TABLES));
});
