import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import {
  D1_STATEMENT_LIMIT,
  splitOversizeStatements,
  splitStatements,
} from "../scripts/lib/split-statements.mjs";

const SCHEMA = `
  CREATE TABLE publications (slug TEXT PRIMARY KEY, title TEXT NOT NULL, markdown TEXT NOT NULL,
    record TEXT, source_blob_sha TEXT NOT NULL);
  CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL);
`;

/** A text over 100 KB with the characters that make escaping and cutting go wrong. */
function longText(bytesWanted) {
  const unit = "It's a \"quoted\" line; ünïcödé 日本語 😀 -- not a comment /* nor this */\n\tend. ";
  let text = "";
  while (Buffer.byteLength(text) < bytesWanted) text += unit;
  return text;
}

const literal = (text) => `'${text.replace(/'/g, "''")}'`;
const biggest = (sql) => Math.max(...splitStatements(sql).map((s) => Buffer.byteLength(s) + 1));

/** @param {string} sql */
function load(sql) {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  db.exec(sql);
  return db;
}

const TEXT = longText(141_000);
const DUMP =
  `INSERT INTO "publications" ("slug","title","markdown","record","source_blob_sha") ` +
  `VALUES('big','A paper',${literal(TEXT)},NULL,'abc123');\n` +
  `INSERT INTO "publications" ("slug","title","markdown","record","source_blob_sha") ` +
  `VALUES('small','Short',${literal("tiny")},'{"a":1}','def456');\n`;

test("the raw dump has a statement over D1's cap, and the split one has none", () => {
  assert.ok(biggest(DUMP) > D1_STATEMENT_LIMIT, "the fixture must reproduce the failure: one row over 100 KB");
  const split = splitOversizeStatements(DUMP);
  assert.ok(biggest(split) < D1_STATEMENT_LIMIT, `largest statement is ${biggest(split)} bytes`);
});

test("a row over the cap restores to exactly the bytes it had, and its neighbours are untouched", () => {
  const db = load(splitOversizeStatements(DUMP));
  const rows = db.prepare("SELECT * FROM publications ORDER BY slug").all();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].markdown, TEXT);
  assert.equal(rows[0].source_blob_sha, "abc123");
  assert.equal(rows[0].record, null);
  assert.equal(rows[1].markdown, "tiny");
  assert.equal(rows[1].record, '{"a":1}');
});

test("a statement under the line passes through byte for byte", () => {
  const small = `INSERT INTO "publications" ("slug","title","markdown","record","source_blob_sha") VALUES('s','t','m',NULL,'x');`;
  assert.equal(splitOversizeStatements(`${small}\nPRAGMA foreign_keys=ON;\n`), `${small}\nPRAGMA foreign_keys=ON;\n`);
});

test("newlines written as char(10) joins split between terms and join back", () => {
  const parts = Array.from({ length: 6000 }, (_, i) => `line ${i} of the paper's text`);
  const expression = parts.map(literal).join("||char(10)||");
  const dump = `INSERT INTO "notes" ("id","body") VALUES(7,${expression});\n`;
  assert.ok(biggest(dump) > D1_STATEMENT_LIMIT);
  const db = load(splitOversizeStatements(dump, { keyOf: () => ["id"] }));
  assert.equal(db.prepare("SELECT body FROM notes WHERE id = 7").get().body, parts.join("\n"));
  assert.ok(biggest(splitOversizeStatements(dump, { keyOf: () => ["id"] })) < D1_STATEMENT_LIMIT);
});

test("an INSERT that lists no columns takes them from the schema; no key addresses the new row by rowid", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  db.exec(`INSERT INTO notes (body) VALUES ('one'), ('two');`);
  const dump = `INSERT INTO "notes" VALUES(3,${literal(TEXT)});\n`;
  assert.throws(() => splitOversizeStatements(dump), /lists no columns/);
  db.exec(splitOversizeStatements(dump, { columnsOf: () => ["id", "body"] }));
  const rows = db.prepare("SELECT id, body FROM notes ORDER BY id").all();
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3]);
  assert.equal(rows[2].body, TEXT);
  assert.equal(rows[0].body, "one");
});

