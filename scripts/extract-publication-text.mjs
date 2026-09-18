/**
 * Extracts the text of every hosted publication PDF into a committed artifact.
 *
 *   node scripts/extract-publication-text.mjs
 *
 * BOUNDARY: the text is stored VERBATIM, per page, with no de-hyphenation or column repair, so
 * what it is fit for is RETRIEVAL rather than citation; the presentation belongs to the twin that
 * joins the pages, and nothing on the rendered page is derived from this file.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { extractText, getDocumentProxy } from "unpdf";

import { doiSlug, paperPdfDiskPath } from "../app/lib/publications/paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_PATH = join(root, "data", "publications.site.json");
const OUT_PATH = join(root, "data", "publications.text.json");

/** The version this run used, read from the installed package rather than typed. */
async function extractorVersion() {
  const pkg = JSON.parse(
    await readFile(join(root, "node_modules", "unpdf", "package.json"), "utf8"),
  );
  return `${pkg.name} ${pkg.version}`;
}

async function main() {
  const site = JSON.parse(await readFile(SITE_PATH, "utf8"));

  /*
   * HOSTED ONLY: a record whose PDF this site does not serve has no bytes here to extract from, and
   * reaching out to a publisher would be a network dependency in a script whose input is committed.
   */
  const hosted = Object.entries(site).filter(([, fields]) => fields.pdfPath);

  if (hosted.length === 0) {
    throw new Error(
      "no hosted records in publications.site.json, so there is nothing to " +
        "extract. That is a corpus defect, not an empty afternoon.",
    );
  }

  /** @type {Record<string, { id: string, sha256: string, pages: number, chars: number, text: string[] }>} */
  const papers = {};

  // Sorted by the casefolded DOI so the file's key order is a property of the corpus rather than of
  // insertion order.
  for (const [doi, fields] of [...hosted].sort(([a], [b]) =>
    a.toLowerCase() < b.toLowerCase() ? -1 : 1,
  )) {
    const slug = doiSlug(doi);
    const diskPath = join(root, paperPdfDiskPath(slug));
    const bytes = await readFile(diskPath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    const doc = await getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text } = await extractText(doc, { mergePages: false });
    const pages = /** @type {string[]} */ (text);
    const chars = pages.reduce((sum, page) => sum + page.length, 0);

    papers[doi] = { id: fields.id, sha256, pages: totalPages, chars, text: pages };
    console.log(
      `  ${String(totalPages).padStart(3)}pp ${String(chars).padStart(7)}ch  ${slug}`,
    );
  }

  const out = {
    /*
     * A DATED OBSERVATION, which is what this file is: the date is the day the PDFs were read and no
     * gate compares it. What the gate compares is each digest against the file on disk, which is the
     * claim that can go stale. Rule 17's exception for evidence.
     */
    extractedAt: new Date().toISOString().slice(0, 10),
    extractor: await extractorVersion(),
    papers,
  };

  await writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  const totalChars = Object.values(papers).reduce((sum, p) => sum + p.chars, 0);
  const totalPages = Object.values(papers).reduce((sum, p) => sum + p.pages, 0);
  console.log(
    `\nwrote data/publications.text.json: ${Object.keys(papers).length} PDFs, ` +
      `${totalPages} pages, ${totalChars.toLocaleString()} characters`,
  );
}

await main();
