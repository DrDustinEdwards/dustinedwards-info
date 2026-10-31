import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSource, ts } from "./lib/syntax.mjs";
import { stripComments } from "./lib/strip-comments.mjs";
import { missReport } from "./lib/ship-misses.mjs";
import { functionBody } from "./lib/source-body.mjs";
import { createTally } from "./lib/tally.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const FORCE = args.includes("--force");

const MINIMUM_MIGRATIONS = 25;

const tally = createTally();
const { ok, eq } = tally;

console.log("\ncheck:migrations\n");

/*
 * THE MANIFEST AND THE LEDGER ARE devkit-migrations' (devkit v0.20.14, which took them from this file): every
 * migration recorded by sha256 in drizzle/manifest.json and byte-identical to it, nothing recorded that is gone, at
 * least MINIMUM_MIGRATIONS on disk (0001_init.sql is the only copy of the CREATE TABLE statements anywhere, because
 * wrangler d1 export is broken on this database), the expand-only rule after the manifest's `expand_only_after`, and
 * the local ledger equal to the files. CI applies the migrations locally before the gates, so there a missing ledger
 * is a broken step: --require-ledger. A new migration records its hash with `npx devkit-migrations drizzle --write`.
 * What stays here is this site's own: the ship step order the migrations depend on.
 */
