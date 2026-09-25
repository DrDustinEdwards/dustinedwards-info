import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { parseSource, ts } from "./lib/syntax.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(root, "drizzle");
const MANIFEST = join(MIGRATIONS, "manifest.json");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const FORCE = args.includes("--force");

const MINIMUM_MIGRATIONS = 18;

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
 * CRLF collapsed: with autocrlf on, a working tree and its own committed blobs disagree.
 *
 * @param {string} file
 */
function hashOf(file) {
  const content = readFileSync(join(MIGRATIONS, file), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

console.log("\ncheck:migrations\n");

if (!existsSync(MIGRATIONS)) {
  console.log("  FAIL  drizzle/ is missing. Refusing to pass with nothing to check.\n");
  process.exit(1);
}

const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// A hard exit rather than a counted assertion: continuing past a truncated directory would measure
// a corpus that is not there.
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

  // Regenerating is the obvious way to make this gate green, so a changed hash needs `--force`, which
  // puts the decision in the shell history.
  if (changed.length > 0 && !FORCE) {
    console.log(
      `  REFUSED: ${changed.length} existing hash(es) would CHANGE: ${changed.join(", ")}\n` +
        `  That means an applied migration was edited, which the hand-written migration rule forbids.\n` +
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
      `        AN APPLIED MIGRATION HAS BEEN EDITED. The schema test only sees\n` +
      `        an edit that MOVES A COLUMN; seed data, an index, a trigger or FTS DDL\n` +
      `        changes what a fresh clone builds and is invisible to every other gate.\n` +
      `        The repair is a NEW numbered migration, never an edit to this one.`,
  );
}

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


// Source level only: it reads what ship declares, because running ship would deploy.

const SHIP = join(root, "scripts", "ship.mjs");

ok(
  "scripts/ship.mjs exists",
  existsSync(SHIP),
  "without it nothing below examines anything",
);

if (existsSync(SHIP)) {
  // Read off the syntax tree: each assertion names the construct it needs (an import, a call, an if
  // whose branch calls refuse), so a string, a comment or an unrelated token elsewhere cannot pass it.
  const sf = parseSource(SHIP, readFileSync(SHIP, "utf8"));

  /** @param {(n: ts.Node) => boolean} test @returns {ts.Node[]} */
  const findAll = (test) => {
    /** @type {ts.Node[]} */
    const out = [];
    /** @param {ts.Node} n */
    const visit = (n) => {
      if (test(n)) out.push(n);
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return out;
  };
  /** @param {ts.Node} n @param {string} name */
  const isCallTo = (n, name) =>
    ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name;
  /** @param {ts.Node} scope @param {string} name */
  const callsIn = (scope, name) => {
    let found = false;
    /** @param {ts.Node} n */
    const visit = (n) => {
      if (isCallTo(n, name)) found = true;
      if (!found) ts.forEachChild(n, visit);
    };
    visit(scope);
    return found;
  };
  /**
   * The `if (<x>.state === "<state>") { ... }` whose branch refuses. Ship tests `unreadable` twice,
   * once to retry and once to refuse, so the first match is not necessarily the guard.
   *
   * @param {string} state
   * @returns {ts.IfStatement | undefined}
   */
  const stateBranch = (state) =>
    /** @type {ts.IfStatement[]} */ (
      findAll(
        (n) =>
          ts.isIfStatement(n) &&
          ts.isBinaryExpression(n.expression) &&
          n.expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
          ts.isPropertyAccessExpression(n.expression.left) &&
          n.expression.left.name.text === "state" &&
          ts.isStringLiteralLike(n.expression.right) &&
          n.expression.right.text === state,
      )
    ).find((branch) => callsIn(branch.thenStatement, "refuse"));

  const imported = findAll(
    (n) =>
      ts.isImportDeclaration(n) &&
      ts.isStringLiteralLike(n.moduleSpecifier) &&
      n.moduleSpecifier.text.endsWith("/pending-migrations.mjs") &&
      Boolean(
        n.importClause?.namedBindings &&
          ts.isNamedImports(n.importClause.namedBindings) &&
          n.importClause.namedBindings.elements.some((e) => e.name.text === "readMigrationList"),
      ),
  );
  ok(
    "ship imports the pending-migration predicate and calls it",
    imported.length > 0 && findAll((n) => isCallTo(n, "readMigrationList")).length > 0,
    "the guard's decision lives in scripts/lib/pending-migrations.mjs, which is " +
      "unit tested. A guard reimplemented inline in ship would be untested by " +
      "construction, because nothing can run ship without deploying.",
  );

  const listArgs = findAll((n) => {
    if (!ts.isArrayLiteralExpression(n)) return false;
    const words = n.elements.map((e) => (ts.isStringLiteralLike(e) ? e.text : null));
    const at = words.indexOf("migrations");
    return at !== -1 && words[at + 1] === "list" && words.includes("--remote");
  });
  ok(
    "ship asks the deployed database which migrations are applied",
    listArgs.length > 0,
    "no argument list carrying migrations, list and --remote was found. The " +
      "comparison is against the DATABASE, not against the manifest. The " +
      "manifest comparison above cannot see an unapplied migration at all.",
  );

  const pendingBranch = stateBranch("pending");
  ok(
    "ship refuses on a PENDING migration",
    pendingBranch !== undefined && callsIn(pendingBranch.thenStatement, "refuse"),
    "it must refuse rather than apply: additive and destructive are " +
      "indistinguishable from ship, so the operator decides",
  );
  const unreadableBranch = stateBranch("unreadable");
  ok(
    "ship refuses on an UNREADABLE answer, so it fails closed",
    unreadableBranch !== undefined && callsIn(unreadableBranch.thenStatement, "refuse"),
    "a network or auth failure prints no migration names, and reading that as " +
      "nothing pending is how this guard would become decoration",
  );
  ok(
    "the refusal states the operator's next command",
    pendingBranch !== undefined && callsIn(pendingBranch.thenStatement, "applyCommand"),
    "nobody should have to remember `wrangler d1 migrations apply` under the " +
      "pressure of a refused deploy",
  );

  // Ordering: a guard that runs after the deploy is a report.
  const deployCall = findAll(
    (n) =>
      isCallTo(n, "announce") &&
      ts.isCallExpression(n) &&
      ts.isStringLiteralLike(n.arguments[0]) &&
      n.arguments[0].text === "Deploy",
  )[0];
  const guardAt = pendingBranch ? pendingBranch.getStart(sf) : -1;
  const deployAt = deployCall ? deployCall.getStart(sf) : -1;
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

// Read directly, not through wrangler: `d1 execute --local` creates the local database when absent.
// Opened read only. A missing database emits no assertion, so the floor below is set for CI.
const D1_STATE = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");

/**
 * Every local database carrying a migration ledger. More than one is ambiguous: directory order would
 * decide which was compared, and a stale one could answer for the live one.
 *
 * @returns {Array<{ file: string, names: string[] }>}
 */
function localLedgers() {
  if (!existsSync(D1_STATE)) return [];
  const candidates = readdirSync(D1_STATE).filter(
    (n) => n.endsWith(".sqlite") && n !== "metadata.sqlite",
  );
  /** @type {Array<{ file: string, names: string[] }>} */
  const out = [];
  for (const name of candidates) {
    const db = new DatabaseSync(join(D1_STATE, name), { readOnly: true });
    try {
      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'")
        .get();
      if (!table) continue;
      out.push({
        file: name,
        names: db
          .prepare("SELECT name FROM d1_migrations ORDER BY name")
          .all()
          .map((row) => String(row.name)),
      });
    } finally {
      db.close();
    }
  }
  return out;
}

const ledgers = localLedgers();
if (ledgers.length > 1) {
  ok(
    "exactly one local database carries a migration ledger",
    false,
    `${ledgers.length} do (${ledgers.map((l) => l.file).join(", ")}), so which one this compared ` +
      "would be decided by directory order. Remove the stale one under .wrangler/state.",
  );
}
const ledger = ledgers.length === 1 ? ledgers[0].names : null;
// CI applies the migrations locally before the gates run, so there a missing ledger is a broken step,
// not a fresh clone, and skipping would pass the comparison over nothing.
if (ledger === null && ledgers.length === 0 && process.env.CI === "true") {
  ok(
    "the local migration ledger exists in CI",
    false,
    "CI's setup step runs `wrangler d1 migrations apply --local` before the gates, so the " +
      "ledger must be there. Its absence means that step or this path changed.",
  );
} else if (ledger === null) {
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

  // Scope first: an empty ledger against an empty file list would report agreement over nothing.
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
      `A migration was renamed or deleted after being applied, which the hand-written migration rule forbids.`,
  );
}

// Measured by running it, set for the lower environment: without a local database the three
// assertions comparing the applied set to it do not run.
const MINIMUM_CHECKS = 65;
const floorBreach = assertFloor("check:migrations", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
