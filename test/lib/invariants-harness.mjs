/* Every test asserts its fixture is non-empty, because a comparison over nothing reports what a
 * clean tree reports. */

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * One section's assertions, collected rather than thrown, so a failing test names every broken
 * property at once instead of the first.
 */
export function collector() {
  /** @type {string[]} */
  const failures = [];
  let checks = 0;
  return {
    /** @param {string} label @param {boolean} condition @param {string} [detail] */
    ok(label, condition, detail = "") {
      checks += 1;
      if (!condition) failures.push(`${label}${detail ? `: ${detail}` : ""}`);
    },
    /** @param {string} label @param {string} [detail] */
    fail(label, detail = "") {
      checks += 1;
      failures.push(`${label}${detail ? `: ${detail}` : ""}`);
    },
    done() {
      assert.ok(checks > 0, "no assertion ran, so a pass would mean nothing");
      assert.deepEqual(failures, [], `${failures.length} of ${checks} assertion(s) failed`);
    },
  };
}

/**
 * A bundler writing under its own cache directory: node --test runs files in parallel processes,
 * and two files bundling to one path would import each other's half-written output.
 *
 * @param {string} cacheName one per test file
 */
export function bundler(cacheName) {
  return (
    /** @type {string} */ entry,
    /** @type {string} */ outfile,
    /** @type {RegExp} */ stubs,
  ) => bundle(join(root, "node_modules", ".cache", "invariants", cacheName), entry, outfile, stubs);
}

/**
 * @param {string} cacheRoot
 * @param {string} entry
 * @param {string} outfile
 * @param {RegExp} stubs
 * @returns {Promise<any>}
 */
async function bundle(cacheRoot, entry, outfile, stubs) {
  const { build } = await import("vite");
  mkdirSync(cacheRoot, { recursive: true });

  const STUB = "\0stub:";
  const built = await build({
    configFile: false,
    root,
    logLevel: "silent",
    mode: "production",
    plugins: [
      {
        name: "stub",
        enforce: "pre",
        // Matched against the specifier as written, before `~/` is resolved, which is what the
        // callers' patterns are spelled against.
        async resolveId(source, importer) {
          // The entry itself must never be stubbed, or the test would compare
          // two empty objects and pass having examined nothing.
          if (!importer) return null;
          if (stubs.test(source)) return `${STUB}${source}`;
          if (source.startsWith("~/")) {
            return this.resolve(join(root, "app", source.slice(2)), importer, { skipSelf: true });
          }
          return null;
        },
        // CommonJS, so one Proxy stub satisfies any named import at runtime. Calling one throws,
        // naming the import, because a stub quietly returning undefined lets the code under test
        // carry on.
        load(id) {
          if (!id.startsWith(STUB)) return null;
          return (
            `const from = ${JSON.stringify(id.slice(STUB.length))};\n` +
            "module.exports = new Proxy({}, {\n" +
            "  get: (_target, name) => () => {\n" +
            "    throw new Error(`stubbed import ${String(name)} from ${from} was called; the invariant test stubbed it as unreachable`);\n" +
            "  },\n" +
            "  has: () => true,\n" +
            "});"
          );
        },
      },
    ],
    build: {
      write: false,
      ssr: true,
      minify: false,
      rollupOptions: { input: entry, output: { format: "esm", codeSplitting: false } },
    },
  });
  const chunk = /** @type {any} */ (Array.isArray(built) ? built[0] : built).output.find(
    (/** @type {{ type: string }} */ o) => o.type === "chunk",
  );
  // Packages stay external in an SSR build, so a module the test imports itself (drizzle's
  // dialect) is the same instance the bundle uses.
  const out = join(cacheRoot, outfile);
  writeFileSync(out, chunk.code);
  return import(pathToFileURL(out).href);
}
