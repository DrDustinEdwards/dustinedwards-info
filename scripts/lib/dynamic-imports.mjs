// Which dynamic imports split nothing, because some module in the same graph imports the same
// module statically. Read from source, not the build log.

import { posix } from "node:path";

import { stripComments } from "./strip-comments.mjs";

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
