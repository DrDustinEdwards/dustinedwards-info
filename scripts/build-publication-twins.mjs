/**
 * Writes the markdown twin of every paper into `public/publications/`.
 *
 * Run: `npm run build:publication-twins`
 *
 * A BUILD PRODUCT, gitignored, on exactly the terms ruling 39a set for
 * `content/generated/posts.json`: it is derived entirely from tracked sources
 * (`app/data/publications.ts`, `data/publications.text.json`,
 * `data/publications.cited-by.json`), so committing it would make every corpus
 * change a two-file change that only a machine running this script could
 * complete. It runs where `build:content` runs: check-all's preflight, ship's
 * build step, CI's build step, and `npm run dev`.
 *
 * The twins are ASSETS rather than route output. The reasoning, and the
 * measurement behind it, is on `app/lib/publications/twin.mjs`.
 *
 * ## IT PRUNES, AND THAT IS NOT TIDINESS
 *
 * A gitignored file that nothing deletes is a file that outlives its reason. A
 * paper removed from the corpus, or a DOI corrected, leaves a twin on disk that
 * this script would never overwrite, `check:publications` would never compare,
 * and the next deploy would upload: a page that 404s with a twin beside it that
 * still answers. So every `.md` directly under `public/publications/` that this
 * run did not write is removed, and the run says how many.
 *
 * Directly under, never recursive: `public/publications/<slug>/` holds the PDFs
 * and nothing here has any business walking into it.
 */

import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PUBLICATIONS } from "../app/data/publications.ts";
import { citedByFetchedAt, citedByFor } from "../app/lib/publications/cited-by.mjs";
import { doiSlug, paperPath, paperPdfPath } from "../app/lib/publications/paths.mjs";
import { paperTwin } from "../app/lib/publications/twin.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public", "publications");

/** @param {string} doi */
const doiKey = (doi) => (doi ?? "").trim().toLowerCase();

/**
 * Every twin, as a map from `<slug>.md` to its bytes.
 *
 * Exported so `check:publications` can generate and compare without writing,
 * for the reason `build-publications.mjs` guards its own write: a gate that
 * repairs its subject before looking at it cannot fail.
 *
 * @returns {Promise<Map<string, string>>}
 */
export async function generateTwins() {
  const extracted = JSON.parse(
    await readFile(join(root, "data", "publications.text.json"), "utf8"),
  );
  const citedByArtifact = JSON.parse(
    await readFile(join(root, "data", "publications.cited-by.json"), "utf8"),
  );

  /*
   * Text is keyed by DOI as deposited, and six of the 36 are mixed case. A
   * raw-string lookup would silently produce a twin with no full text, which is
   * the failure `doiKey` exists to prevent everywhere else in this corpus.
   */
  const textByDoi = new Map(
    Object.entries(extracted.papers ?? {}).map(([doi, entry]) => [doiKey(doi), entry]),
  );
  const fetchedAt = citedByFetchedAt(citedByArtifact);

  /** @type {Map<string, string>} */
  const twins = new Map();
  for (const paper of PUBLICATIONS) {
    const slug = doiSlug(paper.doi);
    const hosted = paper.access === "self-hosted" && paper.pdfPath !== null;
    const entry = textByDoi.get(doiKey(paper.doi));
    twins.set(
      `${slug}.md`,
      paperTwin(paper, {
        /*
         * Null and empty are different states and the twin renders them
         * differently: null is "this site does not host the PDF" and produces
         * no full-text section at all, while an empty array is "the PDF is
         * here and extraction found nothing", which the twin says out loud.
         */
        pages: hosted ? (entry?.text ?? []) : null,
        citedBy: citedByFor(citedByArtifact, paper.doi),
        citedByFetchedAt: fetchedAt,
        pagePath: paperPath(slug),
        pdfPath: hosted ? paperPdfPath(slug) : null,
      }),
    );
  }
  return twins;
}

async function main() {
  const twins = await generateTwins();

  for (const [name, body] of twins) {
    await writeFile(join(OUT_DIR, name), body, "utf8");
  }

  const present = (await readdir(OUT_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name);
  const stale = present.filter((name) => !twins.has(name));
  for (const name of stale) {
    await unlink(join(OUT_DIR, name));
  }

  const bytes = [...twins.values()].reduce((sum, body) => sum + Buffer.byteLength(body), 0);
  console.log(
    `wrote ${twins.size} publication twins (${(bytes / 1024).toFixed(0)} KB)` +
      (stale.length > 0 ? `, removed ${stale.length} stale: ${stale.join(", ")}` : ""),
  );
}

/* Writes only when run directly, so the gate's import cannot rewrite the files
 * it is about to compare. `build-publications.mjs` carries the full grounds. */
if (pathToFileURL(process.argv[1] ?? "").href === import.meta.url) {
  await main();
}
