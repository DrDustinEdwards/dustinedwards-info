/**
 * Bundles every module in app/enhance/ into a self-contained asset.
 *
 *   npm run build:enhance
 *
 * OBSERVATION BOUNDARY: this builds and then reads back its OWN output. It
 * proves each bundle is import-free and parses; it cannot prove the app build
 * actually serves these files (the ?url imports decide that, and
 * check:page-payload asserts it against build/client), and it cannot see the
 * wire.
 *
 * ## Why the enhancements are prebuilt
 *
 * The public plane stopped hydrating React (2026-08-26), so the effect loaders
 * that dynamically imported these modules stopped existing. What loads an
 * enhancement now is a plain nonced `<script type="module">` whose URL is a
 * `?url` import of the file this script writes. A `?url` import copies bytes
 * VERBATIM as an asset, with no compilation (measured 2026-07-28: pointing it
 * at the .ts source serves raw TypeScript), so the thing it points at has to
 * be finished JavaScript before the app build runs. That is this script's
 * whole job, and it is why it runs before the app build everywhere the
 * build-first pattern lives: check-all, check-head, ship, ci.yml, deploy.yml
 * and the dev script.
 *
 * ## Each bundle is SELF-CONTAINED, asserted rather than hoped
 *
 * A bundle with an import statement would make the browser fetch a sibling by
 * relative URL against /assets/, where only hashed names exist, so the
 * enhancement would die at runtime while the build stayed green. Every output
 * is therefore parsed (Rollup's own parser, via vite's parseAst) and refused
 * if any static import, dynamic import() or re-export-from survives.
 * `inlineDynamicImports` is what makes the palette's lazy `import("./ask")`
 * legal: the ask module is inlined into the palette bundle, which costs the
 * palette ask's bytes and buys it working under this rule. Both bundles carry
 * ask's DOM-guarded init, which is why that init is idempotent.
 *
 * The output directory is gitignored (see .gitignore for the reason) and is
 * DELETED and rebuilt on every run, so a renamed module cannot leave a stale
 * bundle behind for a ?url import to keep serving.
 */

import { readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { build, parseAst } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENHANCE_DIR = join(root, "app", "enhance");
const DIST_DIR = join(ENHANCE_DIR, "dist");

/**
 * True when the AST contains any statement that would reach the network for
 * another module: static import, dynamic import(), or a re-export with a
 * source. A plain `export {}` has no source and is fine in a module script.
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
            // One chunk per entry, dynamic imports inlined. This is what makes
            // the palette's lazy import("./ask") legal under the no-imports
            // rule below. (Rolldown's spelling; inlineDynamicImports is the
            // deprecated alias.)
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

  // Both directions: a file in dist/ that no module produced is a stale
  // bundle a ?url import could still be serving.
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
