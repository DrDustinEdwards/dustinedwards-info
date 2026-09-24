/* Every test asserts its fixture is non-empty, because a comparison over nothing reports what a
 * clean tree reports. */

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
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
  const { build } = await import("esbuild");
  mkdirSync(cacheRoot, { recursive: true });

  /** @type {import("esbuild").Plugin} */
  const stubPlugin = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: stubs }, (args) => {
        // The entry itself must never be stubbed, or the test would compare
        // two empty objects and pass having examined nothing.
        if (args.kind === "entry-point") return null;
        return { path: args.path, namespace: "stub" };
      });
      // CommonJS, so one Proxy stub satisfies any named import at runtime.
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents:
          "module.exports = new Proxy({}, { get: () => () => {}, has: () => true });",
        loader: "js",
      }));
    },
  };

  const out = join(cacheRoot, outfile);
  await build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    logLevel: "silent",
    plugins: [stubPlugin],
    alias: { "~": join(root, "app") },
  });
  return import(pathToFileURL(out).href);
}
