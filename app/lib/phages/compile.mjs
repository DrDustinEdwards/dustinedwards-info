// The one door from a phage file to the row the phage table on /research/phages is drawn from (docs/PHAGES.md):
// parse, validate, hash, and the markdown a row becomes. build:content, sync:content, the gates and the adapter's
// phage save all call compilePhage, and the page compile (app/lib/pages/compile.mjs) calls expandPhagePage with
// the rows, so a file CI passes is the file the save accepts and the page draws. Pure and dependency-light, so
// the Worker and the Node scripts import the same module.
//
// A phage is ONE record: the row's fields (name, year, host, county, notes) and the PhagesDB link fields that
// used to be a second table in code (PHAGESDB_RECORDS). The validator REFUSES any other field, so nothing a
// visitor cannot already read in the table can enter the repository or D1: no sample, location beyond the county
// the table shows, or personal data.

import matter from "gray-matter";

import { gitBlobSha } from "../content/hashes.mjs";
import { foldText } from "../cv/view.mjs";
import { phagesDbUrl } from "../phage-table.mjs";

export const PHAGES_DIR = "content/phages";

/** The repository path of a phage's file, from its file key (the name in lower case). */
export function phagePath(/** @type {string} */ slug) {
  return `${PHAGES_DIR}/${slug}.md`;
}

/** The one page the table and the sections are drawn into. */
export const PHAGES_PAGE_PATH = "/research/phages";

/**
 * Where the page file says the generated markdown goes. Each stands alone on its line in the page's file, and the
 * page compile replaces it BEFORE rendering, so the HTML, the twin, the table of contents, the dataset facts and
 * the search record all come from one text. The page's prose, its headings and the table's caption stay in the
 * page file.
 */
export const TABLE_MARKER = "<!-- phages:table -->";
export const SECTIONS_MARKER = "<!-- phages:sections -->";

/** The two hosts the table names, as the table's cell and a section's line write them. A new host is code. */
export const HOSTS = Object.freeze({
  smegmatis: { short: "*M. smegmatis* mc²155", long: "*Mycobacterium smegmatis* mc²155" },
  foliorum: { short: "*M. foliorum*", long: "*Microbacterium foliorum*" },
});

/** The table's columns, in order: the header the page has always had. */
export const TABLE_HEADER = "| Phage | Year | Host | County | PhagesDB | Paper |\n|---|---|---|---|---|---|";

const STATE = "Texas";
const FIELDS = ["name", "year", "host", "county", "phagesdb", "paper", "formerly", "note"];
const REQUIRED = ["name", "year", "host", "county", "phagesdb"];

