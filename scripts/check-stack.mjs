/**
 * Gate over the colophon's generated stack data.
 *
 *   npm run check:stack
 *
 * OBSERVATION BOUNDARY: it reconciles `content/generated/stack.json` against the
 * sources it was derived from. It cannot tell whether a hand-written
 * `whyLoadBearing` is TRUE, only that the binding it describes still exists.
 * Verifying the prose is the evidence-anchor design in colophon-page.md and is
 * a separate change.
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

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  NOTES_PATH,
  STACK_PATH,
  EXAMPLE_CONFIG,
  buildStack,
  gateNames,
  migrationFiles,
  runtimeVersions,
} from "./build-stack.mjs";
import {
  parseJsonc,
  surfaceOf,
  unhandledBindingKinds,
} from "./lib/wrangler-surface.mjs";

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
  console.log("        Generate it with: npm run build:stack\n");
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

// The strongest single assertion here: regenerate from the live sources and
// compare. It subsumes every field, including ones added later that nobody
// remembered to write a comparison for.
const fresh = buildStack();
ok(
  "stack.json matches a fresh generation",
  JSON.stringify(fresh) === JSON.stringify(artifact),
  "the committed artifact differs from what build:stack produces now. Run build:stack.",
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
  "the deliberately-not-adopted list is not empty",
  (artifact.notAdopted ?? []).length > 0,
  "the ruling requires the refusals, which are what make the list credible",
);
const unreasoned = (artifact.notAdopted ?? []).filter(
  (/** @type {any} */ n) => !n.name || !n.reason,
);
ok(
  "every not-adopted entry carries a reason",
  unreasoned.length === 0,
  unreasoned.map((/** @type {any} */ n) => n.name ?? "(unnamed)").join(", "),
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

console.log(`${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
