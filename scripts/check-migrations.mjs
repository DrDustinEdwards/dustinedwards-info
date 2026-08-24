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
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(root, "drizzle");
const MANIFEST = join(MIGRATIONS, "manifest.json");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const FORCE = args.includes("--force");

/**
 * Below this the directory is not a migrations directory and something is wrong.
 * Measured through this gate 2026-08-24: 12 on disk. It was 8, which could not
 * notice a third of the directory being deleted, and 0001_init.sql is the only
 * copy of the CREATE TABLE statements that exists anywhere.
 */
const MINIMUM_MIGRATIONS = 11;

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


/* ------------------------------ ship refuses on a pending migration -------- */

/*
 * **AUTHORING A MIGRATION MUST CREATE AN OBLIGATION SOMEWHERE, AND THIS IS IT.**
 *
 * SHIP WINDOW 5 deployed with every offline gate green and the media admin page
 * returned a 500 on its first load, because `0011_media_trash_tags.sql` had
 * been pending on the remote database since the session that authored it, four
 * sessions earlier. The columns did not exist and every media loader query
 * threw.
 *
 * This section belongs HERE rather than in a gate of its own, and that is a
 * judgement worth stating. Nothing owns ship's step ORDERING today; the closest
 * thing is `check:assertions`, which lints every `scripts/**` file including
 * `ship.mjs`, but only for the vacuity classes. What this gate owns is the
 * MIGRATION CONTRACT: hashes both directions, append-only, never edit an
 * applied one. "A migration that exists in the repo must be applied before the
 * code that needs it deploys" is a clause of that same contract, so it is added
 * to the gate that already holds it rather than a new gate being invented for
 * one assertion.
 *
 * SOURCE LEVEL, and the boundary is real: this reads what `ship.mjs` DECLARES.
 * It cannot run ship, and must not: the ship-guard law is that a deploy guard
 * is proven on its PREDICATE IN ISOLATION, never by invoking the deploy. The
 * predicate's own behaviour is unit tested in `test/pending-migrations.test.mjs`
 * against wrangler output recorded from a real database in both states.
 */

/* One owner: scripts/lib/strip-comments.mjs carries the trap, the guard and the boundary. */

const SHIP = join(root, "scripts", "ship.mjs");

ok(
  "scripts/ship.mjs exists",
  existsSync(SHIP),
  "without it nothing below examines anything",
);

