import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { CHUNK_CHARS } from "../app/lib/content/chunks.mjs";
import { freezeSql } from "../scripts/lib/freeze-sql.mjs";

/* The statements sync:content applies at ship to freeze a published version (scripts/lib/freeze-sql.mjs), run against a
 * real SQLite with the real migration, so the triggers are the ones D1 will run. */

const MIGRATION = readFileSync(new URL("../drizzle/0027_procedure_versions.sql", import.meta.url), "utf8");
const newDb = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(MIGRATION);
  return db;
};
/** @param {Partial<Parameters<typeof freezeSql>[0]>} over */
const row = (over = {}) => ({
  slug: "mini",
  version: "2",
  status: "published",
  path: "/research/protocols/mini",
  profile: "protocol",
  // Over the chunk size, with apostrophes (doubled in a literal), so the pieces and the quoting both run.
  record: JSON.stringify({ words: "it's ".repeat(CHUNK_CHARS), version: "2" }),
  markdown: "# Mini\n\n" + "a protocol's words. ".repeat(CHUNK_CHARS),
  sourceBlobSha: "sha-a",
  ...over,
});
const stored = (db) => db.prepare("SELECT * FROM procedure_versions WHERE slug = 'mini' AND version = '2'").get();

test("a draft and an unversioned procedure are frozen to nothing", () => {
  assert.deepEqual(freezeSql(row({ status: "draft" })), []);
  assert.deepEqual(freezeSql(row({ version: null })), []);
  assert.deepEqual(freezeSql(row({ version: "" })), []);
});

test("a large record and twin go in pieces, each statement under D1's 100 KB, and end sealed and whole", () => {
  const r = row();
  const statements = freezeSql(r);
  assert.ok(statements.length > 5, "the record and the twin are split into pieces");
  for (const statement of statements) assert.ok(Buffer.byteLength(statement) < 100_000, `a statement is ${Buffer.byteLength(statement)} bytes`);
  const db = newDb();
  db.exec(statements.join("\n"));
  const got = stored(db);
  assert.equal(got.sealed, 1);
  assert.equal(got.record, r.record);
  assert.equal(got.markdown, r.markdown);
  assert.equal(got.source_blob_sha, "sha-a");
  assert.equal(got.path, "/research/protocols/mini");
});

test("a sealed copy is left alone when the same version is written again with other words", () => {
  const db = newDb();
  db.exec(freezeSql(row()).join("\n"));
  const first = stored(db);
  db.exec(freezeSql(row({ record: JSON.stringify({ words: "changed", version: "2" }), markdown: "# Changed\n", sourceBlobSha: "sha-b" })).join("\n"));
  assert.deepEqual(stored(db), first);
});

test("the database refuses to change or delete a sealed copy, and allows it on an unsealed one", () => {
  const db = newDb();
  db.exec(freezeSql(row()).join("\n"));
  assert.throws(() => db.exec("UPDATE procedure_versions SET record = 'x' WHERE slug = 'mini'"), /never changed/);
  assert.throws(() => db.exec("DELETE FROM procedure_versions WHERE slug = 'mini'"), /never deleted/);
  assert.throws(() => db.exec("UPDATE procedure_versions SET sealed = 0 WHERE slug = 'mini'"), /never changed/);
  db.exec(`INSERT INTO procedure_versions (slug, version, path, profile, record, markdown, source_blob_sha, sealed)
           VALUES ('half', '1', '/p', 'protocol', '{', '', 'x', 0)`);
  db.exec("UPDATE procedure_versions SET record = '{}' WHERE slug = 'half'");
  db.exec("DELETE FROM procedure_versions WHERE slug = 'half'");
});

test("a run that stopped half way leaves an unsealed row, which the next run replaces and seals", () => {
  const db = newDb();
  const r = row();
  const statements = freezeSql(r);
  // Everything but the sealing statement: the interrupted run.
  db.exec(statements.slice(0, -1).join("\n"));
  assert.equal(stored(db).sealed, 0);
  db.exec(freezeSql(r).join("\n"));
  const got = stored(db);
  assert.equal(got.sealed, 1);
  assert.equal(got.record, r.record);
  assert.equal(got.markdown, r.markdown);
  assert.equal(db.prepare("SELECT count(*) AS n FROM procedure_versions").get().n, 1);
});
