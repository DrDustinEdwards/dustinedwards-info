/**
 * Emits the colophon's STACK half from the repo's own configuration.
 *
 *   npm run build:stack
 *
 * BOUNDARY: everything is DERIVED and there is no list in this file, so a binding kind the shared
 * enumerator does not know is invisible here too. It reads the EXAMPLE config, which is what a
 * fresh clone has, and the hand-written prose beside each layer is reconciled by `check:stack`
 * rather than produced here.
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
 * The runtime dependencies worth naming, derived from `dependencies` rather than listed:
 * a colophon describes what SERVES the site, and the split is package.json's own.
 *
 * @param {any} pkg
 */
export function runtimeVersions(pkg) {
  return Object.entries(pkg.dependencies ?? {})
    .map(([name, range]) => ({ name, range: String(range) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Migrations, in applied order, from the directory D1 is pointed at, read out of the config's
 * `migrations_dir` rather than assumed, so a repo that moved them does not report zero.
 *
 * @param {string} migrationsDir
 */
export function migrationFiles(migrationsDir) {
  return readdirSync(join(root, migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * The `check:` scripts that RUN gates rather than being one. A named set rather than a
 * comparison, because the comment here already said "the runners" in the plural while the filter
 * compared against exactly one name, so the second one would have been counted as a gate.
 */
export const RUNNERS = new Set(["check:all", "check:ci", "check:changed"]);

/**
 * Every gate, derived from package.json's `check:*` scripts. ONE DEFINITION, imported by
 * `check-all.mjs` rather than restated there: two derivations of one rule agree until the day one
 * gains a case. A hardcoded list is how the next gate gets forgotten.
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
     * Bumped when the SHAPE of this file changes, so a consumer written against an older shape fails
     * loudly rather than reading undefined.
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

// `pathToFileURL` rather than string surgery: on Windows the hand-built form never equals
// `import.meta.url`, so the generator silently did nothing when run directly.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const stack = buildStack();
  writeFileSync(STACK_PATH, serialize(stack), "utf8");
  console.log(
    `build:stack wrote content/generated/stack.json ` +
      `(${stack.bindings.length} binding(s), ${stack.dependencies.length} dependency(ies), ` +
      `${stack.migrations.length} migration(s), ${stack.gates.length} gate(s))`,
  );
}
