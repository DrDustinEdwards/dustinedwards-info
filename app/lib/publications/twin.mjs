/**
 * The markdown twin of one paper: the whole record as plain text, for a reader
 * that is a program.
 *
 * ## WHY A PAPER HAS A TWIN AT ALL
 *
 * The same reason a post does. `/blog/<slug>.md` exists because an agent should
 * be able to read the prose without parsing markup, and `llms.txt` advertises
 * it by name. A paper page is denser than a post: the bibliographic record is
 * spread across a citation line, a link row, a badge and thirty-odd meta tags,
 * and reconstructing it from the HTML means knowing which of those to trust.
 * The twin states it once, in a frontmatter block, and then gives the text.
 *
 * ## WHAT IT CARRIES THAT THE PAGE DOES NOT: the full text
 *
 * The page shows the abstract, because that is what a human reader wants and
 * what Scholar indexes. The twin also carries the extracted text of the PDF,
 * which is what makes Ask and the search MCP able to answer a question from the
 * body of a paper rather than from its abstract alone. Ruling 63 asked for it
 * in exactly those words.
 *
 * That text is MACHINE-EXTRACTED and the twin says so where it appears. It
 * carries column artifacts, running heads, and words broken across line ends,
 * because `extract-publication-text.mjs` deliberately does not repair those
 * (the grounds are there). A reader that needs the exact words of a sentence
 * should read the PDF; this is for retrieval.
 *
 * ## WHY THE TWIN IS A FILE AND NOT A ROUTE, which is the opposite of the blog
 *
 * `/blog/<slug>.md` is a route because a post lives in D1 and depends on the
 * clock: a scheduled post must be absent today and present next week, and only
 * a request-time read can express that. A paper is committed data with no
 * schedule and no draft state, so its twin is a pure function of files in this
 * repository and can be written at build time.
 *
 * Making it a file rather than a route buys one concrete thing: the extracted
 * text, 1.13 MB across 31 papers, never enters the Worker bundle. A route would
 * have to import it, and that is a megabyte carried on every request to every
 * page on this site to serve 36 URLs. As an asset it is served without invoking
 * the Worker at all.
 *
 * VERIFIED, not assumed: `/publications/<slug>.md` is also matched by the
 * `publications.$slug` route, which would 404 on a slug ending in `.md`.
 * Measured against a local build on 2026-09-12, the asset wins: 200,
 * `text/markdown; charset=utf-8`, the file's own bytes. `public/_headers` then
 * sets the cache policy and keeps it out of the search index.
 */

import { decodeEntities } from "./entities.mjs";

/**
 * A string as a YAML double-quoted scalar.
 *
 * `JSON.stringify` rather than a hand-rolled escaper, and that is a fact about
 * YAML rather than a shortcut: YAML's double-quoted style is a superset of
 * JSON's string syntax, so anything JSON escapes correctly, YAML reads
 * correctly. Titles here carry colons, quotation marks and non-ASCII, each of
 * which breaks a bare scalar in a different way.
 *
 * @param {unknown} value
 * @returns {string}
 */
const yamlString = (value) => JSON.stringify(String(value ?? ""));

