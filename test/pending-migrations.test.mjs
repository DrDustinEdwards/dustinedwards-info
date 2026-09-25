import test from "node:test";
import assert from "node:assert/strict";

import { applyCommand, readMigrationList } from "../scripts/lib/pending-migrations.mjs";

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

test("THE DEFECT: a pending migration is REFUSED and named", () => {
  const verdict = readMigrationList({ code: 0, text: PENDING_REAL });
  assert.equal(verdict.state, "pending");
  assert.deepEqual(verdict.pending, ["0011_media_trash_tags.sql"]);
  assert.match(verdict.reason, /not applied/);
});

test("THE INVERSE: nothing pending proceeds", () => {
  // The name pattern is anchored to the four-digit prefix, so the wrangler
  // version line and its update notice cannot be read as filenames.
  const verdict = readMigrationList({ code: 0, text: CLEAN_REAL });
  assert.equal(verdict.state, "clean");
  assert.deepEqual(verdict.pending, []);
});

test("several pending migrations are all named, not just the first", () => {
  const text = PENDING_REAL.replace(
    "│ 0011_media_trash_tags.sql │",
    "│ 0011_media_trash_tags.sql │\n│ 0012_something_else.sql   │",
  );
  const verdict = readMigrationList({ code: 0, text });
  assert.equal(verdict.state, "pending");
  assert.deepEqual(verdict.pending, ["0011_media_trash_tags.sql", "0012_something_else.sql"]);
});

test("FAILS CLOSED: a non-zero exit is unreadable, never clean", () => {
  // Network down, auth expired, database renamed: each exits non-zero and prints no names.
  for (const text of ["", "Authentication error [code: 10000]", CLEAN_REAL]) {
    const verdict = readMigrationList({ code: 1, text });
    assert.equal(verdict.state, "unreadable", `exit 1 with ${JSON.stringify(text.slice(0, 20))}`);
  }
});

test("FAILS CLOSED: output this parser does not recognize is unreadable", () => {
  // An empty parse of CHANGED output looks exactly like a clean database.
  const verdict = readMigrationList({ code: 0, text: "wrangler said something new" });
  assert.equal(verdict.state, "unreadable");
  assert.match(verdict.reason, /format has changed/);
});

test("FAILS CLOSED: names without the heading are unreadable, not clean", () => {
  const verdict = readMigrationList({ code: 0, text: "0011_media_trash_tags.sql" });
  assert.equal(verdict.state, "unreadable");
  assert.deepEqual(verdict.pending, ["0011_media_trash_tags.sql"]);
});

test("AMBIGUITY RESOLVES TOWARD REFUSING, never toward shipping", () => {
  const verdict = readMigrationList({
    code: 0,
    text: `${CLEAN_REAL}\nMigrations to be applied:\n│ 0011_media_trash_tags.sql │`,
  });
  assert.equal(verdict.state, "pending");
});

test("the empty match set alone is never evidence of a clean database", () => {
  const noNames = readMigrationList({ code: 0, text: "Resource location: remote" });
  assert.notEqual(noNames.state, "clean");
});

test("the refusal carries the exact next command, database filled in", () => {
  assert.equal(
    applyCommand("dustinedwards"),
    "npx wrangler d1 migrations apply dustinedwards --remote",
  );
});
