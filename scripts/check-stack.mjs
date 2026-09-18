/**
 * Gate over the colophon's generated stack data, reconciled against its sources both ways.
 *
 *   npm run check:stack
 *
 * BOUNDARY, TWO LIMITS: it cannot tell whether the hand-written PROSE is true, only that the
 * binding it describes exists, and **it reads the EXAMPLE config, which is not what is deployed**.
 * CI cannot close that gap, because a checkout bootstraps the real config by copying the example,
 * so a green run there compares the example to itself and says nothing about production.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  NOTES_PATH,
  STACK_PATH,
  EXAMPLE_CONFIG,
  gateNames,
  migrationFiles,
  runtimeVersions,
} from "./build-stack.mjs";
import {
  parseJsonc,
  surfaceOf,
  unhandledBindingKinds,
} from "./lib/wrangler-surface.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let checks = 0;
let failures = 0;

/**
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [detail]
 */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
  }
}

/**
 * Two sets compared in BOTH directions, as one pair of assertions.
 *
 * @param {string} what
 * @param {string[]} expected  derived from the source
 * @param {string[]} actual    what the artifact carries
 */
function reconcile(what, expected, actual) {
  const missing = expected.filter((x) => !actual.includes(x));
  const extra = actual.filter((x) => !expected.includes(x));
  ok(
    `every ${what} in the source is in stack.json`,
    missing.length === 0,
    `stack.json is missing ${missing.join(", ")}. Run build:stack.`,
  );
  ok(
    `every ${what} in stack.json is still in the source`,
    extra.length === 0,
    `stack.json still advertises ${extra.join(", ")}, which no longer exists.`,
  );
}

console.log("\ncheck:stack\n");

if (!existsSync(STACK_PATH)) {
  console.log("  FAIL  content/generated/stack.json is missing.");
  console.log("        It is a gitignored build product since ruling 39a, not a commit.");
  console.log("        Generate it with: npm run build:stack");
  console.log("        check-all, ship and CI run that before any gate; if one of them");
  console.log("        reached here, its build step is missing.\n");
  process.exit(1);
}

