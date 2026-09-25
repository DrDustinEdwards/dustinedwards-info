// Constructed paths read as unattached: a false negative in the safe direction, which is why the page
// says "no reference found" rather than "unused".

import { readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// `readFileSync` rather than an import attribute: the attribute needs a newer module setting and fails
// the typecheck rather than the run.
const assetManifest = JSON.parse(
  readFileSync(path.join("content", "generated", "assets.json"), "utf8"),
);
import {
  SOURCE_FILES,
  SOURCE_ROOTS,
  foldRefs,
  isSourceFile,
  referencesIn,
  stripComments,
} from "../app/lib/media/template-refs.mjs";

export const TEMPLATE_REFS_PATH = path.join("content", "generated", "template-refs.json");

/**
 * Forward slashes always: the artifact is committed and compared across machines.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    out.push(full.split(path.sep).join("/"));
  }
  return out;
}

/**
 * @returns {Promise<{ generated: number, refs: Record<string, string[]>, filesRead: number, assetsConsidered: number }>}
 */
export async function scanTemplateRefs() {
  const assetPaths = assetManifest.paths;
  /** @type {string[]} */
  const files = [];
  for (const root of SOURCE_ROOTS) files.push(...(await walk(root)));
  files.push(...SOURCE_FILES);

  const kept = files.filter(isSourceFile);
  // The media admin reports template references from this artifact, so a scan of nothing clears them.
  if (!Array.isArray(assetPaths) || assetPaths.length === 0 || kept.length === 0) {
    throw new Error(
      `build:template-refs scanned ${kept.length} source file(s) against ` +
        `${Array.isArray(assetPaths) ? assetPaths.length : "no"} known asset(s). An empty scope ` +
        `reports the same as a repo with no references, so nothing was written.`,
    );
  }
  /** @type {Array<{ file: string, assets: string[] }>} */
  const scanned = [];
  for (const file of kept) {
    const raw = await readFile(file, "utf8");
    // Comments go first: a doc comment naming an asset is prose, not a placement. JSON is passed through,
    // because a tokenizer would treat a `//` inside a URL string as a comment.
    const text = file.endsWith(".json") || file.endsWith(".webmanifest")
      ? raw
      : stripComments(raw, file.endsWith(".css"));
    const assets = referencesIn(text, assetPaths);
    if (assets.length > 0) scanned.push({ file, assets });
  }
  return {
    ...foldRefs(scanned),
    // Scope is carried in the artifact: a scan that read zero files reports the same as a repo with none.
    filesRead: kept.length,
    assetsConsidered: assetPaths.length,
  };
}

// `pathToFileURL`: on this host a hand-built URL differs in its slashes, so the script would exit 0
// having never written the artifact.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await scanTemplateRefs();
  await writeFile(TEMPLATE_REFS_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(
    `build:template-refs ok. ${result.generated} asset(s) referenced by repository code, ` +
      `from ${result.filesRead} source file(s) against ${result.assetsConsidered} known asset(s).`,
  );
}
