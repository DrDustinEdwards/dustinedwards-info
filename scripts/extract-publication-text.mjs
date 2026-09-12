/**
 * Extracts the text of every hosted publication PDF into
 * `data/publications.text.json`.
 *
 * Run: `node scripts/extract-publication-text.mjs`
 *
 * ## WHY THE TEXT IS A COMMITTED ARTIFACT AND NOT A BUILD STEP
 *
 * Same class as `data/publications.cited-by.json`, and for two of the same
 * reasons. It parses 27 MB of PDF to produce bytes that change only when a PDF
 * does, which is not a cost every gate run and every `npm run dev` should pay.
 * And it is EVIDENCE about bytes that are themselves committed, so it can be
 * checked rather than recomputed:
 * `check:publications` hashes each PDF on disk and compares against the
 * `sha256` recorded here, which binds the text to the exact file it came from.
 * A PDF replaced without re-running this reds the gate naming its DOI.
 *
 * The alternative was extracting during the build, which would have put a PDF
 * parser in the path of every gate run and every dev server start, to produce
 * bytes that change only when a PDF does. That is the shape ruling 39a moved
 * AWAY from for the artifacts it applies to, and it does not apply here: those
 * are cheap and derived from tracked text, this is expensive and derived from
 * tracked binaries.
 *
 * ## THE TEXT IS STORED VERBATIM, PER PAGE
 *
 * No de-hyphenation, no column repair, no whitespace collapsing. Two reasons.
 *
 * The extraction is one owner and the PRESENTATION is another: the markdown
 * twin decides how to join pages, and a normalisation baked in here would be
 * invisible to it and unfixable without re-running the extractor over 27 MB of
 * PDFs. Whatever the twin wants to do to this text, it can do to the text as it
 * came out.
 *
 * And the obvious normalisation is wrong more often than it looks.
 * `reticuloendo-\ntheliosis` should be joined and `well-\nknown` should not,
 * and nothing here can tell those apart without a dictionary. The honest thing
 * is to keep the artifact faithful to the PDF and to say in the twin that the
 * text is machine-extracted, rather than to invent a cleaned-up version that
 * reads better and is sometimes wrong. `build-publications.mjs` records what
 * the July import cost when it guessed: `<scp>RNA</scp>Tumour` became
 * `RNATumour` and nothing caught it.
 *
 * ## WHAT IT IS FOR, WHICH BOUNDS HOW GOOD IT HAS TO BE
 *
 * Retrieval, not citation. The twin carries it so that Ask and the search MCP
 * can answer a question from the body of a paper rather than from its abstract
 * alone. The abstract stays the registry's, the bibliographic record stays
 * Crossref's, and nothing on the rendered page is derived from this file.
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
   * HOSTED ONLY. A record whose PDF this site does not serve has no bytes here
   * to extract from, and reaching out to a publisher for one would be a network
   * dependency in a script whose whole point is that its input is committed.
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

  // Sorted by the casefolded DOI so the file's key order is a property of the
  // corpus rather than of Object.entries' insertion order.
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
     * A DATED OBSERVATION, which is what this file is. The date is the day the
     * PDFs were read, and it is not compared by any gate: what the gate compares
     * is each `sha256` against the file on disk, which is the claim that can go
     * stale. Rule 17's exception for evidence.
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