test("an upsert over the cap lands on the row it conflicts with, and a half-written one reads as not current", () => {
  const upsert =
    `INSERT INTO publications (slug, title, markdown, record, source_blob_sha) VALUES ` +
    `('big', 'New title', ${literal(TEXT)}, NULL, 'newsha') ON CONFLICT(slug) DO UPDATE SET ` +
    `title = excluded.title, markdown = excluded.markdown, record = excluded.record, ` +
    `source_blob_sha = excluded.source_blob_sha;\n`;
  assert.ok(biggest(upsert) > D1_STATEMENT_LIMIT);
  const split = splitOversizeStatements(upsert, { lateColumns: ["source_blob_sha"] });
  assert.ok(biggest(split) < D1_STATEMENT_LIMIT);

  // Over an existing row (the update path), and over an empty table (the insert path).
  for (const existing of [true, false]) {
    const db = load(existing ? `INSERT INTO publications VALUES ('big','Old','old text',NULL,'oldsha');` : "");
    db.exec(split);
    const row = db.prepare("SELECT * FROM publications WHERE slug = 'big'").get();
    assert.equal(row.title, "New title");
    assert.equal(row.markdown, TEXT);
    assert.equal(row.source_blob_sha, "newsha");
  }

  // Stopped after the second statement: the text is partial and the sha is blank, never the real one.
  const statements = splitStatements(split);
  const db = load("");
  for (const s of statements.slice(0, 2)) db.exec(s);
  const partial = db.prepare("SELECT markdown, source_blob_sha FROM publications").get();
  assert.notEqual(partial.markdown, TEXT);
  assert.equal(partial.source_blob_sha, "");
});

test("what cannot be cut stops the run and says so", () => {
  assert.throws(
    () => splitOversizeStatements(`UPDATE notes SET body = ${literal(TEXT)};`),
    /not a plain INSERT/,
  );
  assert.throws(
    () => splitOversizeStatements(`INSERT INTO notes (id, body) VALUES (1, replace(${literal(TEXT)}, 'a', 'b'));`),
    /cannot be cut|still over/,
  );
});

test("a semicolon or a quote inside text does not end a statement", () => {
  assert.deepEqual(splitStatements(`INSERT INTO t VALUES('a;b''c');\n-- x; y\nSELECT 1;`), [
    `INSERT INTO t VALUES('a;b''c')`,
    `-- x; y\nSELECT 1`,
  ]);
});

// The real schema: every table that holds a long text restores from an over-cap dump row with the triggers and
// constraints the migrations declare. Columns and keys come from scripts/lib/dump-schema.mjs, as in the drill.
import { readdirSync, readFileSync } from "node:fs";
import { migrationSchema } from "../scripts/lib/dump-schema.mjs";

function migrated() {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync("drizzle").filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(`drizzle/${f}`, "utf8"));
  }
  return db;
}

const LONG_TEXT_COLUMNS = {
  publications: ["markdown", "record"],
  procedures: ["markdown", "record"],
  pages: ["markdown", "record"],
  posts: ["body", "html"],
  search_docs: ["body"],
};

/** Columns the migrations restrict to a list. */
const CHECKED = {
  publications: { stage: "published", type: "article" },
  procedures: { profile: "protocol" },
  posts: { kind: "post" },
  search_docs: { type: "post" },
};

for (const [table, longColumns] of Object.entries(LONG_TEXT_COLUMNS)) {
  test(`${table}: a row over the cap in the real schema restores byte for byte`, () => {
    const schema = migrationSchema();
    const columns = schema.columnsOf(table);
    assert.ok(columns, `${table} is in the migrations`);
    const source = migrated();
    const info = source.prepare(`SELECT name, type, "notnull" AS nn, dflt_value AS d FROM pragma_table_info('${table}')`).all();
    const row = {};
    for (const c of info) {
      if (c.name === "id") continue;
      if (longColumns.includes(c.name)) row[c.name] = TEXT;
      else if (c.name in (CHECKED[table] ?? {})) row[c.name] = CHECKED[table][c.name];
      else if (c.name === "status") row[c.name] = "draft";
      else if (c.nn && c.d === null) row[c.name] = /INT|REAL|NUM/i.test(c.type) ? 1 : `v-${c.name}`;
    }
    const names = Object.keys(row);
    source
      .prepare(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`)
      .run(...Object.values(row));
    const truth = source.prepare(`SELECT * FROM ${table}`).get();

    const values = columns.map((c) => {
      const v = truth[c];
      return v === null ? "NULL" : typeof v === "number" ? String(v) : literal(String(v));
    });
    const dump = `INSERT INTO "${table}" VALUES(${values.join(",")});\n`;
    assert.ok(biggest(dump) > D1_STATEMENT_LIMIT, "the fixture row is over the cap");

    const split = splitOversizeStatements(dump, schema);
    assert.ok(biggest(split) < D1_STATEMENT_LIMIT);
    const target = migrated();
    target.exec(split);
    assert.deepEqual({ ...target.prepare(`SELECT * FROM ${table}`).get() }, { ...truth });
  });
}
