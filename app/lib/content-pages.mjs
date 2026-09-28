/**
 * The Research, Teaching and Software pages: markdown in content/pages/, rendered at build time into
 * content/generated/pages.json like the About page, and served by one route module. This list is the
 * one place their paths are named: app/routes.ts registers a route per entry, the sitemap lists each,
 * and the build refuses a markdown file whose path is not here or an entry with no file.
 *
 * The 2026-09-27 cutover wrote them from the old WordPress site, its knowledge base and the lab's
 * notebooks (cutover.md, "Pages to build before the switch").
 */

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
  "/research/protocols/phage-isolation",
  "/research/protocols/phage-dna-extraction",
  "/research/protocols/coi-primers",
  "/research/protocols/rev-lpdv-primers",
  "/research/protocols/pan-avian-gapdh",
  // The phage lab calculators (job_c2b88d76b3c1). Their addresses are fixed: the citable version
  // (Zenodo DOI, JMBE) replaces them in place, so none of these may move.
  "/research/tools",
  "/research/tools/titer",
  "/research/tools/dilution",
  "/research/tools/webbed-plate",
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
  // The plain CV, from Dustin's current CV; the interactive CV replaces it later at the same address.
  "/cv",
]);

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
 * The twin a machine reads. The HTML page's h1 is not in the source body, so the title is the first line.
 *
 * @param {{ title: string, markdown: string }} page
 */
export function contentPageMarkdownBody(page) {
  const body = String(page.markdown ?? "").replace(/^\n+/, "");
  return `# ${page.title}\n\n${body}`;
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

/**
 * Search inputs in the shape `recordsForPages` takes: one record for the page, one per heading, each
 * deep-linking to the heading's own anchor.
 *
 * @param {Array<{ path: string, title: string, description: string, markdown: string, toc: Array<{ depth: number, id: string, text: string }> }>} pages
 */
export function contentPageSearchInputs(pages) {
  return pages.map((page) => {
    const { intro, sections } = splitSections(page.markdown, page.toc);
    return {
      url: page.path,
      uid: `page:${page.path.slice(1).replaceAll("/", ":")}`,
      title: page.title,
      description: page.description,
      intro,
      sections: sections.map(({ anchor, title, body }) => ({ anchor, title, body })),
    };
  });
}
