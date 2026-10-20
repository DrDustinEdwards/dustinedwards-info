import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { standardProblems } from "@dustinedwards/d1-dump";

import {
  CREDENTIAL_COLUMN,
  EXCLUDED_TABLES,
  NON_DERIVED_TABLES,
  REQUIRED_TABLES,
  columnNames,
  dumpProblems,
} from "../app/lib/backup/policy.mjs";

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
// What runCheckedBackup refuses: d1-dump's standard checks with this site's lists, then the site's policy.
const allProblems = (dump, policy) => [
  ...standardProblems(dump, { exclude: [...EXCLUDED_TABLES], required: [...REQUIRED_TABLES] }),
  ...dumpProblems(dump, policy),
];

const healthy = {
  tables: REQUIRED_TABLES.map((name) => ({ name, rows: 1 })).concat([{ name: "posts", rows: 12 }]),
  excluded: [],
  schema,
};

await test("the real schema passes the policy", () => {
  assert.deepEqual(allProblems(healthy), []);
});

await test("every required table exists in the migrated schema, so the list cannot name a dropped table", () => {
  for (const name of REQUIRED_TABLES) assert.ok(tableNames.includes(name), `${name} is not a table`);
  assert.deepEqual(REQUIRED_TABLES, Object.keys(NON_DERIVED_TABLES));
});

await test("no table in the migrated schema holds a credential column, which is why EXCLUDED_TABLES is empty", () => {
  for (const entry of schema) {
    if (/^\s*CREATE\s+VIRTUAL/i.test(entry.sql)) continue;
    const bad = columnNames(entry.sql).filter((c) => CREDENTIAL_COLUMN.test(c));
    assert.deepEqual(bad, [], `${entry.name} has ${bad.join(", ")}`);
  }
  assert.deepEqual([...EXCLUDED_TABLES], []);
});

await test("PLANTED: an empty dump is refused", () => {
  const problems = allProblems({ tables: [], excluded: [], schema });
  assert.ok(problems.some((p) => /0 tables and 0 rows/.test(p)), problems.join("\n"));
  const zeroRows = allProblems({ ...healthy, tables: healthy.tables.map((t) => ({ ...t, rows: 0 })) });
  assert.ok(zeroRows.some((p) => / and 0 rows$/.test(p)), "tables with no rows are an empty dump");
});

await test("PLANTED: a credential table left in is refused, by table and column", () => {
  const planted = [
    ...schema,
    { type: "table", name: "session", sql: 'CREATE TABLE session (id text PRIMARY KEY, token text NOT NULL UNIQUE, "userId" text)' },
    { type: "table", name: "account", sql: "CREATE TABLE account (id text, accessToken text, refreshToken text, password text)" },
  ];
  const problems = dumpProblems({
    ...healthy,
    tables: [...healthy.tables, { name: "session", rows: 3 }, { name: "account", rows: 1 }],
    schema: planted,
  });
  assert.ok(problems.some((p) => /table session .*token/.test(p)), problems.join("\n"));
  assert.ok(problems.some((p) => /table account .*accessToken, refreshToken, password/.test(p)), problems.join("\n"));
});

await test("PLANTED: a missing required table is refused by name", () => {
  const without = { ...healthy, tables: healthy.tables.filter((t) => t.name !== "kb_lots") };
  const problems = allProblems(without);
  assert.deepEqual(problems, ["kb_lots is missing from the dump"]);
});

await test("a table excluded without being listed is refused, and a listed one is allowed to be absent", () => {
  const unlisted = dumpProblems({ ...healthy, excluded: ["settings"] });
  assert.ok(unlisted.some((p) => /settings was excluded but is not on the excluded list/.test(p)));
  const credential = { type: "table", name: "api_keys", sql: "CREATE TABLE api_keys (id integer, secret text)" };
  const allowed = dumpProblems(
    { tables: healthy.tables, excluded: ["api_keys"], schema: [...schema, credential] },
    { allowedExcluded: ["api_keys"] },
  );
  assert.deepEqual(allowed, []);
});

await test("columnNames reads quoted names, skips constraints and ignores commas inside parentheses", () => {
  const sql = 'CREATE TABLE t (id integer PRIMARY KEY, "user token" text, `x` real DEFAULT (abs(1, 2)), CONSTRAINT c CHECK (a in (1,2)), UNIQUE (a, b))';
  assert.deepEqual(columnNames(sql), ["id", "user token", "x"]);
});
