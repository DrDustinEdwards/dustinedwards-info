/**
 * Scans the repository source for asset references into a committed manifest.
 *
 *   npm run build:template-refs
 *
 * The THIRD usage state depends on this file. `media_refs` and
 * `resolveCitations` both answer "does a POST cite this", and nothing answered
 * "does the SITE ITSELF place this", so nine cohort photographs referenced by
 * `app/data/phage-hunters.ts` read as unreferenced next to a delete button.
 *
 * Every decision lives in `app/lib/media/template-refs.mjs`, which is pure and
 * unit tested. This file is the part that touches a filesystem and nothing else,
 * for the same reason `build-assets.mjs` is split that way: a scan that decides
 * things in the same function that walks directories cannot be tested without a
 * repository.
 *
 * OBSERVATION BOUNDARY: this reads SOURCE TEXT and matches asset paths as
 * literal strings. It sees `src: "/phage-hunters/2019.webp"` and it does not see
 * `src: \`/diagrams/${id}.svg\``, because evaluating a template literal means
 * running the code. Constructed paths therefore read as unattached, which is a
 * false negative in the safe direction: this tool under-claims usage and never
 * invents it. The copy on the page says "no reference found" rather than
 * "unused" precisely because of this line.
 */

import { readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/*
 * `readFileSync` rather than an import attribute, per the ruling verify-live.mjs
 * already records: `with { type: "json" }` is only legal under a newer `module`
 * setting than this repo's tsconfig uses, and it fails the TYPECHECK rather than
 * the run, so it looks fine until `tsc -b`.
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
 * Every source file under the scanned roots, repo-relative with forward slashes.
 *
 * Forward slashes always, because the artifact is committed and compared: a
 * Windows backslash would make it disagree with itself across machines, which
 * is the platform-dependence `walkPublic` already had to fix once.
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
    // COMMENTS GO FIRST. A doc comment naming an asset is prose about it, not a
    // placement of it; this module's own header caught exactly that and would
    // have marked six brand files as placed by page code. JSON has no comments,
    // so it is passed through unchanged rather than run through a tokenizer that
    // would treat a `//` inside a URL string as one.
    const text = file.endsWith(".json") || file.endsWith(".webmanifest")
      ? raw
      : stripComments(raw, file.endsWith(".css"));
    const assets = referencesIn(text, assetPaths);
    if (assets.length > 0) scanned.push({ file, assets });
  }
  return {
    ...foldRefs(scanned),
    // SCOPE, carried in the artifact rather than printed and forgotten. A scan
    // that read zero files reports the same "no references" as a repository
    // that genuinely has none, and this is the number that tells them apart.
    filesRead: kept.length,
    assetsConsidered: assetPaths.length,
  };
}

/*
 * THROUGH `pathToFileURL`, NEVER BY CONCATENATING `file://`.
 *
 * The hand-rolled form was written first and silently did nothing on this host:
 * `import.meta.url` is `file:///C:/...` with THREE slashes and a concatenated
 * `file://` + `C:/...` has two, so the comparison was false, the script exited
 * 0, and the artifact was never written. A build step that succeeds while
 * producing no output is the worst shape a build step can have, and it is the
 * same Windows path class that has already cost this repo a vacuous plant.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await scanTemplateRefs();
  await writeFile(TEMPLATE_REFS_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(
    `build:template-refs ok. ${result.generated} asset(s) referenced by repository code, ` +
      `from ${result.filesRead} source file(s) against ${result.assetsConsidered} known asset(s).`,
  );
}
