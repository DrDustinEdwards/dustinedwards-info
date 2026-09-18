/**
 * Scans the repository source for asset references into a committed manifest, which is how the
 * media library answers "does the SITE ITSELF place this".
 *
 *   npm run build:template-refs
 *
 * BOUNDARY: it reads SOURCE TEXT and matches asset paths as literal strings, so a constructed path
 * reads as unattached. That is a false negative in the safe direction: this under-claims usage and
 * never invents it, which is why the page says "no reference found" rather than "unused".
 */

import { readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/*
 * `readFileSync` rather than an import attribute: the attribute form is only legal under a newer
 * module setting than this repo's, and it fails the TYPECHECK rather than the run, so it looks
 * fine until the build.
 */
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
 * Every source file under the scanned roots, repo-relative with forward slashes always, because
 * the artifact is committed and compared: a backslash would make it disagree with itself across
 * machines.
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
 * The scan, as data, so both the build and the gate run one implementation.
 *
 * @returns {Promise<{ generated: number, refs: Record<string, string[]>, filesRead: number, assetsConsidered: number }>}
 */
export async function scanTemplateRefs() {
  const assetPaths = assetManifest.paths;
  /** @type {string[]} */
  const files = [];
  for (const root of SOURCE_ROOTS) files.push(...(await walk(root)));
  files.push(...SOURCE_FILES);

  const kept = files.filter(isSourceFile);
  /** @type {Array<{ file: string, assets: string[] }>} */
  const scanned = [];
  for (const file of kept) {
    const raw = await readFile(file, "utf8");
    // COMMENTS GO FIRST: a doc comment naming an asset is prose about it, not a placement of it, and
    // this module's own header caught exactly that. JSON has no comments, so it is passed through
    // rather than run through a tokenizer that would treat a `//` inside a URL string as one.
    const text = file.endsWith(".json") || file.endsWith(".webmanifest")
      ? raw
      : stripComments(raw, file.endsWith(".css"));
    const assets = referencesIn(text, assetPaths);
    if (assets.length > 0) scanned.push({ file, assets });
  }
  return {
    ...foldRefs(scanned),
    // SCOPE, carried in the artifact rather than printed and forgotten: a scan that read zero files
    // reports the same "no references" as a repository that genuinely has none.
    filesRead: kept.length,
    assetsConsidered: assetPaths.length,
  };
}

/*
 * THROUGH `pathToFileURL`, NEVER BY CONCATENATING A URL SCHEME: the hand-rolled form silently did
 * nothing on this host, the two spellings differing in their slashes, so the script exited 0 and
 * the artifact was never written. A build step that succeeds while producing no output is the
 * worst shape a build step can have.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await scanTemplateRefs();
  await writeFile(TEMPLATE_REFS_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(
    `build:template-refs ok. ${result.generated} asset(s) referenced by repository code, ` +
      `from ${result.filesRead} source file(s) against ${result.assetsConsidered} known asset(s).`,
  );
}
