import test from "node:test";
import assert from "node:assert/strict";

import { applyCommand, destructiveStatements, readBookmark, readMigrationList } from "../scripts/lib/pending-migrations.mjs";

/** Verbatim from `wrangler d1 migrations list dustinedwards --local`. */
const PENDING_REAL = [
  "",
  " ⛅️ wrangler 4.107.0 (update available 4.123.0)",
  "───────────────────────────────────────────────",
  "Resource location: local ",
  "",
  "Use --remote if you want to access the remote instance.",
  "",
  "Migrations to be applied:",
  "┌───────────────────────────┐",
  "│ Name                      │",
  "├───────────────────────────┤",
  "│ 0011_media_trash_tags.sql │",
  "└───────────────────────────┘",
].join("\n");

/** Verbatim from the same command with --remote, after the repair. */
const CLEAN_REAL = [
  "",
  " ⛅️ wrangler 4.107.0 (update available 4.123.0)",
  "───────────────────────────────────────────────",
  "Resource location: remote ",
  "",
  "✅ No migrations to apply!",
].join("\n");

await test("THE DEFECT: a pending migration is REFUSED and named", () => {
  const verdict = readMigrationList({ code: 0, text: PENDING_REAL });
  assert.equal(verdict.state, "pending");
  assert.deepEqual(verdict.pending, ["0011_media_trash_tags.sql"]);
  assert.match(verdict.reason, /not applied/);
});

await test("THE INVERSE: nothing pending proceeds", () => {
  // The name pattern is anchored to the four-digit prefix, so the wrangler
  // version line and its update notice cannot be read as filenames.
  const verdict = readMigrationList({ code: 0, text: CLEAN_REAL });
  assert.equal(verdict.state, "clean");
  assert.deepEqual(verdict.pending, []);
});

await test("several pending migrations are all named, not just the first", () => {
  const text = PENDING_REAL.replace(
    "│ 0011_media_trash_tags.sql │",
    "│ 0011_media_trash_tags.sql │\n│ 0012_something_else.sql   │",
  );
  const verdict = readMigrationList({ code: 0, text });
  assert.equal(verdict.state, "pending");
  assert.deepEqual(verdict.pending, ["0011_media_trash_tags.sql", "0012_something_else.sql"]);
});

await test("FAILS CLOSED: a non-zero exit is unreadable, never clean", () => {
  // Network down, auth expired, database renamed: each exits non-zero and prints no names.
  for (const text of ["", "Authentication error [code: 10000]", CLEAN_REAL]) {
    const verdict = readMigrationList({ code: 1, text });
    assert.equal(verdict.state, "unreadable", `exit 1 with ${JSON.stringify(text.slice(0, 20))}`);
  }
});

await test("FAILS CLOSED: output this parser does not recognize is unreadable", () => {
  // An empty parse of CHANGED output looks exactly like a clean database.
  const verdict = readMigrationList({ code: 0, text: "wrangler said something new" });
  assert.equal(verdict.state, "unreadable");
  assert.match(verdict.reason, /format has changed/);
});

await test("FAILS CLOSED: names without the heading are unreadable, not clean", () => {
  const verdict = readMigrationList({ code: 0, text: "0011_media_trash_tags.sql" });
  assert.equal(verdict.state, "unreadable");
  assert.deepEqual(verdict.pending, ["0011_media_trash_tags.sql"]);
});

await test("AMBIGUITY RESOLVES TOWARD REFUSING, never toward shipping", () => {
  const verdict = readMigrationList({
    code: 0,
    text: `${CLEAN_REAL}\nMigrations to be applied:\n│ 0011_media_trash_tags.sql │`,
  });
  assert.equal(verdict.state, "pending");
});

await test("the empty match set alone is never evidence of a clean database", () => {
  const noNames = readMigrationList({ code: 0, text: "Resource location: remote" });
  assert.notEqual(noNames.state, "clean");
});

await test("the refusal carries the exact next command, database filled in", () => {
  assert.equal(
    applyCommand("dustinedwards"),
    "npx wrangler d1 migrations apply dustinedwards --remote",
  );
});

void test("destructiveStatements: additive SQL, trigger bodies and comments pass; anything that can lose data is named", () => {
  const additive = [
    "-- drop table posts; is only a comment",
    "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT DEFAULT 'delete from x');",
    "ALTER TABLE posts ADD COLUMN canonical TEXT;",
    "CREATE INDEX notes_body ON notes(body);",
    "INSERT INTO settings (key, value) VALUES ('a', 'b');",
    "CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN DELETE FROM notes_fts WHERE rowid = old.id; END;",
  ].join("\n");
  assert.deepEqual(destructiveStatements(additive), []);
  assert.deepEqual(destructiveStatements("DROP TABLE session;"), ["DROP"]);
  assert.deepEqual(destructiveStatements("ALTER TABLE posts DROP COLUMN category;"), ["ALTER TABLE ... DROP or RENAME"]);
  assert.deepEqual(destructiveStatements("ALTER TABLE media RENAME TO media_old;"), ["ALTER TABLE ... DROP or RENAME"]);
  assert.deepEqual(destructiveStatements("UPDATE posts SET draft = 0;"), ["UPDATE"]);
  assert.deepEqual(destructiveStatements("DELETE FROM media;"), ["DELETE"]);
  assert.deepEqual(destructiveStatements("INSERT OR REPLACE INTO settings VALUES ('a', 'b');"), ["REPLACE"]);
});

void test("readBookmark: reads wrangler's JSON after its banner, and gives '' when there is none", () => {
  assert.equal(readBookmark(' ⛅️ wrangler 4.149.0\n{\n  "bookmark": "00000085-0000024c-00004c6d-8e61117bf38d7adb71b934ebbf891683",\n  "timestamp": "2026-10-31T11:00:00Z"\n}'), "00000085-0000024c-00004c6d-8e61117bf38d7adb71b934ebbf891683");
  assert.equal(readBookmark("✘ [ERROR] Authentication error [code: 10000]"), "");
  assert.equal(readBookmark('{"bookmark": null}'), "");
});
