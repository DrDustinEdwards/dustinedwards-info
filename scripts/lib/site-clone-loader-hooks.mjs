// The resolve hook behind site-clone-loader.mjs.

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const APP = process.env.SITE_APP ?? "";
/** @type {Record<string, string>} */
const STUBS = JSON.parse(process.env.SITE_STUBS ?? "{}");
const EXTENSIONS = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.mjs"];

/** @param {string} specifier @param {any} context @param {Function} nextResolve */
export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(STUBS, specifier)) return { url: pathToFileURL(/** @type {string} */ (STUBS[specifier])).href, shortCircuit: true };
  if (specifier.startsWith("~/") && APP) {
    const base = join(APP, specifier.slice(2));
    for (const extension of EXTENSIONS) {
      const candidate = `${base}${extension}`;
      if (existsSync(candidate) && statSync(candidate).isFile()) return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
    throw new Error(`site-clone-loader: ${specifier} is not under ${APP}`);
  }
  return nextResolve(specifier, context);
}
