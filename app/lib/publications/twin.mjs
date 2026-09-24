// A committed file, not a route like the blog twin: a route would put 1.13 MB of extracted text in the
// Worker bundle. The asset wins over the publications.$slug route for a .md path (measured).

import { decodeEntities } from "./entities.mjs";

/**
 * JSON.stringify is correct here: YAML's double-quoted style is a superset of JSON strings.
 *
 * @param {unknown} value
 * @returns {string}
 */
const yamlString = (value) => JSON.stringify(String(value ?? ""));

/**
 * Absent rather than null or empty: an empty value reads as a value.
 *
 * @param {string} key
 * @param {string | number | boolean | null | undefined} value
 * @returns {string[]}
 */
const line = (key, value) =>
  value === null || value === undefined || value === ""
    ? []
    : [`${key}: ${typeof value === "string" ? yamlString(value) : String(value)}`];

/**
 * A code-point test, not a regex: lint's no-control-regex refuses the character class.
 *
 * @param {string} value
 * @returns {string}
 */
function stripControls(value) {
  let out = "";
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    const isControl = point < 0x20 && point !== 0x09 && point !== 0x0a && point !== 0x0d;
    if (!isControl) out += character;
  }
  return out;
}

/**
 * Its own shape for the reason article-json-ld.mjs gives at PaperFacts.
 *
 * @typedef {object} TwinFacts
 * @property {string} id
 * @property {string} title
 * @property {string[]} authors
 * @property {number | null} year
 * @property {string | null} [publishedDate]
 * @property {string | null} [journal]
 * @property {string | null} [abstract]
 * @property {string | null} [summary]
 * @property {string | null} [pmcUrl]
 * @property {string | null} [preprintDoi]
 * @property {string | null} [externalUrl]
 * @property {string} doi
 * @property {boolean} [isOpenAccess]
 * @property {string | null} [license]
 * @property {{ kind: string, id: string }[]} [accessions]
 */

/**
 * Pure: check:machine-readable regenerates every twin and compares bytes.
 *
 * @param {TwinFacts} paper a record from app/data/publications.ts
 * @param {object} options
 * @param {string[] | null} options.pages extracted PDF text, one string per
 *   page, or null when this site does not host the PDF
 * @param {{ total: number } | null} options.citedBy from the cited-by artifact
 * @param {string | null} options.citedByFetchedAt the date that artifact was read
 * @param {string} options.pagePath the paper's HTML page, with its trailing slash
 * @param {string | null} options.pdfPath the hosted PDF, or null
 * @returns {string}
 */
export function paperTwin(paper, { pages, citedBy, citedByFetchedAt, pagePath, pdfPath }) {
  // Decoded here: the stored corpus keeps character references escaped on purpose (see entities.mjs).
  const title = decodeEntities(paper.title);
  const frontmatter = [
    "---",
    ...line("id", paper.id),
    ...line("title", title),
    "authors:",
    ...paper.authors.map((name) => `  - ${yamlString(decodeEntities(name))}`),
    ...line("venue", paper.journal ? decodeEntities(paper.journal) : null),
    ...line("year", paper.year),
    ...line("date", paper.publishedDate),
    ...line("doi", paper.doi),
    ...line("url", pagePath),
    ...line("pdf", pdfPath),
    ...line("pmc", paper.pmcUrl),
    ...line("preprintDoi", paper.preprintDoi),
    ...line("resource", paper.externalUrl),
    `openAccess: ${paper.isOpenAccess ? "true" : "false"}`,
    ...line("license", paper.license),
    // citedBy comes from the committed artifact, not live KV: the build stays a pure function of the
    // repo, and the artifact carries the date it was read.
    // accessions: absent, not empty, when there are none: the journal may simply have required no statement.
    ...(paper.accessions && paper.accessions.length > 0
      ? [
          "accessions:",
          ...paper.accessions.map(
            (a) => `  - ${yamlString(`${a.kind}:${a.id}`)}`,
          ),
        ]
      : []),
    ...line("citedBy", citedBy ? citedBy.total : null),
    ...line("citedBySource", citedBy && citedByFetchedAt ? `OpenAlex, read ${citedByFetchedAt}` : null),
    "---",
    "",
  ];

  const body = [`# ${title}`, ""];

  if (paper.summary) {
    body.push(paper.summary, "");
  }

  if (paper.abstract) {
    body.push("## Abstract", "", decodeEntities(paper.abstract), "");
  }

  // The provenance sentence decides whether a quotation from machine-extracted text can be trusted.
  if (pages !== null) {
    // C0 controls (symbol fonts mapped to low code points) are stripped only at this presentation
    // boundary; the artifact stays faithful to the PDF.
    const text = pages
      .map((page) => stripControls(page).trim())
      .filter(Boolean)
      .join("\n\n");
    body.push("## Full text", "");
    if (text.length === 0) {
      body.push(
        "Text extraction produced nothing for this PDF. It is most likely a scan " +
          "with no text layer. The PDF itself is linked above.",
        "",
      );
    } else {
      body.push(
        "Machine-extracted from the PDF linked above. It carries the artifacts " +
          "that come with reading a typeset two-column page: running heads, " +
          "figure captions in the flow of the prose, and words broken across " +
          "line ends. The abstract above is the registry's deposit and is the " +
          "authoritative text.",
        "",
        text,
        "",
      );
    }
  }

  return `${frontmatter.join("\n")}${body.join("\n")}`;
}
