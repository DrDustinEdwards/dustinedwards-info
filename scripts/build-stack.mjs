import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseJsonc, surfaceOf } from "./lib/wrangler-surface.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const EXAMPLE_CONFIG = join(root, "wrangler.jsonc.example");
export const NOTES_PATH = join(root, "content", "stack-notes.json");
export const STACK_PATH = join(root, "content", "generated", "stack.json");

/** @param {any} pkg */
export function runtimeVersions(pkg) {
  return Object.entries(pkg.dependencies ?? {})
    .map(([name, range]) => ({ name, range: String(range) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** @param {string} migrationsDir */
export function migrationFiles(migrationsDir) {
  return readdirSync(join(root, migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export const RUNNERS = new Set(["check:all", "check:ci", "check:changed"]);

/**
 * One definition, imported by `check-all.mjs`: a hardcoded list is how the next gate gets forgotten.
 *
 * @param {any} pkg
 */
export function gateNames(pkg) {
  return Object.keys(pkg.scripts ?? {})
    .filter((name) => name.startsWith("check:") && !RUNNERS.has(name))
    .sort();
}

/** @param {unknown} value */
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
        what: notes.bindings?.[id]?.what ?? null,
        whyLoadBearing: notes.bindings?.[id]?.whyLoadBearing ?? null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const d1 = config.d1_databases?.[0];

  return {
    /** Bumped when the shape changes, so a consumer of an older shape fails loudly. */
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
    notAdopted: notes.notAdopted ?? [],
  };
}

// `pathToFileURL`: on Windows a hand-built form never equals `import.meta.url`.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const stack = buildStack();
  writeFileSync(STACK_PATH, serialize(stack), "utf8");
  console.log(
    `build:stack wrote content/generated/stack.json ` +
      `(${stack.bindings.length} binding(s), ${stack.dependencies.length} dependency(ies), ` +
      `${stack.migrations.length} migration(s), ${stack.gates.length} gate(s))`,
  );
}
