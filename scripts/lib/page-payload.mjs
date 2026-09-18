/**
 * What a cold load of one public route actually fetches, resolved offline.
 *
 * Split out of the gate because the DECISION is a pure function over a manifest and a set of
 * source files, and a pure function can be driven by tests. The gate supplies the disk.
 *
 * WHY DERIVED AND NOT DECLARED: a hand-kept list goes stale in the direction that hides bytes from
 * the gate. STYLESHEETS come from React Router's own browser manifest, root's plus the route's,
 * which is what the document carries. ENHANCEMENT BUNDLES come from a reachability walk over the
 * route's import graph, following `~/` and relative imports inside `app/`.
 *
 * WHAT THE WALK CANNOT SEE, stated because it bounds every count: reachability is not rendering,
 * so a bundle imported inside a branch the route never takes still counts, which over-approximates
 * in the safe direction for a ceiling. Nor can it see a bundle fetched at runtime rather than
 * imported, which is correctly not part of any page's cold load.
 */

import { dirname, join } from "node:path";

/**
 * Module specifiers a source file imports, normalised to absolute paths inside `app/`, plus the
 * raw `?url` specifiers, which are assets rather than modules.
 *
 * @param {string} source @param {string} file @param {string} appDir
 */
export function importsOf(source, file, appDir) {
  /** @type {string[]} */
  const modules = [];
  /** @type {string[]} */
  const assets = [];
  /*
   * A `?url` IMPORT IS NOT A FETCH, and conflating the two was this walk's first bug: a component
   * imports the palette bundle's URL so it can put it on a data attribute, and a gesture fetches it,
   * so counting the import made every route look like it served a search dialog. What puts a bundle
   * on a page is the component that renders the script tag, so an `enhance/dist` asset counts only
   * when the file naming it also renders that component. Every other `?url` asset is collected
   * unconditionally and the callers filter.
   */
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
 * Every `?url` asset specifier reachable from `entry`, following imports inside `app/`.
 * Cycle-safe by construction, and a specifier that resolves to nothing is SKIPPED rather than
 * thrown on, the walk deliberately not knowing about node_modules or the vite alias table.
 *
 * @param {string} entry absolute path to a route or root module
 * @param {string} appDir
 * @param {(path: string) => string | null} read returns source or null
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
 * A specifier to a real file, trying the extensions a TypeScript project omits.
 *
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
 * The stylesheets a route's document links, root's first then its own. The order is the
 * manifest's: root is the parent match, which is the cascade the site depends on since the split.
 *
 * @param {any} manifest React Router's browser manifest
 * @param {string} routeId
 */
export function stylesheetsFor(manifest, routeId) {
  const routes = manifest?.routes ?? {};
  const rootCss = routes.root?.css ?? [];
  const routeCss = routes[routeId]?.css ?? [];
  /** Deduplicated, because a sheet imported by both is linked once. */
  return [...new Set([...rootCss, ...routeCss])];
}

/**
 * Font files a set of stylesheets reference from `@font-face`, deliberately only there: a
 * `url()` elsewhere is fetched only if something matches, while a face is fetched whenever the
 * family is used, which on this site is every page.
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
