/**
 * Writes the markdown twin of every paper into the public directory.
 *
 *   npm run build:publication-twins
 *
 * BOUNDARY: a gitignored BUILD PRODUCT, derived entirely from tracked sources, and it PRUNES: a
 * paper removed or a DOI corrected leaves a twin this script would never overwrite and the next
 * deploy would upload. Directly under the directory, never recursive, the subdirectories holding
 * the PDFs.
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
 * Every twin, as a map from filename to bytes. Exported so the gate can generate and compare
 * without writing: a gate that repairs its subject before looking at it cannot fail.
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
   * Text is keyed by DOI as deposited and some are mixed case, so a raw-string lookup would silently
   * produce a twin with no full text.
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
         * Null and empty are different states and the twin renders them differently: null is "this site
         * does not host the PDF" and produces no full-text section, while an empty array is "the PDF is
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

/*
 * Writes only when run directly, so the gate's import cannot rewrite the files it is about to
 * compare.
 */
if (pathToFileURL(process.argv[1] ?? "").href === import.meta.url) {
  await main();
}
