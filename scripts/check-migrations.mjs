/**
 * Gate: an applied migration is never edited.
 *
 *   npm run check:migrations
 *   node scripts/check-migrations.mjs --write [--force]
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT PROVES THE FILES MATCH THE MANIFEST. Nothing more.**
 *
 * It does NOT prove the manifest was honest when it was written. Someone who
 * edits a migration and regenerates in the same commit produces a green run;
 * what stops that is the diff, which shows both the `.sql` change and the hash
 * change, and `--write` refusing to alter an existing hash without `--force`.
 *
 * It does NOT know what the LIVE database actually applied. A migration edited
 * before it was ever applied is legitimate and indistinguishable here from one
 * edited after. The live half is `check:invariants --remote`, which compares
 * the migrations replayed into memory against the real schema.
 *
 * ## IT HASHES NORMALIZED CONTENT, NOT RAW BYTES, and that was learned the hard
 * way
 *
 * The first version hashed raw bytes on the reasoning that a migration whose
 * bytes moved is a migration whose bytes moved. That made the manifest
 * MACHINE-SPECIFIC. `core.autocrlf` is true on this host, so seven of the ten
 * migrations sit CRLF in the working tree while their committed blobs are LF;
 * hashes generated from disk therefore failed against every fresh checkout.
 *
 * Found by `check:head` on the run immediately after this gate was wired: it
 * passed on disk in 0.7s and failed inside an extraction of the same commit.
 * That is precisely the class check:head exists for, catching a defect in a
 * gate written the same session.
 *
 * CRLF is collapsed to LF before hashing, so the hash is a property of the
 * CONTENT. Nothing is lost: `.gitattributes` pins the whole tree to LF, so line
 * endings are not a meaningful axis of change here, and a genuine content edit
 * still moves the hash.
 *
 * ## Why this exists, and the honest note about its testing
 *
 * Hard rule 14: migrations are hand-written and an applied one is never edited.
 * `check:invariants` section 4 replays every migration into an empty database
 * and diffs the result against `schema.ts`, so it catches an edit that MOVES A
 * COLUMN. It cannot see anything else. Editing seed data, an index, a trigger,
 * or FTS DDL inside an applied file changes what a fresh clone builds and is
 * invisible to every gate in this repo. Backlog item 7.
 *
 * **RULE 12 CANNOT BE SATISFIED HERE, and that is stated rather than papered
 * over.** A new gate is supposed to be tested by replaying the defect it was
 * written for. No such defect exists: no migration in this repo has ever been
 * edited after being applied. So this gate is verified by PLANTS ONLY, which
 * the rule warns are written to match the implementation rather than the bug.
 * If an edited migration is ever discovered, replay it against this gate before
 * trusting the plants.
 *
 * Pure: no network, no database.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(root, "drizzle");
const MANIFEST = join(MIGRATIONS, "manifest.json");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const FORCE = args.includes("--force");

/** Below this the directory is not a migrations directory and something is wrong. */
const MINIMUM_MIGRATIONS = 8;

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/**
 * sha256 of the migration's CONTENT, with CRLF collapsed to LF.
 *
 * Normalized rather than raw for the reason in the header: with
 * `core.autocrlf` true, a working tree and its own committed blobs disagree on
 * line endings, so a raw-byte manifest is only valid on the machine that wrote
 * it and fails in every checkout.
 *
 * @param {string} file
 */
