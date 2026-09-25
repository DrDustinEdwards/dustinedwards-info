/**
 * Reachability is not rendering: a bundle imported inside a branch the route never takes still
 * counts, which over-approximates in the safe direction for a byte ceiling.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";

/**
 * @param {string} source @param {string} file @param {string} appDir
 */
export function importsOf(source, file, appDir) {
  /** @type {string[]} */
  const modules = [];
  /** @type {string[]} */
  const assets = [];
  // An enhancement bundle is served where `<Enhance module="x"` renders it. Its `?url` import alone
  // is not a fetch: the registry imports all eight, and the palette's URL rides a data attribute.
  // Comments stripped first, or a comment naming <Enhance> would charge every importer for it.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  for (const m of code.matchAll(/<Enhance\s+module="([a-z-]+)"/g)) {
    assets.push(`~/enhance/dist/${m[1]}.js`);
  }

  for (const m of source.matchAll(/(?:from\s*|import\s*\(?\s*)["']([^"']+)["']/g)) {
    const spec = m[1];
    if (spec.includes("?url")) {
      const asset = spec.replace(/\?url$/, "");
      if (!asset.includes("enhance/dist/")) assets.push(asset);
      continue;
    }
    if (spec.endsWith(".css")) continue;
    if (spec.startsWith("~/")) modules.push(join(appDir, spec.slice(2)));
    else if (spec.startsWith(".")) modules.push(join(dirname(file), spec));
  }
  return { modules, assets };
}

/**
 * A specifier that resolves to nothing is skipped rather than thrown on: the walk deliberately
 * does not know about node_modules or the vite alias table. The ENTRY is different: an entry that
 * resolves to nothing is a misnamed route file, and an empty walk would grade it as carrying no
 * bundles at all, so it throws.
 *
 * @param {string} entry
 * @param {string} appDir
 * @param {(path: string) => string | null} read
 */
export function reachableAssets(entry, appDir, read) {
  const seen = new Set();
  /** @type {Set<string>} */
  const assets = new Set();
  if (!resolveModule(entry, read)) throw new Error(`reachableAssets: the entry ${entry} resolves to no file`);
  const queue = [entry];

  while (queue.length > 0) {
    const file = /** @type {string} */ (queue.pop());
    const resolved = resolveModule(file, read);
    if (!resolved || seen.has(resolved.path)) continue;
    seen.add(resolved.path);

    const { modules, assets: found } = importsOf(resolved.source, resolved.path, appDir);
    for (const asset of found) assets.add(asset);
    for (const next of modules) queue.push(next);
  }

  return { assets, visited: seen };
}

/**
 * @param {string} path @param {(path: string) => string | null} read
 */
function resolveModule(path, read) {
  for (const candidate of [
    path,
    `${path}.ts`,
    `${path}.tsx`,
    `${path}.mjs`,
    join(path, "index.ts"),
    join(path, "index.tsx"),
  ]) {
    const source = read(candidate);
    if (source !== null) return { path: candidate, source };
  }
  return null;
}

/**
 * Root's sheets first: root is the parent match, and the cascade depends on that order. A route id
 * the manifest does not list throws: a misspelled id would otherwise be graded on root's sheets
 * alone, which is always under the ceiling.
 *
 * @param {any} manifest
 * @param {string} routeId
 */
export function stylesheetsFor(manifest, routeId) {
  const routes = manifest?.routes;
  if (!routes || !Object.hasOwn(routes, "root")) throw new Error("stylesheetsFor: the manifest lists no root route");
  if (!Object.hasOwn(routes, routeId)) throw new Error(`stylesheetsFor: the manifest lists no route ${routeId}`);
  const rootCss = routes.root.css ?? [];
  const routeCss = routes[routeId].css ?? [];
  return [...new Set([...rootCss, ...routeCss])];
}

/**
 * Only `@font-face` urls: a `url()` elsewhere is fetched only if something matches, while a face
 * is fetched whenever the family is used, which here is every page.
 *
 * @param {string[]} cssText
 */
export function fontsIn(cssText) {
  /** @type {Set<string>} */
  const fonts = new Set();
  for (const text of cssText) {
    for (const block of text.matchAll(/@font-face\s*\{[^}]*\}/g)) {
      for (const url of block[0].matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
        fonts.add(url[1]);
      }
    }
  }
  return [...fonts];
}

/* The build on disk, read by check:page-payload and by nothing that builds. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ASSETS_DIR = join(root, "build", "client", "assets");
const DIST_DIR = join(root, "app", "enhance", "dist");

/**
 * Stems, because verify-live may face a deploy whose hashes predate this disk. Anchored on the
 * extension: a Vite hash may contain a dash.
 *
 * @param {string} name
 */