const artifact = JSON.parse(readFileSync(STACK_PATH, "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const config = parseJsonc(EXAMPLE_CONFIG);
const notes = JSON.parse(readFileSync(NOTES_PATH, "utf8"));

/* fail closed first */

const sourceBindings = [...surfaceOf(config).keys()];
const sourceGates = gateNames(pkg);
const sourceDeps = runtimeVersions(pkg).map((d) => `${d.name}@${d.range}`);
const sourceMigrations = migrationFiles(
  config.d1_databases?.[0]?.migrations_dir ?? "drizzle",
);

ok(
  "the config declares at least one binding",
  sourceBindings.length > 0,
  "surfaceOf() found none, so every binding comparison below would pass vacuously",
);

/*
 * The blind spot, made loud: a binding KIND no reader understands produces no rows on either side,
 * so the artifact and the config agree by both being empty.
 */
const unreadable = unhandledBindingKinds(config);
ok(
  "every binding kind in the config can actually be read",
  unreadable.length === 0,
  `${unreadable.join(", ")} declares bindings that surfaceOf() does not know how to ` +
    `enumerate, so they are invisible to this gate and to check:config. ` +
    `Add a reader in scripts/lib/wrangler-surface.mjs.`,
);
ok(
  "package.json declares at least one gate",
  sourceGates.length > 0,
  "no check:* scripts found",
);
ok(
  "package.json declares at least one runtime dependency",
  sourceDeps.length > 0,
);
ok(
  "the migrations directory is not empty",
  sourceMigrations.length > 0,
  "no .sql files found, so a stack.json claiming zero migrations would pass",
);
ok(
  "the artifact itself is not empty",
  Array.isArray(artifact.bindings) && artifact.bindings.length > 0,
  "stack.json carries no bindings",
);

/* shape and freshness */

ok(
  "the artifact declares the shape this gate understands",
  artifact.version === 1,
  `stack.json is version ${artifact.version}; this gate reads version 1`,
);

/*
 * FRESHNESS, WHICH REPLACED A COMPARISON THAT WAS ASKING THE WRONG QUESTION. It compared A COMMIT
 * TO A BUILD, so the only way to satisfy it was a human running the build and committing the
 * result in the same change, and a dependency bot cannot run a build. The question is now "did a
 * build happen", which mtime answers. The reconciles below read the artifact's CONTENT, so they
 * catch a regeneration that produced the wrong thing.
 */
const stackMtime = statSync(STACK_PATH).mtimeMs;
const pkgMtime = statSync(join(root, "package.json")).mtimeMs;
ok(
  "the generated stack.json is newer than package.json",
  stackMtime >= pkgMtime,
  `content/generated/stack.json predates the last change to package.json, so it was ` +
    `derived from an older one (by ${pkgMtime - stackMtime}ms). Run build:stack. ` +
    `check-all, ship, check:head and CI all do this before any gate runs, so seeing this ` +
    `from one of them means the build step is missing rather than that you forgot.`,
);

/* both directions */

reconcile(
  "binding",
  sourceBindings,
  artifact.bindings.map((/** @type {any} */ b) => b.id),
);
reconcile("gate", sourceGates, artifact.gates ?? []);
reconcile("migration", sourceMigrations, artifact.migrations ?? []);
reconcile(
  "dependency",
  sourceDeps,
  (artifact.dependencies ?? []).map(
    (/** @type {any} */ d) => `${d.name}@${d.range}`,
  ),
);

/* the hand-written half, both directions */

const notedIds = Object.keys(notes.bindings ?? {});
reconcile("noted binding", sourceBindings, notedIds);

const unexplained = artifact.bindings.filter(
  (/** @type {any} */ b) => !b.what || !b.whyLoadBearing,
);
ok(
  "every binding says what it is and why it is load-bearing",
  unexplained.length === 0,
  `${unexplained.map((/** @type {any} */ b) => b.id).join(", ")} carries no note. ` +
    `A binding on the colophon with no reason is a logo wall entry.`,
);

ok(
  "the not-adopted list is not empty",
  (artifact.notAdopted ?? []).length > 0,
  "the ruling requires these entries, which are what make the list credible",
);
const unreasoned = (artifact.notAdopted ?? []).filter(
  (/** @type {any} */ n) => !n.name || !n.reason,
);
ok(
  "every not-adopted entry carries a reason",
  unreasoned.length === 0,
  unreasoned.map((/** @type {any} */ n) => n.name ?? "(unnamed)").join(", "),
);

/*
 * A refusal and an accepted gap are DIFFERENT CLAIMS and the page states which: one entry was not
 * a refusal, and calling it one would publish a decision nobody made, on the page whose subject is
 * what was decided. The status is CLOSED rather than free text. This list is the SECOND owner of
 * that vocabulary: `check:features` asserts both directions against the page's label map.
 */
const STATUSES = ["refused"];
const badStatus = (artifact.notAdopted ?? []).filter(
  (/** @type {any} */ n) => !STATUSES.includes(n.status),
);
ok(
  "every not-adopted entry declares refused or accepted-gap",
  badStatus.length === 0,
  badStatus
    .map(
      (/** @type {any} */ n) =>
        `${n.name ?? "(unnamed)"} has status ${JSON.stringify(n.status ?? null)}`,
    )
    .join("; ") + `. Allowed: ${STATUSES.join(", ")}.`,
);

/* runtime facts */

ok(
  "the compatibility date matches the config",
  artifact.runtime?.compatibilityDate === config.compatibility_date,
  `stack.json says ${artifact.runtime?.compatibilityDate}, config says ${config.compatibility_date}`,
);
ok(
  "the Node version matches .nvmrc",
  artifact.runtime?.nodeVersion ===
    readFileSync(join(root, ".nvmrc"), "utf8").trim(),
);

console.log(
  `  ${sourceBindings.length} binding(s), ${sourceGates.length} gate(s), ` +
    `${sourceMigrations.length} migration(s), ${sourceDeps.length} dependency(ies), ` +
    `${(artifact.notAdopted ?? []).length} refusal(s) reconciled\n`,
);

/*
 * EXECUTED-COUNT FLOOR. Reconciling a GENERATED artifact against its sources is the shape most
 * able to pass by checking nothing: an artifact that parsed to an empty roster iterates zero
 * times. MEASURED BY RUNNING IT, and it tracks the colophon's declared inventory.
 */
const MINIMUM_CHECKS = 22;
const floorBreach = assertFloor("check:stack", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