/**
 * One frontmatter line, or nothing when the value is absent.
 *
 * ABSENT RATHER THAN NULL. A key with an empty value invites a reader to treat
 * `""` as the license, and a `null` in YAML is a value too. A paper with no
 * PMC record simply has no `pmc` key, which is the same shape the CSL exports
 * use for a field a registry never deposited.
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
 * Text with the C0 control characters removed, keeping tab, newline and return.
 *
 * A CODE POINT TEST RATHER THAN A REGEX, and not as a style preference: a
 * character class holding \u0000 to \u001f is exactly what lint's
 * no-control-regex refuses, and it is right to. Those characters are invisible
 * in a diff and in most editors, so a class that matched one more or one fewer
 * than intended would read identically. The comparison below is a number a
 * reader can check.
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
 * The fields of a record this builder reads. Spelled out rather than typed as
 * `object`, for the reason `article-json-ld.mjs` states at its own copy:
 * `checkJs` is on and an `object` parameter makes every property access an
 * error, and spelling the shape here rather than importing `Publication` keeps
 * this module `.mjs` and importable by the build scripts without dragging a
 * `.ts` type graph behind it.
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
 * The markdown twin of one paper.
 *
 * PURE. No clock, no filesystem, no network: every input is passed in, so the
 * same corpus produces the same bytes on every machine. `check:machine-readable`
 * regenerates all 36 and compares them byte for byte against what is on disk,
 * which is only a meaningful comparison because of that.
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
  /*
   * DECODED HERE, like the page and the exports.
   *
   * Six character references survive into the stored corpus on purpose:
   * `check:machine-readable` asserts no stored abstract contains a left angle
   * bracket, which is what keeps a registry string safe inside the JSON-LD
   * block and the CSL export. `entities.mjs` carries the full argument and
   * names this file as one of the boundaries where text becomes something a
   * reader reads. A twin carrying `p &lt; 0.05` would be handing an agent the
   * markup instead of the sentence.
   */
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
    /*
     * THE COUNT COMES FROM THE COMMITTED ARTIFACT, not from the live KV value
     * the page renders. Two reasons and both matter. This file is generated at
     * build, so a live count would have to be fetched at build, which puts a
     * third-party round trip in a step that is otherwise a pure function of the
     * repository. And a number without a date is a claim with no age: the
     * artifact carries the date it was read, so the twin can carry both. Rule
     * 17's exception for dated evidence.
     */
    /*
     * THE DEPOSITS, because the twin is the record and this is part of it. An
     * agent asked what data backs a paper should not have to fetch the PDF and
     * find the data-availability statement itself, which is the reading
     * `accessions.mjs` already did once at build.
     *
     * Absent rather than empty for a paper with none: an empty list invites a
     * reader to conclude the paper deposited nothing, when what happened is
     * that its journal required no statement.
     */
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

  /*
   * THE FULL TEXT, and the sentence above it is not decoration.
   *
   * Without it a reader has no way to tell this text from the abstract's
   * provenance, which is a registry deposit and is authoritative. This is a
   * machine reading of a PDF, and the difference decides whether a quotation
   * taken from it can be trusted. Ruling 63 asked for the text; saying what it
   * is costs one line.
   */
  if (pages !== null) {
    /*
     * C0 CONTROL CHARACTERS ARE STRIPPED HERE, AND ONLY HERE.
     *
     * MEASURED: 267 of them across 11 of the 36 twins, code points 1 through 8.
     * They come from PDFs whose symbol font is mapped to low code points, so
     * the prime in `5'-GCAGAGCATATAAAATGAGG` extracts as 0x03. They are not
     * text; they are what a glyph lookup produced when it had nowhere to go.
     *
     * This is the presentation boundary, which is where a repair like this
     * belongs. `extract-publication-text.mjs` keeps the artifact faithful to
     * the PDF on purpose, so the bytes stay available to anything that wants
     * them; what a SERVED document should not contain is unprintable control
     * characters, which display as nothing, break XML consumers, and mean
     * nothing to a retrieval model.
     *
     * They cost something real before this: `check:secrets` matched three of
     * them in the artifact, because JSON escapes 0x03 as a backslash-u form and
     * a `u`, four digits, a hyphen and a long run of DNA is the shape of an
     * UptimeRobot key. That was a scanner reading an encoding, and it is fixed
     * in the scanner. This is the other half: the reader's copy.
     *
     * Tab and newline are kept, because those are text.
     */
    const text = pages
      .map((page) => stripControls(page).trim())
      .filter(Boolean)
      .join("\n\n");
    body.push("## Full text", "");
    if (text.length === 0) {
      /*
       * SAYS SO, rather than leaving a heading with nothing under it. A PDF
       * with no text layer (a scan) extracts to nothing, and an empty section
       * is indistinguishable from a build that half ran. `check:machine-readable`
       * reds before this can happen in practice, at a threshold of 500
       * characters, so this branch is the second line rather than the first.
       */
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
