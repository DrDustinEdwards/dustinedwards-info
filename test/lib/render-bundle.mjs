/*
 * Renders real components to HTML under plain node. The components are TSX behind `~/` imports and `?url`
 * assets, so Vite bundles an entry with the React that renders it, the bundle is written to a temporary
 * directory and imported from there. The one harness for the header, header-speculation and home hero tests.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "vite";

import { enhancePlugin } from "../../scripts/lib/enhance-bundle.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @param {string} entrySource module text that exports what the test calls; it may import from `~/`
 * @returns {Promise<Record<string, any>>} the entry's exports
 */
export async function bundleRenderer(entrySource) {
  const ENTRY = "virtual:render-entry";
  const built = await build({
    configFile: false,
    root,
    logLevel: "silent",
    mode: "production",
    resolve: { alias: [{ find: /^~\//, replacement: `${join(root, "app")}/` }] },
    ssr: { noExternal: true },
    plugins: [
      // The header renders <Enhance module="header">, which reads its URL from `virtual:enhance`.
      enhancePlugin(),
      {
        name: "render-entry",
        enforce: "pre",
        resolveId: (id) => (id === ENTRY ? `\0${ENTRY}` : null),
        load: (id) => (id === `\0${ENTRY}` ? entrySource : null),
      },
    ],
    build: {
      write: false,
      ssr: true,
      minify: false,
      rollupOptions: { input: ENTRY, output: { format: "esm", codeSplitting: false } },
    },
  });
  const chunk = (Array.isArray(built) ? built[0] : built).output.find((o) => o.type === "chunk");
  const dir = mkdtempSync(join(tmpdir(), "render-bundle-"));
  try {
    writeFileSync(join(dir, "entry.mjs"), chunk.code);
    return await import(pathToFileURL(join(dir, "entry.mjs")).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
