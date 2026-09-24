// The text is stored verbatim per page, with no de-hyphenation, so it is fit for retrieval, not citation.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { extractText, getDocumentProxy } from "unpdf";

import { doiSlug, paperPdfDiskPath } from "../app/lib/publications/paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_PATH = join(root, "data", "publications.site.json");
const OUT_PATH = join(root, "data", "publications.text.json");

async function extractorVersion() {
  const pkg = JSON.parse(
    await readFile(join(root, "node_modules", "unpdf", "package.json"), "utf8"),
  );
  return `${pkg.name} ${pkg.version}`;
}

async function main() {
  const site = JSON.parse(await readFile(SITE_PATH, "utf8"));

  // Hosted only: fetching from a publisher would add a network dependency to a script whose input is committed.
  const hosted = Object.entries(site).filter(([, fields]) => fields.pdfPath);

  if (hosted.length === 0) {
    throw new Error(
      "no hosted records in publications.site.json, so there is nothing to " +
        "extract. That is a corpus defect, not an empty afternoon.",
    );
  }

  /** @type {Record<string, { id: string, sha256: string, pages: number, chars: number, text: string[] }>} */
  const papers = {};

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
    // No gate compares this date; the gate compares each digest against the file on disk.
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