if (existsSync(SHIP)) {
  const shipSource = readFileSync(SHIP, "utf8");
  // Comments stripped before anything is located, the same trap check:logo,
  // check:contrast and check:features have each hit by parsing their own prose.
  const shipCode = stripComments(shipSource);

  ok(
    "ship imports the pending-migration predicate",
    /readMigrationList/.test(shipCode),
    "the guard's decision lives in scripts/lib/pending-migrations.mjs, which is " +
      "unit tested. A guard reimplemented inline in ship would be untested by " +
      "construction, because nothing can run ship without deploying.",
  );
  ok(
    "ship asks the deployed database which migrations are applied",
    /migrations[\s\S]{0,80}list/.test(shipCode) || /"list"/.test(shipCode),
    "the comparison is against the DATABASE, not against the manifest. The " +
      "manifest comparison above cannot see an unapplied migration at all.",
  );
  ok(
    "ship refuses on a PENDING migration",
    /state\s*===\s*"pending"/.test(shipCode) && /refuse\(/.test(shipCode),
    "it must refuse rather than apply: additive and destructive are " +
      "indistinguishable from ship, so the operator decides",
  );
  ok(
    "ship refuses on an UNREADABLE answer, so it fails closed",
    /state\s*===\s*"unreadable"/.test(shipCode),
    "a network or auth failure prints no migration names, and reading that as " +
      "nothing pending is how this guard would become decoration",
  );
  ok(
    "the refusal states the operator's next command",
    /applyCommand\(/.test(shipCode),
    "nobody should have to remember `wrangler d1 migrations apply` under the " +
      "pressure of a refused deploy",
  );

  /*
   * ORDERING, which is the half a presence check cannot see.
   *
   * A guard that runs AFTER the deploy is not a guard, it is a report. The
   * index comparison is crude and it is the right crudeness: it reads the
   * position of the guard's own announce against the deploy's, so moving
   * either one fails.
   */
  const guardAt = shipCode.indexOf("The deployed database has every migration");
  const deployAt = shipCode.indexOf('announce("Deploy")');
  ok(
    "both the migration guard and the deploy step were located",
    guardAt !== -1 && deployAt !== -1,
    `guard at ${guardAt}, deploy at ${deployAt}. If either moved or was renamed, ` +
      `the ordering assertion below would pass vacuously.`,
  );
  ok(
    "the migration guard is ordered BEFORE the deploy",
    guardAt !== -1 && deployAt !== -1 && guardAt < deployAt,
    "a schema check that runs after the deploy is a report, not a guard. Window " +
      "5 did not need a report; it needed something that stopped.",
  );
}

/* ------------- the LOCAL tier's ledger, when there is one to read --------- */

/*
 * **NOTHING READ THE LOCAL DATABASE, AND THAT IS WHY IT SAT TWO MIGRATIONS
 * BEHIND FOR A WEEK.**
 *
 * The blind spot was structural rather than an oversight. This gate hashes
 * FILES against the manifest and never opened a database at all.
 * `check:invariants` section 4 does compare against a database, but only behind
 * `--remote`, and its third source is the migrations REPLAYED into an in-memory
 * database, which is built from the same files it is checking and therefore
 * agrees with them by construction. So every instrument either read the files,
 * or read production. A tier lagging the files was invisible to all of them.
 *
 * ## WHY THIS GATE OWNS IT
 *
 * The subject is the migration SET, which is this gate's whole subject. It also
 * has to run OFFLINE, and this is the offline-tier gate for migrations;
 * section 4's database arm is remote-gated, so putting it there would mean a
 * local assertion that never runs in the tier that ships, or a second flag.
 *
 * ## READ DIRECTLY, NOT THROUGH WRANGLER, AND THE REASON IS A SIDE EFFECT
 *
 * `wrangler d1 execute --local` CREATES the local database when it is absent.
 * A gate that brings its own subject into existence cannot report on it, and it
 * would turn every fresh clone into a machine with a database it never asked
 * for. `node:sqlite` opens the file READ ONLY, and `check:invariants` already
 * reads sqlite this way, so this is the established path rather than a new one.
 *
 * ## A MISSING DATABASE IS NOT A LAGGING ONE
 *
 * Conflating them would put a false red on every fresh checkout and on CI,
 * which has no `.wrangler` state at all. Three states, and only the third can
 * fail:
 *
 *   no directory, or no candidate file   SKIP. Nothing has ever run here.
 *   a database with no d1_migrations     SKIP. `wrangler dev` creates the file
 *                                        lazily, so this is indistinguishable
 *                                        from a first run, and failing it would
 *                                        red the first `npm run dev` on a clone.
 *   a database WITH a ledger             COMPARED, and this is the real case:
 *                                        a tier that has been migrated before
 *                                        and has since fallen behind.
 *
 * **THE SKIP EMITS NO ASSERTION ON PURPOSE.** These `ok()` calls run only when
 * there is a ledger, so the executed count is lower on CI than on a developer
 * machine, and `MINIMUM_CHECKS` below is floored for the CI case. A skip that
 * counted would make the floor mean different things in different environments,
 * which is worse than a floor that is slightly loose.
 *
 * ## NAMES, NOT A COUNT
 *
 * The cheapest version compares `d1_migrations` row count against the number of
 * files. This compares the NAMES, both directions, for the same cost: a count
 * passes when a file is renamed, or when the ledger holds twelve rows that are
 * not these twelve, and both of those are the drift this exists to catch.
 */
const D1_STATE = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");

/** @returns {string[] | null} the ledger's names, or null when there is none to read */
function localLedger() {
  if (!existsSync(D1_STATE)) return null;
  const candidates = readdirSync(D1_STATE).filter(
    (n) => n.endsWith(".sqlite") && n !== "metadata.sqlite",
  );
  for (const name of candidates) {
    const db = new DatabaseSync(join(D1_STATE, name), { readOnly: true });
    try {
      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'")
        .get();
      if (!table) continue;
      return db
        .prepare("SELECT name FROM d1_migrations ORDER BY name")
        .all()
        .map((row) => String(row.name));
    } finally {
      db.close();
    }
  }
  return null;
}

const ledger = localLedger();
if (ledger === null) {
  console.log(
    "\n  SKIP  the local migration ledger. No local D1 under .wrangler/state, so there is\n" +
      "        nothing to compare. A missing database is not a lagging one, and failing\n" +
      "        here would red every fresh clone and every CI run.",
  );
} else {
  const onDisk = new Set(files);
  const applied = new Set(ledger);
  const notApplied = files.filter((f) => !applied.has(f));
  const unknown = ledger.filter((n) => !onDisk.has(n));

  /*
   * SCOPE FIRST. An empty ledger read against an empty file list would report
   * agreement by comparing nothing, which is this repo's most repeated defect.
   */
  ok(
    "the local ledger was read and there are migrations to compare it against",
    ledger.length > 0 && files.length > 0,
    `ledger holds ${ledger.length} row(s) and drizzle/ holds ${files.length} file(s)`,
  );
  ok(
    "every migration on disk is applied to the LOCAL database",
    notApplied.length === 0,
    `the local tier is BEHIND by ${notApplied.length}: ${notApplied.join(", ")}. ` +
      `Run \`wrangler d1 migrations apply dustinedwards --local\`. Production and local ` +
      `disagreeing about the schema is invisible to every other gate here.`,
  );
  ok(
    "the local ledger records nothing that is not on disk",
    unknown.length === 0,
    `the local ledger names ${unknown.join(", ")}, which drizzle/ does not contain. ` +
      `A migration was renamed or deleted after being applied, which hard rule 14 forbids.`,
  );
}

/*
 * EXECUTED-COUNT FLOOR.
 *
 * MINIMUM_MIGRATIONS above floors the SCOPE, which is a different question: it
 * catches a directory that stopped being read. This catches an assertion block
 * that stopped running over a directory that is still full, and neither can see
 * the other's bug.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, both cases, on
 * 2026-08-22. **THE COUNT NOW DEPENDS ON THE ENVIRONMENT and the floor is set
 * for the lower one**, which is the half that would otherwise bite CI:
 *
 *   47  no local D1 (a fresh clone, and every CI run). The ledger section
 *       skips and emits no assertion, deliberately.
 *   50  a machine with a local D1. The same run plus the ledger's three.
 *
 * Floored at 44, slack of three under the CI case. Never summed: 47 and 50 are
 * both read off a run. It was 41 against a measured 44 before the two
 * migrations this arc added and before the ledger section, and the count steps
 * by a fixed amount per migration, which is append-only by hard rule 14.
 */
const MINIMUM_CHECKS = 44;
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