function hashOf(file) {
  const content = readFileSync(join(MIGRATIONS, file), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

console.log("\ncheck:migrations\n");

/* ------------------------------------------------------- fail closed first */

if (!existsSync(MIGRATIONS)) {
  console.log("  FAIL  drizzle/ is missing. Refusing to pass with nothing to check.\n");
  process.exit(1);
}

const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length < MINIMUM_MIGRATIONS) {
  console.log(
    `  FAIL  found ${files.length} migration(s), expected at least ${MINIMUM_MIGRATIONS}.\n` +
      `        Either the directory is wrong or migrations have been deleted. 0001_init.sql\n` +
      `        is the ONLY copy of the CREATE TABLE statements that exists anywhere, because\n` +
      `        wrangler d1 export is broken on this database.\n`,
  );
  process.exit(1);
}

/* --------------------------------------------------------------- generator */

if (WRITE) {
  /** @type {Record<string, string>} */
  const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")).sha256 : {};
  /** @type {Record<string, string>} */
  const next = {};
  const changed = [];
  for (const file of files) {
    next[file] = hashOf(file);
    if (previous[file] && previous[file] !== next[file]) changed.push(file);
  }

  /*
   * REFUSES TO LAUNDER AN EDIT. Regenerating is the obvious way to make this
   * gate green after editing an applied migration, so a hash that CHANGES needs
   * --force, which puts the decision in the command line and therefore in the
   * shell history and the reviewer's question. Adding a NEW file needs nothing.
   */
  if (changed.length > 0 && !FORCE) {
    console.log(
      `  REFUSED: ${changed.length} existing hash(es) would CHANGE: ${changed.join(", ")}\n` +
        `  That means an applied migration was edited, which hard rule 14 forbids.\n` +
        `  If the edit is genuinely correct, re-run with --force and say why in the commit.\n`,
    );
    process.exit(1);
  }

  writeFileSync(
    MANIFEST,
    `${JSON.stringify({ note: "sha256 of each migration. check:migrations compares against this. Adding a migration means adding its hash in the same commit.", sha256: next }, null, 2)}\n`,
  );
  console.log(`  wrote ${files.length} hash(es) to drizzle/manifest.json${FORCE ? " (--force)" : ""}\n`);
  process.exit(0);
}

/* ------------------------------------------------------------ the checking */

ok(
  "drizzle/manifest.json exists",
  existsSync(MANIFEST),
  "generate it with `node scripts/check-migrations.mjs --write`. Without it there is " +
    "nothing to compare against and this gate would pass by examining nothing.",
);
if (!existsSync(MANIFEST)) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}

/** @type {{ sha256: Record<string, string> }} */
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const recorded = manifest.sha256 ?? {};

ok(
  "the manifest is not empty",
  Object.keys(recorded).length > 0,
  "it records no hashes, so every comparison below would pass vacuously",
);
ok(
  `the manifest covers a plausible number of migrations`,
  Object.keys(recorded).length >= MINIMUM_MIGRATIONS,
  `${Object.keys(recorded).length} recorded against ${files.length} on disk`,
);

// Direction 1: every file on disk is recorded, and its bytes are unchanged.
for (const file of files) {
  const expected = recorded[file];
  ok(
    `${file} is recorded in the manifest`,
    typeof expected === "string" && expected.length === 64,
    "a NEW migration must have its hash added in the SAME commit: " +
      "`node scripts/check-migrations.mjs --write`",
  );
  if (typeof expected !== "string") continue;
  const actual = hashOf(file);
  ok(
    `${file} is byte-identical to its recorded hash`,
    actual === expected,
    `recorded ${expected.slice(0, 16)}…, on disk ${actual.slice(0, 16)}…\n` +
      `        AN APPLIED MIGRATION HAS BEEN EDITED. check:invariants section 4 only sees\n` +
      `        an edit that MOVES A COLUMN; seed data, an index, a trigger or FTS DDL\n` +
      `        changes what a fresh clone builds and is invisible to every other gate.\n` +
      `        The repair is a NEW numbered migration, never an edit to this one.`,
  );
}

// Direction 2: every recorded entry still names a file.
for (const file of Object.keys(recorded)) {
  ok(
    `${file} still exists on disk`,
    files.includes(file),
    "the manifest records a migration that is gone. 0001_init.sql in particular is the " +
      "only copy of the CREATE TABLE statements anywhere, because wrangler d1 export is " +
      "broken on this database.",
  );
}

console.log(
  `  ${files.length} migration(s) on disk, ${Object.keys(recorded).length} recorded, ` +
    `sha256 compared both directions`,
);

/*
 * EXECUTED-COUNT FLOOR.
 *
 * MINIMUM_MIGRATIONS above floors the SCOPE, which is a different question: it
 * catches a directory that stopped being read. This catches an assertion block
 * that stopped running over a directory that is still full, and neither can see
 * the other's bug.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 33.
 * Never summed. Floored at 30, slack of three: the count steps by a fixed
 * amount per migration, and migrations are append-only by hard rule 14, so it
 * only ever grows.
 */
const MINIMUM_CHECKS = 30;
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was SKIPPED ` +
      `rather than failing. Measured: 33.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