export function chunkStem(name) {
  return name.replace(/-[A-Za-z0-9_-]{8}\.js$/, "");
}

/** @param {Buffer} bytes */
export function brotliSize(bytes) {
  return brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
}

export function readClientManifest() {
  /** @type {string[]} */
  let entries;
  try {
    entries = readdirSync(ASSETS_DIR);
  } catch {
    throw new Error(
      `${ASSETS_DIR} is missing or unreadable. This gate measures the build on ` +
        `disk; run npm run build first.`,
    );
  }
  const names = entries.filter((f) => /^manifest-[A-Za-z0-9_-]+\.js$/.test(f));
  if (names.length !== 1) {
    throw new Error(
      `expected exactly one manifest-<hash>.js under build/client/assets, ` +
        `found ${names.length}${names.length ? `: ${names.join(", ")}` : ""}. ` +
        `A stale or partial build; run npm run build.`,
    );
  }
  const source = readFileSync(join(ASSETS_DIR, names[0]), "utf8");
  const manifest = JSON.parse(
    source.slice(source.indexOf("=") + 1, source.lastIndexOf(";")),
  );
  return { manifest, manifestFile: names[0] };
}

/**
 * Minified output writes `from"./x.js"` and bare `import"./x.js"`. A dynamic `import("./x.js")` is
 * not followed: it loads later, not at hydration.
 *
 * @param {string} source
 * @returns {string[]}
 */
function chunkImports(source) {
  /** @type {string[]} */
  const staticTargets = [];
  for (const match of source.matchAll(/from\s*["'`]\.\/([^"'`]+)["'`]/g)) {
    staticTargets.push(match[1]);
  }
  // Bare static import: `import"./x.js"`. The lookbehind refuses `import(`,
  // property access (`.import`) and identifiers ending in "import".
  for (const match of source.matchAll(/(?<![.(\w])import\s*["'`]\.\/([^"'`]+)["'`]/g)) {
    staticTargets.push(match[1]);
  }
  return staticTargets;
}

/** @returns {{ files: string[], manifestFile: string }} */
export function walkHydrationSet() {
  const { manifest, manifestFile } = readClientManifest();

  /** @type {Set<string>} */
  const seed = new Set();
  /** @param {string} url */
  const add = (url) => seed.add(url.replace("/assets/", ""));

  if (!manifest.entry?.module) {
    throw new Error("the manifest carries no entry module; the walk has no seed.");
  }
  add(manifest.entry.module);
  for (const url of manifest.entry.imports ?? []) add(url);

  for (const id of ["root", "routes/blog.$slug"]) {
    const route = manifest.routes?.[id];
    if (!route?.module) {
      throw new Error(
        `route "${id}" is missing from the manifest. The build lost a route.`,
      );
    }
    add(route.module);
    for (const url of route.imports ?? []) add(url);
  }

  // Re-close transitively over each chunk's own static imports, so a chunk
  // the manifest's flattened arrays under-list is still counted.
  const queue = [...seed];
  while (queue.length > 0) {
    const name = /** @type {string} */ (queue.pop());
    const source = readFileSync(join(ASSETS_DIR, name), "utf8");
    for (const target of chunkImports(source)) {
      if (!seed.has(target)) {
        seed.add(target);
        queue.push(target);
      }
    }
  }

  return { files: [...seed].sort(), manifestFile };
}

/**
 * The stems of these asset names are the only script references a public page may carry.
 *
 * @returns {Array<{ module: string, assetName: string | null, matches: number, raw: number, brotli: number }>}
 */
export function enhancementAssets() {
  /** @type {string[]} */
  let distFiles;
  try {
    distFiles = readdirSync(DIST_DIR).filter((f) => f.endsWith(".js"));
  } catch {
    throw new Error(
      `${DIST_DIR} is missing. The bundles are built by npm run build:enhance, ` +
        `which every runner executes before this gate; run it first.`,
    );
  }
  if (distFiles.length === 0) {
    throw new Error(`${DIST_DIR} holds no bundles; run npm run build:enhance.`);
  }

  const assetNames = readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".js"));
  return distFiles.sort().map((module) => {
    const distBytes = readFileSync(join(DIST_DIR, module));
    const matches = assetNames.filter((name) =>
      distBytes.equals(readFileSync(join(ASSETS_DIR, name))),
    );
    return {
      module,
      assetName: matches.length === 1 ? matches[0] : null,
      matches: matches.length,
      raw: distBytes.length,
      brotli: brotliSize(distBytes),
    };
  });
}
