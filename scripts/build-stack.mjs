/**
 * Emits the colophon's STACK half from the repo's own configuration.
 *
 *   npm run build:stack
 *
 * Ruling: colophon-page.md, 2026-08-05. The stack half of that page is
 * DERIVABLE, so it is derived: bindings from `wrangler.jsonc.example`, pinned
 * versions from `package.json`, migrations from `drizzle/`, gates from the
 * `check:*` scripts. The feature half is not derivable and is not in this file.
 *
 * **Why generated rather than written.** The ruling's evidence, not taste: a
 * hand-written reference page has a 100% chance of being wrong within a
 * quarter, because manual regeneration means nobody regenerates. This repo has
 * already published three quantitative claims that went wrong, and a page whose
 * entire subject is what the site is built from is the densest possible surface
 * for that failure.
 *
 * ## Everything is DERIVED. There is no list in this file.
 *
 * Not a single binding name, version, migration or gate name appears here as a
 * literal, and that is the whole design rather than a preference. A generator
 * carrying its own copy of the list is a mirror, and a mirror goes stale in the
 * direction that fails silently: it reports a smaller surface rather than an
 * error. `check-all.mjs` derives its gate list from package.json for exactly
 * this reason and is the model.
 *
 * The binding surface comes from `scripts/lib/wrangler-surface.mjs`, the same
 * enumerator `check:config` uses, so a binding kind neither of them knows about
 * is invisible to both rather than to one.
 *
 * **The EXAMPLE config, not the real one.** `wrangler.jsonc` is gitignored, so
 * a fresh clone cannot read it, and a generated artifact that only regenerates
 * on one machine is worse than no artifact. `check:config` is what keeps the
 * example describing the same binding surface as the real file, so deriving
 * from the example is not a weaker claim.
 *
 * ## What is NOT derived, and why that is honest
 *
 * The prose for each layer, `whyLoadBearing`, is hand-written and lives in
 * `content/stack-notes.json` beside this script. It is a MEASUREMENT, not a
 * fact about the config: "Durable Objects, because the ratelimit binding
 * refused 1, then 2, then 9, then 0 of twelve against a limit of five" is in no
 * config file and never will be. `check:stack` reconciles the two in both
 * directions, so a binding with no note and a note with no binding are both
 * failures, which is what stops the hand-written half rotting quietly.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseJsonc, surfaceOf } from "./lib/wrangler-surface.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const EXAMPLE_CONFIG = join(root, "wrangler.jsonc.example");
export const NOTES_PATH = join(root, "content", "stack-notes.json");
export const STACK_PATH = join(root, "content", "generated", "stack.json");

/**
 * The runtime dependencies worth naming, derived from `dependencies` rather
 * than listed.
 *
 * `devDependencies` is deliberately excluded: a colophon describes what SERVES
 * the site, and a reader does not care that esbuild is present. The split is
 * package.json's own, so nothing here decides it.
 *
 * @param {any} pkg
 */
export function runtimeVersions(pkg) {
  return Object.entries(pkg.dependencies ?? {})
    .map(([name, range]) => ({ name, range: String(range) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Migrations, in applied order, from the directory D1 is pointed at.
 *
 * The directory is read out of the config's `migrations_dir` rather than
 * assumed, so a repo that moved them does not silently report zero.
 *
 * @param {string} migrationsDir
 */
export function migrationFiles(migrationsDir) {
  return readdirSync(join(root, migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * The `check:` scripts that RUN gates rather than being one.
 *
 * A named set rather than a comparison, because there are two of them now and
 * the second one caught this file out. The comment here already said "the
 * runners" in the plural while the filter compared against exactly one name, so
 * adding `check:ci` on 2026-08-20 would have put a runner in the colophon's
 * gate list and made the site claim 28 gates where 27 exist.
 */
export const RUNNERS = new Set(["check:all", "check:ci"]);

/**
 * Every gate, derived from package.json's `check:*` scripts.
 *
 * ONE DEFINITION, imported by `check-all.mjs` rather than restated there.
 * Until 2026-08-20 both files implemented this filter separately, which is the
 * mirror class this repo keeps being bitten by: two derivations of one rule,
 * agreeing until the day one of them gains a case. That day was `check:ci`.
 *
 * A hardcoded list is how the next gate gets forgotten, which is why it is
 * derived at all.
 *
 * @param {any} pkg
 */
export function gateNames(pkg) {
  return Object.keys(pkg.scripts ?? {})
    .filter((name) => name.startsWith("check:") && !RUNNERS.has(name))
    .sort();
}

/**
 * Stable JSON, so the artifact only changes when its inputs do.
 * @param {unknown} value
 */
function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildStack() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const config = parseJsonc(EXAMPLE_CONFIG);
  const notes = JSON.parse(readFileSync(NOTES_PATH, "utf8"));

  const surface = surfaceOf(config);
  const bindings = [...surface.entries()]
    .map(([id, settings]) => {
      const [kind, name] = id.split(":");
      return {
        id,
        kind,
        name,
        settings,
        /** Hand-written, reconciled by check:stack in both directions. */
        what: notes.bindings?.[id]?.what ?? null,
        whyLoadBearing: notes.bindings?.[id]?.whyLoadBearing ?? null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const d1 = config.d1_databases?.[0];

  return {
    /**
     * Bumped when the SHAPE of this file changes, so a consumer written
     * against an older shape fails loudly rather than reading undefined.
     */
    version: 1,
    runtime: {
      compatibilityDate: config.compatibility_date,
      compatibilityFlags: config.compatibility_flags ?? [],
      nodeVersion: readFileSync(join(root, ".nvmrc"), "utf8").trim(),
    },
    bindings,
    dependencies: runtimeVersions(pkg),
    migrations: migrationFiles(d1?.migrations_dir ?? "drizzle"),
    gates: gateNames(pkg),
    /** Ruled entries: what was deliberately NOT adopted, and why. */
    notAdopted: notes.notAdopted ?? [],
  };
}

// `pathToFileURL` rather than string surgery on process.argv[1]: on Windows the
// hand-built `file://C:\...` form never equals import.meta.url, so the generator
// silently did nothing when run directly.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const stack = buildStack();
  writeFileSync(STACK_PATH, serialize(stack), "utf8");
  console.log(
    `build:stack wrote content/generated/stack.json ` +
      `(${stack.bindings.length} binding(s), ${stack.dependencies.length} dependency(ies), ` +
      `${stack.migrations.length} migration(s), ${stack.gates.length} gate(s))`,
  );
}
