// Prunes: a removed paper or corrected DOI leaves a twin nothing would overwrite and the next deploy
// would upload. Not recursive, because the subdirectories hold the PDFs.

import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PUBLICATIONS } from "../app/data/publications.ts";
import { citedByFetchedAt, citedByFor } from "../app/lib/publications/cited-by.mjs";
import { doiSlug, paperPath, paperPdfPath } from "../app/lib/publications/paths.mjs";
import { paperTwin } from "../app/lib/publications/twin.mjs";
import { deleteFloor } from "./lib/delete-floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public", "publications");

/** @param {string} doi */
const doiKey = (doi) => (doi ?? "").trim().toLowerCase();

/**
 * Exported so the gate can generate and compare without writing.
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

  // Required: `papers ?? {}` turned a reshaped file into every hosted twin without its full text.
  if (!extracted?.papers || typeof extracted.papers !== "object") {
    throw new Error("data/publications.text.json carries no papers object");
  }
  // Text is keyed by DOI as deposited, some mixed case, so a raw lookup silently yields no full text.
  const textByDoi = new Map(
    Object.entries(extracted.papers).map(([doi, entry]) => [doiKey(doi), entry]),
  );
  const fetchedAt = citedByFetchedAt(citedByArtifact);

  /** @type {Map<string, string>} */
  const twins = new Map();
  for (const paper of PUBLICATIONS) {
    const slug = doiSlug(paper.doi);
    const hosted = paper.access === "self-hosted" && paper.pdfPath !== null;
    const entry = textByDoi.get(doiKey(paper.doi));
    // A hosted paper absent from the text file would publish a twin with an empty full-text section,
    // which reads as "extraction found nothing" when extraction never ran.
    if (hosted && !Array.isArray(entry?.text)) {
      throw new Error(
        `${paper.doi} is self-hosted but data/publications.text.json has no text for it. ` +
          `Run the extraction before building twins.`,
      );
    }
    twins.set(
      `${slug}.md`,
      paperTwin(paper, {
        // Null means the PDF is not hosted (no full-text section); an empty array means extraction found
        // nothing, which the twin says out loud.
        pages: hosted ? entry.text : null,
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
  const refusal = deleteFloor({
    what: "publication twins",
    keeping: present.length - stale.length,
    removing: stale.length,
  });
  if (refusal) throw new Error(`REFUSED to prune: ${refusal}. Nothing was removed.`);
  for (const name of stale) {
    await unlink(join(OUT_DIR, name));
  }

  const bytes = [...twins.values()].reduce((sum, body) => sum + Buffer.byteLength(body), 0);
  console.log(
    `wrote ${twins.size} publication twins (${(bytes / 1024).toFixed(0)} KB)` +
      (stale.length > 0 ? `, removed ${stale.length} stale: ${stale.join(", ")}` : ""),
  );
}

// Writes only when run directly, so the gate's import cannot rewrite the files it compares.
if (pathToFileURL(process.argv[1] ?? "").href === import.meta.url) {
  await main();
}
