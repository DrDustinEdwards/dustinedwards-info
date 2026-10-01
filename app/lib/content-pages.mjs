/**
 * The Research, Teaching and Software pages: markdown in content/pages/, rendered at build time into
 * content/generated/pages.json like the About page, and served by one route module. This list is the
 * one place their paths are named: app/routes.ts registers a route per entry, the sitemap lists each,
 * and the build refuses a markdown file whose path is not here or an entry with no file.
 *
 * The 2026-09-27 cutover wrote them from the old WordPress site, its knowledge base and the lab's
 * notebooks (cutover.md, "Pages to build before the switch").
 */

import { ogImageKey } from "./content/og-card-text.mjs";
import { dictionaryEntryFor, dictionaryEntryMarkdown, dictionaryEntryText } from "./dictionary-entries.mjs";
import { splitSections } from "./search/records.mjs";

export const CONTENT_PAGE_PATHS = /** @type {const} */ ([
  "/research",
  "/research/retroviruses",
  "/research/retroviruses/human",
  "/research/retroviruses/avian",
  "/research/bacteriophages",
  "/research/science-education",
  "/research/phages",
  // Not in cutover.md's page list, but its redirect rows land old knowledge-base addresses here.
  "/research/protocols",
  // The protocols themselves are procedures (content/procedures/, docs/PROCEDURES.md), drawn from D1.
  // The phage lab calculators (job_c2b88d76b3c1). Their addresses are fixed: the citable version
  // (Zenodo DOI, JMBE) replaces them in place, so none of these may move.
  "/research/tools",
  "/research/tools/titer",
  "/research/tools/dilution",
  "/research/tools/webbed-plate",
  "/research/tools/moi",
  "/research/tools/eop",
  "/research/tools/lysate-volume",
  "/teaching",
  "/teaching/phage-discovery",
  "/teaching/virus-isolation",
  "/teaching/virus-isolation/faq",
  "/teaching/phage-bioinformatics",
  "/teaching/central-dogma",
  "/teaching/study-skills",
  "/software",
  "/software/foxhound",
  "/software/foxing",
  "/software/foxing-edu",
  "/software/germomics",
  "/software/capsid",
  "/software/enarratio",
  "/software/carrel",
  // The CV. Its markdown is written from app/data/cv.ts, not kept in content/pages/ (see below).
  "/cv",
]);

/**
 * The listed pages whose markdown is GENERATED from structured data rather than read from
 * content/pages/: build:content renders it from app/lib/cv/markdown.mjs, so the twin, sitemap, search
 * records and llms.txt treat /cv like every other page. Their HTML comes from their own route
 * (app/routes/cv.tsx), so pages.json leaves them out.
 *
 * @type {readonly string[]}
 */
export const CONTENT_PAGES_FROM_DATA = ["/cv"];

/**
 * The headings on these pages that the header menus link to by anchor, as `path#id`. A menu shows a
 * section link only once it is listed here, and the build refuses an entry whose page has no heading
 * with that id, so no menu link lands on the top of a page for want of its heading.
 *
 * @type {readonly string[]}
 */
export const CONTENT_PAGE_SECTIONS = ["/teaching#join-the-lab", "/teaching#teaching-philosophy"];

/**
 * The markdown file a path is written in: slashes to hyphens, `/research/phages` in research-phages.md.
 *
 * @param {string} path
 */
export function contentPageFile(path) {
  return `${path.slice(1).replaceAll("/", "-")}.md`;
}

/**
 * The markdown twin's URL: the page path plus `.md`. Not `contentPageFile`, which is the repo filename.
 *
 * @param {string} path
 */
export function contentPageMarkdownPath(path) {
  return `${path}.md`;
}

/**
 * The twin a machine reads. The HTML page's h1 is not in the source body, so the title is the first line,
 * followed by the page's dictionary entry where it has one, where the page shows it.
 *
 * @param {{ path?: string, title: string, markdown: string }} page
 */
export function contentPageMarkdownBody(page) {
  const body = String(page.markdown ?? "").replace(/^\n+/, "");
  const entry = page.path ? dictionaryEntryFor(page.path) : undefined;
  const lead = entry ? `${dictionaryEntryMarkdown(entry)}\n` : "";
  return `# ${page.title}\n\n${lead}${body}`;
}

/**
 * The pages build:og draws a social card of their own, by the root they sit under: the root and every
 * page below it, so a calculator added under /research/tools is carded with no edit here. Every other
 * page keeps the site card. Adding a root cards its pages on the next build:og.
 *
 * @type {readonly string[]}
 */
export const CARDED_PAGE_ROOTS = ["/software", "/research/tools", "/cv"];

/** @param {string} path */
export function hasPageCard(path) {
  return CARDED_PAGE_ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
}

/**
 * What build:og draws for a page, in the shape ogImageKey hashes: the page's og:title (its SERP title)
 * and its description, with no date line, since these pages are not dated. The `page-` prefix keeps a
 * page's key apart from a post's, and build:og refuses two cards with one key.
 *
 * @param {{ path: string, seoTitle: string, description: string }} page
 */
