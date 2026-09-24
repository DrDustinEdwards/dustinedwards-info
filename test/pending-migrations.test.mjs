/**
 * The ship guard's predicate: does the deployed database have every migration?
 *
 * REPLAYS SHIP WINDOW 5, per the replay rule. That deploy went out with every
 * offline gate green and the media admin page returned a 500 on its first load,
 * because `0011_media_trash_tags.sql` had been pending on the remote database
 * since the session that authored it, four sessions earlier, so `trashed_at`
 * and `tags` did not exist and every media loader query threw.
 *
 * Nothing could see it. `npm run ship` applies no migrations and compares no
 * schema. `check:migrations` compares FILES to a hash manifest, never to a
 * database. `test/schema-invariants.test.mjs` with SCHEMA_LIVE=1 would have caught it
 * and ship does not set it.
 *
 * ## The fixtures are REAL OUTPUT, captured, not invented
 *
 * Both strings below were recorded from wrangler 4.107.0 on 2026-08-15:
 * PENDING_REAL from `wrangler d1 migrations list dustinedwards --local`, which
 * genuinely had 0011 unapplied, and CLEAN_REAL from the same command with
 * `--remote` after the repair. A parser tested only against strings its author
 * imagined is a parser tested against its author's assumptions.
 *
 * @see scripts/lib/pending-migrations.mjs
 */

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
  // The operator has to be able to read WHICH file, not just that one exists.
  assert.match(verdict.reason, /not applied/);
});

test("THE INVERSE: nothing pending proceeds", () => {
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

/* ------------------------------------------------------------- fail closed */

test("FAILS CLOSED: a non-zero exit is unreadable, never clean", () => {
  // Network down, auth expired, database renamed: every one exits non-zero and
  // prints no names. Reading that as "nothing pending" is how a guard becomes
  // decoration, and it is the single most likely way this one would rot.
  for (const text of ["", "Authentication error [code: 10000]", CLEAN_REAL]) {
    const verdict = readMigrationList({ code: 1, text });
    assert.equal(verdict.state, "unreadable", `exit 1 with ${JSON.stringify(text.slice(0, 20))}`);
  }
});

test("FAILS CLOSED: output this parser does not recognize is unreadable", () => {
  // An empty parse of CHANGED output looks exactly like a clean database. This
  // is the branch that refuses to let those two be confused.
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
  // If output somehow carried both signals, the safe reading is that something
  // is pending. A guard that resolved this the other way would be choosing the
  // outcome that deploys.
  const verdict = readMigrationList({
    code: 0,
    text: `${CLEAN_REAL}\nMigrations to be applied:\n│ 0011_media_trash_tags.sql │`,
  });
  assert.equal(verdict.state, "pending");
});

test("a banner mentioning a version cannot be mistaken for a migration", () => {
  // The name pattern is anchored to the four-digit prefix, so the wrangler
  // version line and its update notice cannot be read as filenames.
  const verdict = readMigrationList({ code: 0, text: CLEAN_REAL });
  assert.deepEqual(verdict.pending, []);
});

test("the empty match set alone is never evidence of a clean database", () => {
  // Stated as its own case because it is the assumption the whole design turns
  // on: `clean` requires wrangler to SAY so, in words.
  const noNames = readMigrationList({ code: 0, text: "Resource location: remote" });
  assert.notEqual(noNames.state, "clean");
});

/* ----------------------------------------------------------- the operator */

test("the refusal carries the exact next command, database filled in", () => {
  assert.equal(
    applyCommand("dustinedwards"),
    "npx wrangler d1 migrations apply dustinedwards --remote",
  );
  // Nobody should have to remember this under pressure, which is when the
  // guard fires.
  assert.match(applyCommand("dustinedwards"), /--remote/);
});