/** A phage's name: letters and digits, so its lower-case form is the file key, the heading id and the old address. */
export const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const SLUG_PATTERN = /^[a-z][a-z0-9]*$/;
/** A PhagesDB record name, as the PhagesDB address spells it. */
const PHAGESDB_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const PAPER_PATTERN = /^[0-9a-z][0-9a-z-]*$/;
const COUNTY_PATTERN = /^(?:Texas|[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)* County)$/;
/** A note is a plain sentence: no character that markdown would read as a link, a table cell or emphasis. */
const NOTE_PATTERN = /^[A-Z][A-Za-z0-9 ,.'()%:;-]*\.$/;
const NOTE_MAX = 160;

/**
 * @typedef {"smegmatis" | "foliorum"} HostKey
 * @typedef {{
 *   name: string, year: number, host: HostKey | null, county: string | null, phagesdb: string | null,
 *   paper: string | null, formerly: string | null, note: string | null,
 * }} Phage
 * @typedef {{ paper: (slug: string) => Promise<boolean> }} PhageHost
 * `findWideDashes` is injected, as the page compile injects the pipeline's: the Worker loads it lazily.
 * @typedef {{ findWideDashes: (text: string) => Array<{ line: number, column: number, char: string, excerpt: string }> }} PhagePipeline
 */

/** The file key of a phage: its name in lower case, which is also its heading's id on the page. */
export function phageSlug(/** @type {string} */ name) {
  return name.toLowerCase();
}

/** The page's own order: year, then name, folded so case and accents do not matter. */
export function sortPhages(/** @type {Phage[]} */ phages) {
  return [...phages].sort(
    (a, b) => a.year - b.year || foldText(a.name).localeCompare(foldText(b.name), "en", { numeric: true }),
  );
}

/** @param {unknown} value @param {RegExp} pattern @returns {value is string} */
const matches = (value, pattern) => typeof value === "string" && pattern.test(value);

/**
 * Judges one file and, when it passes, builds the phage. Every message the file has is returned, never the
 * first alone, so a writer fixes all of them at once.
 *
 * @param {{ slug: string, raw: string, host: PhageHost, pipeline: PhagePipeline, sourcePath?: string }} input
 * @returns {Promise<
 *   | { ok: false, errors: string[] }
 *   | { ok: true, errors: [], phage: Phage, record: string, sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compilePhage({ slug, raw, host, pipeline, sourcePath }) {
  /** @type {string[]} */
  const errors = pipeline
    .findWideDashes(raw)
    .map((hit) => `line ${hit.line}, column ${hit.column}: wide dash ${hit.char}; house style uses commas, periods, parentheses or colons ("${hit.excerpt}")`);
  if (!raw.startsWith("---")) errors.push("the file must start with a --- front matter block");

  let parsed;
  try {
    // An options object, even an empty one: gray-matter caches by input when it is omitted.
    parsed = matter(raw, {});
  } catch (error) {
    return { ok: false, errors: [...errors, `the front matter is not valid YAML: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`] };
  }
  const data = parsed.data;
  if (parsed.content.trim() !== "") errors.push("the body must be empty: a phage is its front matter and nothing else");
  for (const key of Object.keys(data)) {
    if (!FIELDS.includes(key)) {
      errors.push(`${key} is not a phage field; a phage carries ${FIELDS.join(", ")} and nothing else (no samples, locations beyond the county, or other personal data)`);
    }
  }
  for (const key of REQUIRED) {
    if (data[key] === undefined) errors.push(`${key} is required${key === "name" || key === "year" ? "" : " (null where there is none)"}`);
  }

  const { name, year, host: hostKey, county, phagesdb, paper, formerly, note } = data;
  if (!matches(name, NAME_PATTERN)) errors.push(`name is ${JSON.stringify(name)}; it is the phage's name: letters and digits, starting with a letter`);
  else if (slug !== phageSlug(name)) errors.push(`name is ${name}, but the file is ${phagePath(slug)}: a phage's file is named for its name in lower case (${phageSlug(name)}.md)`);
  if (!SLUG_PATTERN.test(slug)) errors.push(`"${slug}" is not a phage file key; the file is the name in lower case, such as acorn15.md`);
  if (typeof year !== "number" || !Number.isInteger(year) || year < 2000 || year > 2099) {
    errors.push(`year is ${JSON.stringify(year)}; it is the year the phage was found, four digits`);
  }
  if (hostKey !== undefined && hostKey !== null && !Object.hasOwn(HOSTS, String(hostKey))) {
    errors.push(`host is ${JSON.stringify(hostKey)}; it is ${Object.keys(HOSTS).join(" or ")}, or null where no host is on record`);
  }
  if (county !== undefined && county !== null && !matches(county, COUNTY_PATTERN)) {
    errors.push(`county is ${JSON.stringify(county)}; it is a Texas county written "Erath County" (or "${STATE}" where only the state is on record), or null`);
  }
  if (phagesdb !== undefined && phagesdb !== null) {
    if (!matches(phagesdb, PHAGESDB_PATTERN)) {
      errors.push(`phagesdb is ${JSON.stringify(phagesdb)}; it is the PhagesDB record's name as PhagesDB spells it, or null where this phage has no verified record`);
    } else if (typeof name === "string" && phagesdb.toLowerCase() !== name.toLowerCase()) {
      errors.push(`phagesdb is ${phagesdb}, which is not ${name}'s record: a record is this phage's own, and a same-named phage of another lab is not it (set null)`);
    }
  }
  if (paper !== undefined && paper !== null) {
    if (!matches(paper, PAPER_PATTERN)) errors.push(`paper is ${JSON.stringify(paper)}; it is a publication's slug, such as 10-1128-mra-01242-18, or absent`);
    else if (!(await host.paper(paper))) errors.push(`paper ${paper} is not a publication of this site (/research/publications/${paper}/); the genome announcement is a paper the site holds`);
  }
  if (formerly !== undefined && formerly !== null && !matches(formerly, NAME_PATTERN)) {
    errors.push(`formerly is ${JSON.stringify(formerly)}; it is the phage's earlier name, letters and digits, or absent`);
  }
  if (note !== undefined && note !== null) {
    if (!matches(note, NOTE_PATTERN) || note.length > NOTE_MAX) {
      errors.push(`note is ${JSON.stringify(note)}; it is one plain sentence of at most ${NOTE_MAX} characters, starting with a capital and ending with a period, with no links or markdown`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  /** @type {Phage} */
  const phage = {
    name: /** @type {string} */ (name),
    year: /** @type {number} */ (year),
    host: /** @type {HostKey | null} */ (hostKey ?? null),
    county: /** @type {string | null} */ (county ?? null),
    phagesdb: /** @type {string | null} */ (phagesdb ?? null),
    paper: /** @type {string | null} */ (paper ?? null),
    formerly: /** @type {string | null} */ (formerly ?? null),
    note: /** @type {string | null} */ (note ?? null),
  };
  return {
    ok: true,
    errors: [],
    phage,
    record: JSON.stringify(phage),
    sourcePath: sourcePath ?? phagePath(slug),
    sourceBlobSha: await gitBlobSha(raw),
  };
}

/**
 * What only the whole set can say: the files are the table, so an empty set is a fault, two files cannot be one
 * phage, and two phages cannot claim one PhagesDB record.
 *
 * @param {Phage[]} phages
 * @returns {string[]}
 */
export function phageSetErrors(phages) {
  /** @type {string[]} */
  const errors = [];
  if (phages.length === 0) errors.push(`${PHAGES_DIR} holds no phage files; the table cannot be empty`);
  const names = new Set();
  const records = new Map();
  for (const { name, phagesdb } of phages) {
    if (names.has(phageSlug(name))) errors.push(`two files are the phage ${name}`);
    names.add(phageSlug(name));
    if (phagesdb !== null) {
      const key = phagesdb.toLowerCase();
      if (records.has(key)) errors.push(`${name} and ${records.get(key)} claim the same PhagesDB record, ${phagesdb}`);
      records.set(key, name);
    }
  }
  return errors;
}

/** The place a phage was found, as a section writes it after the year: ", Hood County, Texas", ", Texas" or "". */
function foundPlace(/** @type {Phage} */ { county }) {
  if (county === null) return "";
  return county === STATE ? `, ${STATE}` : `, ${county}, ${STATE}`;
}

/** One phage's row in the table, in the table's columns. */
export function phageTableRow(/** @type {Phage} */ phage) {
  const cells = [
    `[${phage.name}](#${phageSlug(phage.name)})`,
    String(phage.year),
    phage.host ? HOSTS[phage.host].short : "",
    phage.county ?? "",
    phage.phagesdb ? `[PhagesDB](${phagesDbUrl(phage.phagesdb)})` : "",
    phage.paper ? `[Paper](/research/publications/${phage.paper}/)` : "",
  ];
  return `| ${cells.join(" | ")} |`;
}

/** One phage's `###` section: what the row says in a sentence, and its links, as the page has always worded them. */
export function phageSection(/** @type {Phage} */ phage) {
  const found = `Found in ${phage.year}${foundPlace(phage)}.${phage.formerly ? ` Formerly named ${phage.formerly}.` : ""}`;
  const first = phage.host ? `Host: ${HOSTS[phage.host].long}. ${found}` : found;
  const links = [
    phage.phagesdb ? `[${phage.name} on PhagesDB](${phagesDbUrl(phage.phagesdb)}).` : "",
    phage.paper ? `[Genome announcement](/research/publications/${phage.paper}/).` : "",
    phage.note ?? "",
  ].filter(Boolean);
  return [`### ${phage.name}`, first, ...(links.length > 0 ? [links.join(" ")] : [])].join("\n\n");
}

/** The table's text: its header and one row per phage, in the page's order, no trailing newline. */
export function phageTableMarkdown(/** @type {Phage[]} */ phages) {
  return [TABLE_HEADER, ...sortPhages(phages).map(phageTableRow)].join("\n");
}

/** The sections' text: one per phage, in the page's order, no trailing newline. */
export function phageSectionsMarkdown(/** @type {Phage[]} */ phages) {
  return sortPhages(phages).map(phageSection).join("\n\n");
}

const markerLine = (/** @type {string} */ marker) => new RegExp(`^${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "gm");

/**
 * The text a page body is judged and rendered as. The phage page must carry each marker once, alone on its line,
 * and every other page must carry none: a marker left in prose would render as nothing and hide a missing table.
 *
 * @param {string} path the page's registered path
 * @param {string} body the page's markdown, front matter removed
 * @param {Phage[] | undefined} phages the rows to draw; required for the phage page
 * @returns {{ ok: false, errors: string[] } | { ok: true, markdown: string }}
 */
export function expandPhagePage(path, body, phages) {
  /** @type {string[]} */
  const errors = [];
  const markers = /** @type {const} */ ([
    [TABLE_MARKER, () => phageTableMarkdown(phages ?? [])],
    [SECTIONS_MARKER, () => phageSectionsMarkdown(phages ?? [])],
  ]);
  if (path !== PHAGES_PAGE_PATH) {
    for (const [marker] of markers) {
      if (body.includes(marker)) errors.push(`${marker} belongs on ${PHAGES_PAGE_PATH} only`);
    }
    return errors.length > 0 ? { ok: false, errors } : { ok: true, markdown: body };
  }
  if (!phages || phages.length === 0) {
    return { ok: false, errors: ["the phage table has no rows to draw: the phages table is empty. Run the content sync (npm run sync:content -- --remote), or sync_phages."] };
  }
  for (const [marker] of markers) {
    const alone = (body.match(markerLine(marker)) ?? []).length;
    const anywhere = body.split(marker).length - 1;
    if (alone !== 1 || anywhere !== 1) {
      errors.push(`the page must carry ${marker} exactly once, alone on its line (it has ${anywhere}); the phage rows are drawn there`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  let markdown = body;
  for (const [marker, draw] of markers) markdown = markdown.replace(markerLine(marker), () => draw());
  return { ok: true, markdown };
}
