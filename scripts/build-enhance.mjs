/**
 * Bundles every module in app/enhance/ into a self-contained asset.
 *
 *   npm run build:enhance
 *
 * BOUNDARY: it builds and then reads back its OWN output, proving each bundle is import-free and
 * parses. It cannot prove the app build serves these files, which `check:page-payload` asserts,
 * and it cannot see the wire.
 *
 * WHY PREBUILT: the public plane does not hydrate, so what loads an enhancement is a nonced module
 * script whose URL is a `?url` import. That copies bytes VERBATIM with no compilation, so the
 * thing it points at has to be finished JavaScript before the app build runs.
 *
 * EACH BUNDLE IS SELF-CONTAINED, ASSERTED RATHER THAN HOPED: a surviving import would make the
 * browser fetch a sibling by relative URL against a directory where only hashed names exist, so
 * the enhancement dies at runtime while the build stays green. Dynamic imports are inlined
 * instead, which costs one bundle the other's bytes and buys it working under this rule.
 *
 * The output directory is gitignored and is DELETED and rebuilt on every run, so a renamed module
 * cannot leave a stale bundle behind for a `?url` import to keep serving.
 */

import { readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { build, parseAst } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENHANCE_DIR = join(root, "app", "enhance");
const DIST_DIR = join(ENHANCE_DIR, "dist");

/**
 * True when the AST contains any statement that would reach the network for another module. A
 * plain `export {}` has no source and is fine in a module script.
 *
 * @param {any} node
 * @returns {string | null} a description of the offending node, or null
 */
function findModuleDependency(node) {
  if (node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findModuleDependency(child);
      if (hit) return hit;
    }
    return null;
  }
  if (node.type === "ImportDeclaration") return `static import of ${node.source?.value}`;
  if (node.type === "ImportExpression") return "dynamic import()";
  if (
    (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") &&
    node.source
  ) {
    return `re-export from ${node.source.value}`;
  }
  for (const key of Object.keys(node)) {
    if (key === "type") continue;
    const hit = findModuleDependency(node[key]);
    if (hit) return hit;
  }
  return null;
}

async function main() {
  const modules = readdirSync(ENHANCE_DIR).filter((name) => name.endsWith(".ts"));
  if (modules.length === 0) {
    throw new Error(`${ENHANCE_DIR} holds no .ts modules; nothing to bundle.`);
  }

  rmSync(DIST_DIR, { recursive: true, force: true });

  for (const name of modules) {
    const outName = name.replace(/\.ts$/, ".js");
    await build({
      configFile: false,
      root,
      logLevel: "warn",
      resolve: { tsconfigPaths: true },
      build: {
        outDir: DIST_DIR,
        emptyOutDir: false,
        // public/ has no business inside a per-module bundle directory.
        copyPublicDir: false,
        minify: "esbuild",
        sourcemap: false,
        rollupOptions: {
          input: join(ENHANCE_DIR, name),
          output: {
            format: "es",
            entryFileNames: outName,
            // One chunk per entry, dynamic imports inlined, which is what makes a lazy import legal under the
            // no-imports rule below.
            codeSplitting: false,
          },
        },
      },
    });

    const outPath = join(DIST_DIR, outName);
    const source = readFileSync(outPath, "utf8");
    if (source.trim().length === 0) {
      throw new Error(`${outName} built empty; the bundle would enhance nothing.`);
    }
    const dependency = findModuleDependency(parseAst(source));
    if (dependency) {
      throw new Error(
        `${outName} is not self-contained: it carries a ${dependency}. A bundle ` +
          `served by ?url resolves imports against /assets/, where only hashed ` +
          `names exist, so this would fail at runtime while the build stayed green.`,
      );
    }
    console.log(`  ${outName}  ${statSync(outPath).size} bytes`);
  }

  // Both directions: a file in the output directory that no module produced is a stale bundle a
  // `?url` import could still be serving.
  const built = readdirSync(DIST_DIR).sort();
  const expected = modules.map((n) => n.replace(/\.ts$/, ".js")).sort();
  if (built.join(",") !== expected.join(",")) {
    throw new Error(
      `dist/ holds [${built.join(", ")}] but the modules imply [${expected.join(", ")}].`,
    );
  }

  console.log(`build:enhance ok. ${modules.length} module(s) bundled into app/enhance/dist/.`);
}

try {
  await main();
} catch (error) {
  console.error(
    `build:enhance failed. ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
