// Reads a self-hosted paper's PDF and writes its sha256 and its full text into the publication file
// (docs/PUBLICATIONS.md): `node scripts/extract-publication-text.mjs [slug ...]`, every hosted file when none
// is named. Run it after adding or replacing a PDF; the file's `pdfSha256` and `## Full text` section are its
// output, and check:machine-readable refuses a file whose hash is not the PDF's. The text is stored as the
// twin prints it, with no de-hyphenation, so it is fit for retrieval, not citation.

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { extractText, getDocumentProxy } from "unpdf";

import { parsePublication, publicationPath } from "../app/lib/publications/parse.mjs";
import { paperPdfDiskPath } from "../app/lib/publications/paths.mjs";
import { renderPublicationFile } from "../app/lib/publications/serialize.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * C0 controls (symbol fonts mapped to low code points) are dropped, a code-point test and not a regex:
 * lint's no-control-regex refuses the character class.
 *
 * @param {string} value
 */
function stripControls(value) {
  let out = "";
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (!(point < 0x20 && point !== 0x09 && point !== 0x0a && point !== 0x0d)) out += character;
  }
  return out;
}

/** @param {string} slug */
async function extractOne(slug) {
  const file = join(root, publicationPath(slug));
  const raw = await readFile(file, "utf8");
  const { data } = parsePublication({ file: publicationPath(slug), raw });
  if (data.access !== "self-hosted") return null;

  const bytes = await readFile(join(root, paperPdfDiskPath(slug)));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(doc, { mergePages: false });
  const fullText = /** @type {string[]} */ (text)
    .map((page) => stripControls(page).trim())
    .filter(Boolean)
    .join("\n\n");

  await writeFile(file, renderPublicationFile({ ...data, pdfSha256: sha256 }, fullText), "utf8");
  return { slug, characters: fullText.length };
}

async function main() {
  const named = process.argv.slice(2);
  const slugs =
    named.length > 0
      ? named
      : (await readdir(join(root, "content", "publications"))).filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
  let done = 0;
  for (const slug of slugs.sort()) {
    const result = await extractOne(slug);
    if (!result) continue;
    done += 1;
    console.log(`  ${String(result.characters).padStart(7)}ch  ${slug}`);
  }
  if (done === 0) throw new Error("no self-hosted publication file was named, so nothing was extracted");
  console.log(`\nwrote the full text and pdfSha256 of ${done} publication file(s)`);
}

await main();
