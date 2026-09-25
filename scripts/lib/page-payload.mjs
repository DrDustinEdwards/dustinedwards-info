/**
 * Reachability is not rendering: a bundle imported inside a branch the route never takes still
 * counts, which over-approximates in the safe direction for a byte ceiling.
 */

import { dirname, join, posix } from "node:path";

import { stripComments } from "./strip-comments.mjs";

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

/**
 * A module key: the repo-relative path with any script extension dropped, so `~/lib/x`,
 * `./x.mjs` and `../lib/x` from the right directories are one key. Anything that is neither `~/`
 * nor relative (a package, a virtual module) has no key.
 *
 * @param {string} spec @param {string} from repo-relative path of the importing file
 */
export function moduleKey(spec, from) {
  let path;
  if (spec.startsWith("~/")) path = posix.join("app", spec.slice(2));
  else if (spec.startsWith(".")) path = posix.join(posix.dirname(from.split("\\").join("/")), spec);
  else return null;
  return path.replace(/\.(?:ts|tsx|mjs|js)$/, "").replace(/\/index$/, "");
}

/**
 * A dynamic import splits nothing when some module in the same graph imports it statically.
 * Files are `{ path, source }` with repo-relative paths.
 *
 * @param {Array<{path: string, source: string}>} files
 */
export function findIneffectiveDynamicImports(files) {
  /** @type {Map<string, string[]>} module -> files importing it statically */
  const statics = new Map();
  /** @type {Array<{module: string, path: string}>} */
  const dynamics = [];

  for (const { path, source } of files) {
    const code = stripComments(source);
    for (const m of code.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
      const key = moduleKey(m[1], path);
      if (!key) continue;
      if (!statics.has(key)) statics.set(key, []);
      /** @type {string[]} */ (statics.get(key)).push(path);
    }
    // A type position (`: import(`, `<import(`, `typeof import(`, `type X = import(`) is erased by
    // TypeScript and never reaches the bundler, so it is not a dynamic import.
    for (const m of code.matchAll(
      /(^|[^:<\w])(?<!\btypeof\s+)(?<!\btype\s+\w+(?:<[^>]*>)?\s*=\s*)import\(\s*["']([^"']+)["']\s*\)/g,
    )) {
      const key = moduleKey(m[2], path);
      if (key) dynamics.push({ module: key, path });
    }
  }

  return dynamics
    .filter((d) => statics.has(d.module))
    .map((d) => ({
      ...d,
      importers: /** @type {string[]} */ (statics.get(d.module)),
    }));
}
