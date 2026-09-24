/**
 * Reachability is not rendering: a bundle imported inside a branch the route never takes still
 * counts, which over-approximates in the safe direction for a byte ceiling.
 */

import { dirname, join } from "node:path";

/**
 * @param {string} source @param {string} file @param {string} appDir
 */
export function importsOf(source, file, appDir) {
  /** @type {string[]} */
  const modules = [];
  /** @type {string[]} */
  const assets = [];
  // A `?url` import is not a fetch: a component may import a bundle URL only to put it on a data
  // attribute, so an `enhance/dist` asset counts only when the same file renders the script tag.
  const rendersScript = source.includes("<EnhancementScript");

  for (const m of source.matchAll(/(?:from\s*|import\s*\(?\s*)["']([^"']+)["']/g)) {
    const spec = m[1];
    if (spec.includes("?url")) {
      const asset = spec.replace(/\?url$/, "");
      if (!asset.includes("enhance/dist/") || rendersScript) assets.push(asset);
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
 * does not know about node_modules or the vite alias table.
 *
 * @param {string} entry
 * @param {string} appDir
 * @param {(path: string) => string | null} read
 */
export function reachableAssets(entry, appDir, read) {
  const seen = new Set();
  /** @type {Set<string>} */
  const assets = new Set();
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
 * Root's sheets first: root is the parent match, and the cascade depends on that order.
 *
 * @param {any} manifest
 * @param {string} routeId
 */
export function stylesheetsFor(manifest, routeId) {
  const routes = manifest?.routes ?? {};
  const rootCss = routes.root?.css ?? [];
  const routeCss = routes[routeId]?.css ?? [];
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