const devkit = spawnSync(
  process.execPath,
  [
    join(root, "node_modules", "@dustinedwards", "devkit", "bin", "migrations.mjs"),
    "drizzle",
    "--min",
    String(MINIMUM_MIGRATIONS),
    ...(process.env.CI === "true" ? ["--require-ledger"] : []),
    ...(WRITE ? ["--write"] : []),
    ...(FORCE ? ["--force"] : []),
  ],
  { cwd: root, encoding: "utf8" },
);
process.stdout.write(`${devkit.stdout ?? ""}${devkit.stderr ?? ""}`);
if (WRITE) process.exit(devkit.status ?? 1);
ok("devkit-migrations passes on drizzle/", devkit.status === 0, "its lines above name each problem");

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
    "ship refuses a PENDING migration that can lose data",
    pendingBranch !== undefined &&
      callsIn(pendingBranch.thenStatement, "destructiveStatements") &&
      callsIn(pendingBranch.thenStatement, "refuse"),
    "ship applies only what destructiveStatements (scripts/lib/pending-migrations.mjs, unit tested) " +
      "calls additive; a DROP, DELETE, UPDATE or rename is the operator's call",
  );
  ok(
    "ship reads the Time Travel bookmark before it applies a migration",
    pendingBranch !== undefined && callsIn(pendingBranch.thenStatement, "readBookmark"),
    "an applied migration is undone by a Time Travel restore, never by a Worker rollback, so " +
      "the undo point is read first and a missing one refuses",
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

// Ship step ORDER for the derived indexes and the readiness check, read off ship.mjs the way the
// migration guard above is.
{
  const apiSource = stripComments(
    readFileSync(join(root, "app/lib/operator/api.server.ts"), "utf8"),
  );
  /* The tool bodies live beside the dispatcher; the dispatcher names the tool, the body builds the verdict. */
  const syncToolsSource = stripComments(
    readFileSync(join(root, "app/lib/operator/sync-tools.server.ts"), "utf8"),
  );
  const shipSource = stripComments(readFileSync(join(root, "scripts/ship.mjs"), "utf8"));
  /* Ship's two operator-API converge steps live here, called from ship by name. */
  const syncSource = stripComments(
    readFileSync(join(root, "scripts/lib/operator-sync.mjs"), "utf8"),
  );

  eq("ask sync: the operator API was read", apiSource.length > 2000, true);
  eq("ask sync: the operator sync tools were read", syncToolsSource.length > 2000, true);
  eq("ask sync: ship.mjs was read", shipSource.length > 2000, true);
  eq("ask sync: lib/operator-sync.mjs was read", syncSource.length > 1000, true);

  eq(
    "ask sync: the operator API exposes sync_ask",
    /"sync_ask"/.test(apiSource),
    true,
  );
  eq(
    "ask sync: the tool derives its verdict from a report module, not inline",
    /askSyncReport\(/.test(syncToolsSource),
    true,
  );

  eq(
    "ask sync: SHIP CALLS sync_ask, through convergeAsk",
    /\bawait convergeAsk\(/.test(shipSource) && /operatorSync\("sync_ask"/.test(syncSource),
    true,
  );

  /* ORDER: the upload writes what the DEPLOYED Worker serves, so it runs after deploy and sync. */
  const deployAt = shipSource.indexOf('announce("Deploy")');
  const syncAt = shipSource.indexOf('announce("Sync content to remote D1")');
  /* The CALL, not the first mention: the import names convergeAsk too. */
  const askAt = shipSource.indexOf("await convergeAsk(");
  eq("ask sync: the deploy step was located", deployAt !== -1, true);
  eq("ask sync: the D1 sync step was located", syncAt !== -1, true);
  eq(
    "ask sync: THE ASK UPLOAD RUNS AFTER THE DEPLOY AND AFTER THE D1 SYNC",
    askAt !== -1 && deployAt !== -1 && syncAt !== -1 && askAt > deployAt && askAt > syncAt,
    true,
  );

  /* A step whose result is discarded cannot fail. */
  /* In the sync_ask step, and as the comparison itself: any identifier containing the word passed. */
  const askStep = functionBody(syncSource, /export async function convergeAsk\b/);
  eq(
    "ask sync: ship reads a converged verdict rather than a status code alone",
    /report\.converged\s*!==\s*true/.test(askStep),
    true,
  );
  /* THE EXIT CONDITION ITSELF: a block that PRINTS the miss keeps the name inside the window. */
  const lastExit = shipSource.lastIndexOf("process.exit(1)");
  const guardOpen = shipSource.lastIndexOf("\nif (", lastExit);
  const guard =
    guardOpen === -1 ? "" : shipSource.slice(guardOpen, shipSource.indexOf(") {", guardOpen) + 1);
  eq("sync: the final exit guard was located", guard.length > 0 && guard.length < 200, true);
  /* The guard exits on the report the misses table produces, so a miss reaches the exit code by
     being a row of that table. */
  const tableAt = shipSource.indexOf("const misses = [");
  const missTable = tableAt === -1 ? "" : shipSource.slice(tableAt, shipSource.indexOf("];", tableAt));
  eq(
    "ship: the final exit guard reads the report built from the misses table",
    /\bmissLines\b/.test(guard) &&
      /const\s+missLines\s*=\s*missReport\(\s*misses\s*,/.test(shipSource) &&
      missTable.length > 0,
    true,
  );
  eq(
    "ship: the miss report is empty when nothing missed",
    missReport([{ key: "ask", title: "THE ASK INDEX", text: "" }], "abc1234").length,
    0,
  );
  eq(
    "ship: the miss report names every miss it is given",
    missReport(
      [
        { key: "ask", title: "THE ASK INDEX", text: "one" },
        { key: "media", title: "THE MEDIA INDEX", text: "" },
        { key: "render", title: "THE RENDER", text: "two" },
      ],
      "abc1234",
    ).filter((line) => /^ {2}(ask|render): +(one|two)$/.test(line)).length,
    2,
  );

  eq(
    "ask sync: SHIP EXITS NONZERO WHEN THE INDEX DID NOT CONVERGE",
    /\baskMiss\b/.test(missTable),
    true,
  );
  const recordAt = shipSource.indexOf('announce("Shipped")');
  const exitAt = shipSource.lastIndexOf("process.exit(1)");
  eq(
    "ask sync: the shipped record prints BEFORE the nonzero exit",
    recordAt !== -1 && exitAt !== -1 && recordAt < exitAt,
    true,
  );

  /* READINESS, BETWEEN DEPLOY AND FIRST WRITE: five 200s are blind to what /api/health reports. */
  const readinessAt = shipSource.indexOf("READINESS_PATH} reports ok");
  eq(
    "readiness: the step was located",
    readinessAt !== -1,
    true,
  );
  eq(
    "readiness: ship asks the health endpoint",
    /const\s+READINESS_PATH\s*=\s*"\/api\/health"/.test(shipSource),
    true,
  );
  eq(
    "readiness: THE CHECK RUNS AFTER THE DEPLOY AND BEFORE THE D1 SYNC",
    readinessAt !== -1 &&
      deployAt !== -1 &&
      syncAt !== -1 &&
      readinessAt > deployAt &&
      readinessAt < syncAt,
    true,
  );
  const readinessSource = stripComments(
    readFileSync(join(root, "scripts/lib/readiness.mjs"), "utf8"),
  );
  eq("readiness: the module was read", readinessSource.length > 1000, true);
  eq(
    "readiness: the verdict is decided from the parsed body, not the status",
    /value\.ok\s*!==\s*true/.test(readinessSource),
    true,
  );
  /* AND A BODY WITH NO CHECKS REFUSES: any JSON on the origin can carry ok:true. */
  eq(
    "readiness: a body carrying no checks is refused",
    /checks\.length\s*===\s*0/.test(readinessSource),
    true,
  );
  eq(
    "readiness: SHIP REFUSES ON THE VERDICT rather than logging it",
    /if\s*\(!verdict\.ok\)\s*refuse\(/.test(shipSource),
    true,
  );

  /* BOTH HALVES: deferring without the late assertion drops the check, and the reverse deadlocks. */
  const deferredAt = readinessSource.indexOf("DEFERRED_CHECKS = {");
  eq("the deferred checks are named in one place", deferredAt !== -1, true);
  /* ALL TWELVE, ENUMERATED: a regex for content-drift alone passes once the others are gone. */
  for (const name of [
    "content-drift",
    "procedures-drift",
    "dictionary-drift",
    "pages-drift",
    "publications-drift",
    "llms-drift",
    "cv-drift",
    "roster-drift",
    "phage-drift",
    "registry-drift",
    "cv-pdf-drift",
    "ask-index-drift",
    "media-index-drift",
  ]) {
    eq(
      `${name} is deferred`,
      new RegExp(`"${name}":\\s*"the [A-Za-z0-9 ]+"`).test(readinessSource),
      true,
    );
  }
  eq(
    "every deferred check names the step that repairs it",
    !/"[a-z-]+":\s*"",?\s*$/m.test(readinessSource),
    true,
  );
  eq(
    "the readiness step passes them to the verdict",
    /readinessVerdict\([^)]*Object\.keys\(DEFERRED_CHECKS\)\)/.test(shipSource),
    true,
  );
  eq(
    "the module subtracts deferred names rather than reading ok",
    /gatingFailed/.test(readinessSource),
    true,
  );
  /* AND ASSERTED AFTER THE SYNC, or a check that merely exists is the deadlock again. */
  const contentDriftAt = shipSource.indexOf("deferredMisses(verdict.checks, DEFERRED_CHECKS");
  eq("the late assertion was located", contentDriftAt !== -1, true);
  eq(
    "THE DEFERRED CHECKS ARE ASSERTED AFTER THE D1 SYNC",
    contentDriftAt !== -1 && syncAt !== -1 && contentDriftAt > syncAt,
    true,
  );
  eq(
    "a still-drifted corpus reaches the exit code",
    /\bdeferredMiss\b/.test(missTable),
    true,
  );
  /* EVERY miss ship records, read off its declarations: one that prints but is missing from the
     misses table is a deploy that reports a fault and exits 0. */
  const missNames = [...shipSource.matchAll(/\b(?:let|const)\s+(\w+Miss)\s*=/g)].map((m) => m[1]);
  eq("ship: its miss variables were found", missNames.length >= 6, true);
  for (const name of missNames) {
    eq(`ship: ${name} reaches the final exit guard`, new RegExp(`\\b${name}\\b`).test(missTable), true);
  }

  /* The uptime step: an absent key is a skip, decided in one tested function, and every other
     outcome of uptime-ensure stays a miss. */
  eq(
    "uptime: ship decides the step through uptimeStepOutcome on uptime-ensure's code and output",
    /uptimeStepOutcome\(\s*ensured\.code\s*,\s*ensured\.text\s*\)/.test(shipSource),
    true,
  );
  eq(
    "uptime: THE SKIP STAYS OUT OF THE MISSES TABLE, so an absent key does not end the run red",
    /\buptimeSkip\b/.test(missTable),
    false,
  );
  const skipRecordAt = shipSource.indexOf("if (uptimeSkip) console.log(");
  eq(
    "uptime: the skip note is repeated in the shipped record, before the exit guard",
    skipRecordAt !== -1 && skipRecordAt > recordAt && skipRecordAt < exitAt,
    true,
  );
  /* ONE skip exit, and only on a GitHub runner: a second exit with that code, or one outside the
     runner guard, would turn a lost key on the operator machine into a green ship. */
  const ensureSource = stripComments(readFileSync(join(root, "scripts/uptime-ensure.mjs"), "utf8"));
  eq(
    "uptime: uptime-ensure has exactly one exit with KEY_ABSENT_EXIT",
    [...ensureSource.matchAll(/process\.exit\(\s*KEY_ABSENT_EXIT\s*\)/g)].length,
    1,
  );
  eq(
    "uptime: that exit sits inside the GitHub-runner guard",
    /if\s*\(\s*keylessRunIsExpected\(\s*process\.env\s*\)\s*\)\s*\{[^}]*process\.exit\(\s*KEY_ABSENT_EXIT\s*\)/.test(
      ensureSource,
    ),
    true,
  );

  eq(
    "media sync: the operator API exposes sync_media",
    /"sync_media"/.test(apiSource),
    true,
  );
  eq(
    "media sync: the tool derives its verdict from a report module, not inline",
    /mediaSyncReport\(/.test(syncToolsSource),
    true,
  );
  eq(
    "media sync: the tool repairs THROUGH the derivation, not by writing rows",
    /rebuildMediaIndex\(env\)/.test(syncToolsSource),
    true,
  );
  eq(
    "media sync: the verdict comes from a read-back reconciliation",
    /mediaIndexStatus\(env\)/.test(syncToolsSource),
    true,
  );

  eq(
    "media sync: SHIP CALLS sync_media, through convergeMedia",
    /\bawait convergeMedia\(/.test(shipSource) && /operatorSync\("sync_media"/.test(syncSource),
    true,
  );

  const mediaAt = shipSource.indexOf("await convergeMedia(");

  /* cv-pdf-drift is deferred, so something must repair it: the step exists, runs after the D1 sync and
     before the media index (a first render adds a derived/ key), and reaches the exit code. */
  const cvPdfAt = shipSource.indexOf("await convergeCvPdf(");
  eq(
    "cv pdf: SHIP CALLS sync_cv_pdf, through convergeCvPdf",
    cvPdfAt !== -1 && /operatorSync\("sync_cv_pdf"/.test(syncSource),
    true,
  );
  eq(
    "cv pdf: THE RENDER RUNS AFTER THE D1 SYNC AND BEFORE THE MEDIA INDEX",
    cvPdfAt !== -1 && syncAt !== -1 && cvPdfAt > syncAt && mediaAt !== -1 && cvPdfAt < mediaAt,
    true,
  );
  eq("cv pdf: SHIP EXITS NONZERO WHEN THE PDF DID NOT CONVERGE", /\bcvPdfMiss\b/.test(missTable), true);
  eq(
    "media sync: THE REBUILD RUNS AFTER THE DEPLOY",
    mediaAt !== -1 && deployAt !== -1 && mediaAt > deployAt,
    true,
  );
  eq(
    "media sync: SHIP EXITS NONZERO WHEN THE INDEX DID NOT RECONCILE",
    /\bmediaMiss\b/.test(missTable),
    true,
  );
  eq(
    "media sync: the shipped record prints BEFORE the media miss can exit",
    recordAt !== -1 && exitAt !== -1 && recordAt < exitAt && mediaAt < recordAt,
    true,
  );
}

// Measured by running it (2026-10-31: 79). The per-migration hash and ledger assertions moved to devkit-migrations,
// which counts as one here, so the count no longer depends on the number of migrations or a local database.
const MINIMUM_CHECKS = 79;
tally.floor("check:migrations", "checks", MINIMUM_CHECKS);

if (tally.failures > 0) {
  console.log(`\n${tally.failures} FAILED of ${tally.checks} checks\n`);
  process.exit(1);
}
console.log(`\n${tally.checks} checks, 0 failures\n`);
