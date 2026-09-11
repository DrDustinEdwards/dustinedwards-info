/**
 * Gate over the colophon's generated stack data.
 *
 *   npm run check:stack
 *
 * THE SUBJECT IS A BUILD PRODUCT, NOT A COMMIT (ruling 39a, 2026-09-08).
 * `content/generated/stack.json` is gitignored and written by `build:stack`,
 * which runs before the gates in `check-all.mjs`, in ship's build step and in
 * CI. This gate therefore asserts that a build HAPPENED and that what it
 * produced reconciles with its sources; it no longer asserts that a committed
 * copy equals a fresh derivation, because that compared a commit to a build
 * and made every dependency bump a two-file change no bot could complete.
 *
 * OBSERVATION BOUNDARY, and there are TWO limits, not one.
 *
 * **First, it cannot tell whether the prose is TRUE.** A hand-written
 * `whyLoadBearing` is reconciled against the binding it describes, so the gate
 * knows the binding still exists and nothing more. Verifying the claim itself
 * is the evidence-anchor design in colophon-page.md and is a separate change.
 *
 * **Second, and easier to miss: this gate reads `wrangler.jsonc.example`, which
 * is not what is deployed.** The example is the tracked file, so it is the only
 * one a clone can read, and everything here is derived from it. The single
 * thing binding it to the Worker that actually runs is `check:config`, which
 * compares the example against the real `wrangler.jsonc`. That file is
 * gitignored, so `check:config` can only run where it exists, which is one
 * machine, **and CI CANNOT CLOSE THIS GAP.** That is measured, not assumed: a
 * checkout has no real config and `postinstall` bootstraps one by copying the
 * example, so real equals example by construction and the gate cannot pass.
 * It is in `CI_EXCLUDED`. A green `check:stack` therefore says the artifact
 * matches the example. It says the artifact matches PRODUCTION
 * only as far as someone remembered to run `check:config` on the machine that
 * holds the real config.
 *
 * That gap is real and it is recorded HERE, in the gate it is about, rather
 * than on the page. It used to be described as "the same accepted gap this
 * page lists under `notAdopted`", which stopped being true on 2026-09-11 when
 * the one entry under that status was deleted for being false about CI. A
 * cross-reference to a list is a claim that ages; a gate's own boundary note
 * is the place a boundary belongs.
 *
 * Pure: no network, no database, no bindings.
 *
 * ## Both directions, on every source
 *
 * A generated artifact only stays honest if the gate fails when EITHER side
 * moves. A binding in the config with no row is the obvious direction; a row
 * with no binding is the one that actually happens, because a resource gets
 * removed and the page keeps advertising it. The same holds for gates,
 * migrations and dependencies.
 *
 * The hand-written notes get the same treatment: a binding with no note fails,
 * and a note naming a binding that no longer exists fails. Without the second
 * direction the notes file becomes the place stale claims accumulate, which is
 * the exact rot the ruling was written against.
 *
 * ## It re-derives rather than trusting the artifact
 *
 * Every expectation is computed by calling `build-stack.mjs`'s own exported
 * derivations against the live sources. Nothing here restates a binding name, a
 * version, a migration or a gate, so a list that drifts moves one side of a
 * comparison and fails. `check:all` derives its gate list the same way and for
 * the same reason.
 *
 * FAILS CLOSED. An empty enumeration on any source is a failure, not a pass:
 * "0 differences" must never be reachable by examining nothing.
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

/* ------------------------------------------------------- fail closed first */

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
 * The blind spot, made loud. A binding KIND no reader understands produces no
 * rows on either side of every comparison below, so the artifact and the config
 * agree by both being empty. Found by planting `vectorize` in the example config
 * and watching this gate pass with 0 failures.
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

/* ------------------------------------------------------- shape and freshness */

ok(
  "the artifact declares the shape this gate understands",
  artifact.version === 1,
  `stack.json is version ${artifact.version}; this gate reads version 1`,
);

/*
 * FRESHNESS, WHICH REPLACED A COMPARISON THAT WAS ASKING THE WRONG QUESTION.
 *
 * Until ruling 39a this line read `JSON.stringify(buildStack()) ===
 * JSON.stringify(artifact)` and was described as the strongest assertion in the
 * file. It was comparing A COMMIT TO A BUILD, and that is the defect rather
 * than a strength: the only way to satisfy it was for a human to run
 * `build:stack` and commit the result in the same change as the package.json
 * edit that moved it. Renovate cannot run a build, so all three of its first
 * pin PRs (#19 to #21, 2026-09-07) arrived red here with nothing wrong in them.
 *
 * stack.json is now a gitignored build product, derived before the gates in
 * check-all, in ship's build step and in CI. So the question worth asking is no
 * longer "does the commit match a build" but "did a build actually happen",
 * and mtime against package.json is what answers it. package.json is the input
 * this gate exists to track: it carries the dependencies and the gate names,
 * and it is the file a dependency PR edits.
 *
 * The reconciles below still fail on a stale artifact, and they are not
 * redundant with this: they read the artifact's CONTENT, so they catch a
 * regeneration that ran and produced the wrong thing, where mtime only catches
 * one that did not run at all.
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

/* --------------------------------------------------------- both directions */

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

/* ------------------------------------ the hand-written half, both directions */

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
 * `refused` and `accepted-gap` are DIFFERENT CLAIMS and the page states which.
 *
 * The list was originally called the refusals throughout, and CI was in it. It
 * is not a refusal: neither decisions.md nor decisions-vol-1.md carries a
 * ruling declining CI, and the record files it as a gap that has already cost
 * something. Calling it a refusal would have published a decision nobody made,
 * on the one page whose whole subject is what was decided.
 *
 * The status is closed rather than free text, because values a reader can rely
 * on are worth more than an open vocabulary that drifts into synonyms.
 *
 * ONE VALUE SINCE 2026-09-11, and this list is the SECOND owner of that
 * vocabulary rather than the first: `STATUS_LABEL` in
 * `app/lib/colophon-sections.mjs` is what the page renders through, and
 * `check:features` asserts in both directions that the labels and the statuses
 * in use are the same set. `accepted-gap` left both in the same commit with its
 * last member, the false "Continuous integration" entry. Adding the next
 * accepted gap means editing both, which is the point.
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

/* ------------------------------------------------------- runtime facts */

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
 * EXECUTED-COUNT FLOOR.
 *
 * This gate reconciles a GENERATED artifact against its sources, which is the
 * shape most able to pass by checking nothing: if the artifact parsed to an
 * empty roster, every loop below would iterate zero times and report green.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 24.
 * Never summed. Floored at 22, slack of two: the count tracks the colophon's
 * declared bindings, gates, migrations and dependencies, so it grows with the
 * stack rather than wandering.
 */
const MINIMUM_CHECKS = 22;
const floorBreach = assertFloor("check:stack", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
