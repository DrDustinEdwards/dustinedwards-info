/**
 * The islands the app build serves (devkit's siteScript, vite.config.ts), for the harnesses that bundle app code
 * outside that build: the plugin itself, and the source of its `virtual:islands` module from a real islands
 * build, so a rendered "kB gzipped" line is the build's number.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { siteScript } from "@dustinedwards/devkit/vite/site-script";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Absolute, so a harness run from another directory finds the same modules. */
const ISLANDS_DIR = join(root, "app", "enhance");

/** The plugin with the site's options: /site.js from app/site.ts, and the dev toolbar only ever in `vite dev`. */
export function islandsPlugin() {
  return siteScript({ entry: join(root, "app", "site.ts"), islands: ISLANDS_DIR });
}

/**
 * `virtual:islands` as a build serves it, every URL replaced by `url` so a rendered page does not change each
 * time an island's hash does.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function islandsModuleSource(url) {
  const plugin = /** @type {any} */ (islandsPlugin());
  plugin.configResolved({ command: "build" });
  const source = await plugin.load.call({ addWatchFile() {} }, "\0virtual:islands");
  return source.replace(/^export const ISLAND_URLS = (.*);$/m, (/** @type {string} */ _, /** @type {string} */ json) => {
    const urls = Object.fromEntries(Object.keys(JSON.parse(json)).map((name) => [name, url]));
    return `export const ISLAND_URLS = ${JSON.stringify(urls)};`;
  });
}

/**
 * Every file a build emits for the islands (/site.js, each island and the chunks they share), as the client
 * build writes them, for a test that reads the bytes a reader is served.
 *
 * @returns {Promise<Array<{ fileName: string, source: string }>>}
 */
export async function builtIslandFiles() {
  const plugin = /** @type {any} */ (islandsPlugin());
  plugin.configResolved({ command: "build" });
  /** @type {Array<{ fileName: string, source: string }>} */
  const files = [];
  await plugin.generateBundle.call({ environment: { name: "client" }, emitFile: (/** @type {any} */ file) => files.push(file) });
  return files;
}
