// One door from a publication file to everything derived from it: parse, validate, the record every
// surface reads, the markdown twin and the search input. check:machine-readable, sync:content, the
// build and the Carrel adapter's save all call compilePublication, so a file CI passes is the file the
// save accepts and the page draws, and the twin a machine reads is the one a person's page agrees with.

import { gitBlobSha } from "../content/hashes.mjs";
import { keyForUrl, urlForKey } from "../search/ask-keys.mjs";
import { buildCitationTags, REQUIRED_CITATION_TAGS } from "./citation-tags.mjs";
import { citedByFetchedAt, citedByFor } from "./cited-by.mjs";
import { decodeEntities } from "./entities.mjs";
import { organismsIn, toBibtex, toRis } from "./exports.mjs";
import { parsePublication, publicationPath } from "./parse.mjs";
import { paperAskUrl, paperMarkdownPath, paperPath, paperPdfPath } from "./paths.mjs";
import { recordFromData } from "./record.mjs";
import { paperSearchInputs } from "./search-inputs.mjs";
import { paperTwin } from "./twin.mjs";
import { ASK_URL_MAX, validatePublicationFile } from "./validate.mjs";

const ORIGIN = "https://example.invalid";
const REFERENCE = /&(?:amp|lt|gt|quot|apos|#\d+);/;

/**
 * What a record promises other surfaces, checked once it is built: the Scholar tag set, the exports,
 * the twin, the search record and the Ask key. Each is a function of the record alone, so a file that
 * passes here cannot fail the page at render time.
 *
 * @param {import("./types.ts").Publication} record
 * @param {{ twin: string, searchBody: string, fullText: string | null }} built
 * @returns {string[]}
 */
function derivedProblems(record, built) {
  /** @type {string[]} */
  const errors = [];
  const { slug } = record;
  const hosted = record.access === "self-hosted" && record.pdfPath !== null;

  if (record.doi !== null) {
    try {
      const tags = buildCitationTags(record, {
        abstractUrl: `${ORIGIN}${paperPath(slug)}`,
        pdfUrl: hosted ? `${ORIGIN}${paperPdfPath(slug)}` : null,
      });
      const names = tags.map((t) => t.name);
      for (const required of REQUIRED_CITATION_TAGS) {
        if (!names.includes(required)) errors.push(`citation tags: no ${required}`);
      }
      const authorTags = tags.filter((t) => t.name === "citation_author").length;
      if (authorTags !== record.authors.length) {
        errors.push(`citation tags: ${authorTags} citation_author tags for ${record.authors.length} authors; one per author, or Scholar reads a single author whose name is the whole list`);
      }
      const pdf = tags.find((t) => t.name === "citation_pdf_url");
      if (hosted && !pdf) errors.push("citation tags: hosted but no citation_pdf_url");
      if (!hosted && pdf) errors.push("citation tags: not hosted but has citation_pdf_url");
      if (pdf && !pdf.content.startsWith(`${ORIGIN}${paperPath(slug)}`)) {
        errors.push(`citation tags: citation_pdf_url is not under ${paperPath(slug)}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const bib = toBibtex(record);
    const ris = toRis(record);
    if (!bib.includes(record.doi) || !ris.includes(record.doi)) errors.push("exports: the DOI is missing from the BibTeX or RIS entry");
    if (record.doi !== record.doi.toLowerCase() && !bib.includes(`doi = {${record.doi}}`)) {
      errors.push("exports: a mixed-case DOI must be exported as deposited");
    }
    if (REFERENCE.test(bib) || REFERENCE.test(ris)) errors.push("exports: a character reference survives into BibTeX or RIS");
    const unprotected = organismsIn(record.title).filter((o) => !bib.includes(`{${o}}`));
    if (unprotected.length > 0) errors.push(`exports: organism name(s) not brace-protected in BibTeX: ${unprotected.join(", ")}`);
  }

  if (REFERENCE.test(built.twin)) errors.push("twin: carries an undecoded character reference");
  if (hosted && built.fullText !== null && !built.twin.includes("## Full text")) errors.push("twin: a hosted paper's twin lacks its Full text section");
  // Classic search shows the line it matched, so two-column text would snippet a mangled one.
  if (hosted && built.fullText && built.searchBody.length > built.fullText.length / 2) {
    errors.push("search record: the body carries the PDF text; only the abstract, summary and citation belong in it");
  }

  const key = keyForUrl(paperPath(slug));
  if (key !== `research/publications/${slug}.md` || urlForKey(key) !== paperPath(slug)) {
    errors.push(`Ask key: ${key} does not map back to ${paperPath(slug)}`);
  }
  if (`/${key}` !== paperMarkdownPath(slug)) errors.push(`Ask key: ${key} is not the twin's path ${paperMarkdownPath(slug)}`);
  const askUrl = paperAskUrl(decodeEntities(record.title));
  if (!askUrl.startsWith("/search?q=") || askUrl.length > ASK_URL_MAX) errors.push("Ask link: the quoted title does not build a /search URL");
  return errors;
}

/**
 * @param {object} input
 * @param {string} input.slug
 * @param {string} input.raw the whole file
 * @param {import("./validate.mjs").PublicationHost} input.host
 * @param {import("./validate.mjs").OtherPublication[]} [input.others]
 * @param {unknown} input.citedByArtifact the parsed data/publications.cited-by.json, which the twin's
 *   citedBy line is a pure function of, so a build and a save write the same twin
 * @returns {Promise<
 *   | { ok: false, errors: string[] }
 *   | { ok: true, errors: [], record: import("./types.ts").Publication, draft: boolean, csl: Record<string, unknown> | null,
 *       fullText: string | null, pdfSha256: string | null, twin: string, searchInput: { uid: string, url: string, title: string, body: string },
 *       sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compilePublication({ slug, raw, host, others, citedByArtifact }) {
  const file = publicationPath(slug);
  const parsed = parsePublication({ file, raw });
  const errors = await validatePublicationFile({ parsed, slug, host, others });
  if (errors.length > 0) return { ok: false, errors };

  const record = recordFromData(/** @type {any} */ (parsed.data), slug);
  const hosted = record.access === "self-hosted" && record.pdfPath !== null;
  const twin = paperTwin(record, {
    pages: hosted ? [parsed.fullText ?? ""] : null,
    citedBy: record.doi ? citedByFor(citedByArtifact, record.doi) : null,
    citedByFetchedAt: citedByFetchedAt(citedByArtifact),
    pagePath: paperPath(slug),
    pdfPath: hosted ? paperPdfPath(slug) : null,
  });
  const searchInput = /** @type {NonNullable<ReturnType<typeof paperSearchInputs>[number]>} */ (paperSearchInputs([record])[0]);
  const derived = derivedProblems(record, {
    twin,
    searchBody: searchInput.body,
    fullText: parsed.fullText,
  });
  if (derived.length > 0) return { ok: false, errors: derived };

  const csl = parsed.data.csl && typeof parsed.data.csl === "object" ? /** @type {Record<string, unknown>} */ (parsed.data.csl) : null;
  return {
    ok: true,
    errors: [],
    record,
    draft: parsed.data.draft === true,
    csl,
    fullText: parsed.fullText,
    pdfSha256: typeof parsed.data.pdfSha256 === "string" ? parsed.data.pdfSha256 : null,
    twin,
    searchInput,
    sourcePath: file,
    sourceBlobSha: await gitBlobSha(raw),
  };
}
