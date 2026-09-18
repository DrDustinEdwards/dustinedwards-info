/**
 * Gate: an applied migration is never edited.
 *
 *   npm run check:migrations
 *   node scripts/check-migrations.mjs --write [--force]
 *
 * BOUNDARY: **IT PROVES THE FILES MATCH THE MANIFEST. Nothing more.** What stops a dishonest
 * manifest is the diff and `--write` refusing to alter an existing hash without `--force`; what
 * the LIVE database applied is `check:invariants --remote`'s half. IT HASHES NORMALIZED CONTENT,
 * NOT RAW BYTES: with autocrlf on, the working tree and its own committed blobs disagree about
 * line endings. WHY IT EXISTS: hard rule 14. The replay section catches an edit that MOVES A
 * COLUMN and nothing else, so seed data, an index, a trigger or FTS DDL is invisible elsewhere.
 * **RULE 12 CANNOT BE SATISFIED HERE:** no migration has ever been edited after being applied, so
 * this is verified by PLANTS ONLY, which that rule warns match the implementation not the bug.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(root, "drizzle");
const MANIFEST = join(MIGRATIONS, "manifest.json");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const FORCE = args.includes("--force");

/**
 * Below this the directory is not a migrations directory. The earlier value could not notice a
 * third of it being deleted, and the first migration is the only copy of the CREATE TABLEs.
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
 * The migration's CONTENT, with CRLF collapsed: with autocrlf on, a working tree and its own
 * committed blobs disagree, so a raw-byte manifest is valid only where it was written.
 *
 * @param {string} file
 */
function hashOf(file) {
  const content = readFileSync(join(MIGRATIONS, file), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

console.log("\ncheck:migrations\n");

/* fail closed first */

if (!existsSync(MIGRATIONS)) {
  console.log("  FAIL  drizzle/ is missing. Refusing to pass with nothing to check.\n");
  process.exit(1);
}

const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/*
 * THROUGH assertFloor: migrations are append-only, the purest growing set in the repo, so a floor
 * left alone goes slack on its own. STILL A HARD EXIT rather than a counted assertion, because
 * continuing past a truncated directory would measure a corpus that is not there.
 */
const migrationsBreach = assertFloor(
  "check:migrations",
  "migrations",
  files.length,
  MINIMUM_MIGRATIONS,
  "Either the directory is wrong or migrations have been deleted. 0001_init.sql is the " +
    "ONLY copy of the CREATE TABLE statements that exists anywhere, because " +
    "wrangler d1 export is broken on this database.",
);
if (migrationsBreach) {
  console.log(`  FAIL  ${migrationsBreach}\n`);
  process.exit(1);
}

/* generator */

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
   * REFUSES TO LAUNDER AN EDIT: regenerating is the obvious way to make this gate green, so a hash
   * that CHANGES needs `--force`, which puts the decision in the shell history. A NEW file needs
   * nothing.
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

/* the checking */

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


/* ship refuses on a pending migration */

/*
 * **AUTHORING A MIGRATION MUST CREATE AN OBLIGATION SOMEWHERE, AND THIS IS IT.** A ship deployed
 * with every offline gate green and the media admin page 500d on first load, a migration having
 * been pending on the remote database since the session that authored it. THIS SECTION BELONGS
 * HERE: what this gate owns is the MIGRATION CONTRACT, and "a migration in the repo is applied
 * before the code that needs it deploys" is a clause of it. SOURCE LEVEL: it reads what ship
 * DECLARES, and must not run ship, a deploy guard being proven on its PREDICATE IN ISOLATION.
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
   * ORDERING, the half a presence check cannot see: a guard that runs AFTER the deploy is a report.
   * The index comparison is crude and it is the right crudeness, moving either end failing it.
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

/* the LOCAL tier's ledger, when there is one to read */

/*
 * **NOTHING READ THE LOCAL DATABASE, AND THAT IS WHY IT SAT TWO MIGRATIONS BEHIND.** The blind
 * spot was structural: this gate hashes FILES, and the gate that does compare against a database
 * is remote-gated and builds its third source by REPLAYING the same files. READ DIRECTLY, NOT
 * THROUGH WRANGLER: `d1 execute --local` CREATES the local database when absent, and a gate that
 * brings its own subject into existence cannot report on it. Opened READ ONLY. A MISSING DATABASE
 * IS NOT A LAGGING ONE: three states, and only the third can fail. **THE SKIP EMITS NO ASSERTION
 * ON PURPOSE**, so the floor below is set for the CI case. NAMES, NOT A COUNT: a count passes
 * when a file is renamed.
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
 * EXECUTED-COUNT FLOOR. The scope floor catches a directory that stopped being read; this catches
 * an assertion block that stopped running over a full one. MEASURED BY RUNNING IT, both cases.
 * **THE COUNT DEPENDS ON THE ENVIRONMENT and the floor is set for the lower one**, the ledger
 * section emitting no assertion where there is no local database. It steps by a fixed amount per
 * migration, which is append-only by hard rule 14.
 */
const MINIMUM_CHECKS = 53;
const floorBreach = assertFloor("check:migrations", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