export function contentPageCardInput(page) {
  return {
    slug: `page-${page.path.slice(1).replaceAll("/", "-")}`,
    title: page.seoTitle,
    description: page.description,
    publishAt: null,
  };
}

/**
 * The /media path of a page's card, which its og:image names, or null for a page on the site card. The
 * key hashes what the card draws, so a retitled page names a new card, which build:og then draws.
 *
 * @param {{ path: string, seoTitle: string, description: string }} page
 * @returns {string | null}
 */
export function contentPageCardPath(page) {
  return hasPageCard(page.path) ? `/media/${ogImageKey(contentPageCardInput(page))}` : null;
}

/**
 * What a Dataset node says about a page's first markdown table, read from the markdown the page renders:
 * its column headings, as the variables, and the span of its Year column, as an ISO 8601 interval. Null
 * when the page has no table.
 *
 * @param {string} markdown
 * @returns {{ variableMeasured: string[], temporalCoverage: string | null, rows: number } | null}
 */
export function markdownTableFacts(markdown) {
  const lines = String(markdown ?? "").split("\n");
  const rule = /^\|(\s*:?-+:?\s*\|)+\s*$/;
  const at = lines.findIndex((line, i) => /^\|.*\|\s*$/.test(line) && rule.test(lines[i + 1] ?? ""));
  if (at < 0) return null;
  const cells = (/** @type {string} */ line) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
  const headings = cells(lines[at] ?? "");
  /** @type {string[][]} */
  const rows = [];
  for (let i = at + 2; i < lines.length && (lines[i] ?? "").startsWith("|"); i += 1) rows.push(cells(lines[i] ?? ""));
  const yearColumn = headings.findIndex((heading) => /^year$/i.test(heading));
  const years =
    yearColumn < 0
      ? []
      : rows.map((row) => Number(row[yearColumn])).filter((year) => Number.isInteger(year) && year > 0);
  const first = Math.min(...years);
  const last = Math.max(...years);
  const temporalCoverage = years.length === 0 ? null : first === last ? String(first) : `${first}/${last}`;
  return { variableMeasured: headings, temporalCoverage, rows: rows.length };
}

/**
 * Purification is a section of the isolation page, not its own URL, so the sequence is two pages.
 * @type {readonly string[]}
 */
export const PROTOCOL_SEQUENCE = [
  "/research/protocols/phage-isolation",
  "/research/protocols/phage-dna-extraction",
];

/**
 * @param {string} path
 * @returns {{ previous: string | null, next: string | null } | null}
 */
export function protocolNeighbors(path) {
  const index = PROTOCOL_SEQUENCE.indexOf(path);
  if (index < 0) return null;
  const previous = index > 0 ? PROTOCOL_SEQUENCE[index - 1] : null;
  const next = index < PROTOCOL_SEQUENCE.length - 1 ? PROTOCOL_SEQUENCE[index + 1] : null;
  return {
    previous: previous ?? null,
    next: next ?? null,
  };
}

/** Google clips near these; the build refuses longer ones rather than ship a clipped result. */
export const SEO_TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

/** The hubs, and the trail label each gives the pages under it. */
const HUBS = /** @type {const} */ ([
  ["/research", "Research"],
  ["/teaching", "Teaching"],
  ["/software", "Software"],
]);

/**
 * The trail above a page: its hub, the page it sits under when it is three deep (the course above its
 * FAQ), then the page itself. A hub stands alone.
 *
 * @param {{ path: string, title: string }} page
 * @param {(path: string) => string | undefined} [titleOf] the title of another listed page
 * @returns {Array<[string, string]>}
 */
export function contentPageTrail(page, titleOf = () => undefined) {
  const hub = HUBS.find(([path]) => page.path.startsWith(`${path}/`));
  if (!hub) return [[page.title, page.path]];
  const trail = /** @type {Array<[string, string]>} */ ([[hub[1], hub[0]]]);
  const parent = page.path.slice(0, page.path.lastIndexOf("/"));
  const parentTitle = parent !== hub[0] ? titleOf(parent) : undefined;
  if (parentTitle) trail.push([parentTitle, parent]);
  trail.push([page.title, page.path]);
  return trail;
}

/** The search uid of a page path: a removal needs it to find the page's records. */
export function contentPageSearchUid(/** @type {string} */ path) {
  return `page:${path.slice(1).replaceAll("/", ":")}`;
}

/**
 * Search inputs in the shape `recordsForPages` takes: one record for the page, one per heading, each
 * deep-linking to the heading's own anchor.
 *
 * @param {Array<{ path: string, title: string, description: string, markdown: string, toc: Array<{ depth: number, id: string, text: string }> }>} pages
 */
export function contentPageSearchInputs(pages) {
  return pages.map((page) => {
    const { intro, sections } = splitSections(page.markdown, page.toc);
    const entry = dictionaryEntryFor(page.path);
    return {
      url: page.path,
      uid: contentPageSearchUid(page.path),
      title: page.title,
      description: page.description,
      intro: entry ? `${dictionaryEntryText(entry)} ${intro}` : intro,
      sections: sections.map(({ anchor, title, body }) => ({ anchor, title, body })),
    };
  });
}
