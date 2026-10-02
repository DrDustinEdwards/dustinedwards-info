// The one door from a roster file to the cohort the site draws (docs/ROSTER.md): parse, validate, hash.
// build:content, sync:content, the gates and the adapter's roster save all call compileCohort, so a file CI
// passes is the file the save accepts and the pages draw. Pure and dependency-light, so the Worker and the
// Node scripts import the same module.
//
// The shape is the one app/data/phage-hunters.ts had and no wider: a year, a group photo that is a path
// under /phage-hunters/ with its measured size and its alt text, and the names. The validator REFUSES any
// other field, so nothing a visitor cannot already see on the roster page can enter the repository or D1.

import matter from "gray-matter";

import { gitBlobSha } from "../content/hashes.mjs";

export const ROSTER_DIR = "content/roster";

/** The repository path of a cohort's file, from its file key (the year). */
export function rosterPath(/** @type {string} */ slug) {
  return `${ROSTER_DIR}/${slug}.md`;
}

/**
 * Where the roster is drawn: the one page that carries it, and the heading id the old WordPress profile
 * paths and /phage-discovery land on (app/lib/path-moves.mjs, app/lib/wordpress-redirects.mjs). The route
 * places the roster by this constant, and test/roster.test.mjs holds it to the registered page paths, the
 * redirect target and the component's own heading id, so the three cannot drift apart.
 */
export const ROSTER_PAGE_PATH = "/teaching/phage-discovery";
export const ROSTER_ANCHOR = "roster";

/** The directory the cohort photographs are served from. They stay static assets, referenced by path. */
export const ROSTER_PHOTO_DIR = "/phage-hunters/";

const FIELDS = ["year", "photo", "researchers"];
const PHOTO_FIELDS = ["src", "width", "height", "alt"];
const PHOTO_SRC = /^\/phage-hunters\/[A-Za-z0-9._-]+\.webp$/;
const NAME_MAX = 80;
const ALT_MAX = 200;

/**
 * @typedef {{ src: string, width: number, height: number, alt: string }} CohortPhoto
 * @typedef {{ year: number, photo: CohortPhoto | null, researchers: string[] }} Cohort
 * @typedef {{ photo: (src: string) => Promise<boolean> }} RosterHost
 * `findWideDashes` is injected, as the page compile injects the pipeline's: the Worker loads it lazily.
 * @typedef {{ findWideDashes: (text: string) => Array<{ line: number, column: number, char: string, excerpt: string }> }} RosterPipeline
 */

/** Newest cohort first: the order the page lists them and the order the files are read in. */
export function sortCohorts(/** @type {Cohort[]} */ cohorts) {
  return [...cohorts].sort((a, b) => b.year - a.year);
}

/**
 * The home page's counts: counted, never typed. The names stay out of what the home page sends.
 *
 * @param {Cohort[]} cohorts
 * @returns {{ researchers: number, cohorts: number, since: number }}
 */
export function rosterFacts(cohorts) {
  if (cohorts.length === 0) throw new Error("the roster has no cohorts, so there is nothing to count");
  return {
    researchers: cohorts.reduce((n, c) => n + c.researchers.length, 0),
    cohorts: cohorts.length,
    since: Math.min(...cohorts.map((c) => c.year)),
  };
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** @param {unknown} value */
const isPositiveInteger = (value) => typeof value === "number" && Number.isInteger(value) && value > 0;

/**
 * @param {unknown} photo
 * @param {RosterHost} host
 * @returns {Promise<string[]>}
 */
async function photoErrors(photo, host) {
  if (!isRecord(photo)) return ["photo is a mapping (src, width, height, alt) or null"];
  /** @type {string[]} */
  const errors = [];
  for (const key of Object.keys(photo)) {
    if (!PHOTO_FIELDS.includes(key)) errors.push(`photo.${key} is not a roster field; a photo carries ${PHOTO_FIELDS.join(", ")} and nothing else`);
  }
  const { src, width, height, alt } = photo;
  if (typeof src !== "string" || !PHOTO_SRC.test(src)) {
    errors.push(`photo.src is ${JSON.stringify(src)}; it is a .webp path under ${ROSTER_PHOTO_DIR}, such as ${ROSTER_PHOTO_DIR}example.webp`);
  } else if (!(await host.photo(src))) {
    errors.push(`photo.src ${src} is not in the repository (public${src}); the photograph is a static asset and is not uploaded here`);
  }
  if (!isPositiveInteger(width)) errors.push(`photo.width is ${JSON.stringify(width)}; it is the photograph's real width in pixels`);
  if (!isPositiveInteger(height)) errors.push(`photo.height is ${JSON.stringify(height)}; it is the photograph's real height in pixels`);
  if (typeof alt !== "string" || alt.trim() === "") {
    errors.push("photo.alt is required: the photographs are content, and alt text that is empty fails WCAG");
  } else if (alt !== alt.trim() || alt.length > ALT_MAX) {
    errors.push(`photo.alt is padded or longer than ${ALT_MAX} characters`);
  }
  return errors;
}

/**
 * @param {unknown} researchers
 * @returns {string[]}
 */
function researcherErrors(researchers) {
  if (!Array.isArray(researchers)) return ["researchers is a list of names (an empty list renders as 'Roster to be added')"];
  /** @type {string[]} */
  const errors = [];
  const seen = new Set();
  researchers.forEach((name, i) => {
    const at = `researchers[${i}]`;
    if (typeof name !== "string" || name.trim() === "") {
      errors.push(`${at} is ${JSON.stringify(name)}; a name is a non-empty string`);
      return;
    }
    if (name !== name.trim() || /\s{2}|[\r\n\t]/.test(name)) errors.push(`${at} has stray whitespace; names are kept as given, on one line`);
    if (name.length > NAME_MAX) errors.push(`${at} is longer than ${NAME_MAX} characters`);
    if (seen.has(name)) errors.push(`${at} repeats a name already in this cohort`);
    seen.add(name);
  });
  return errors;
}

/**
 * Judges one file and, when it passes, builds the cohort. Every message the file has is returned, never the
 * first alone, so a writer fixes all of them at once.
 *
 * @param {{ slug: string, raw: string, host: RosterHost, pipeline: RosterPipeline, sourcePath?: string }} input
 * @returns {Promise<
 *   | { ok: false, errors: string[] }
 *   | { ok: true, errors: [], cohort: Cohort, record: string, sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compileCohort({ slug, raw, host, pipeline, sourcePath }) {
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
  if (parsed.content.trim() !== "") errors.push("the body must be empty: a cohort is its front matter and nothing else");
  for (const key of Object.keys(data)) {
    if (!FIELDS.includes(key)) {
      errors.push(`${key} is not a roster field; a cohort carries ${FIELDS.join(", ")} and nothing else (no contact details, locations or other personal data)`);
    }
  }

  const { year, photo, researchers } = data;
  if (typeof year !== "number" || !Number.isInteger(year) || year < 2000 || year > 2099) {
    errors.push(`year is ${JSON.stringify(year)}; it is the cohort's four-digit year`);
  } else if (slug !== String(year)) {
    errors.push(`year is ${year}, but the file is ${rosterPath(slug)}: a cohort's file is named for its year (${year}.md)`);
  }
  if (!/^\d{4}$/.test(slug)) errors.push(`"${slug}" is not a cohort file key; the file is named for the year, such as 2025.md`);

  if (photo === undefined) errors.push("photo is required (a mapping, or null for a cohort with no photograph)");
  else if (photo !== null) errors.push(...(await photoErrors(photo, host)));
  errors.push(...researcherErrors(researchers));
  if (errors.length > 0) return { ok: false, errors };

  /** @type {Cohort} */
  const cohort = {
    year: /** @type {number} */ (year),
    photo: photo === null ? null : (({ src, width, height, alt }) => ({ src, width, height, alt }))(/** @type {CohortPhoto} */ (photo)),
    researchers: /** @type {string[]} */ (researchers),
  };
  return {
    ok: true,
    errors: [],
    cohort,
    record: JSON.stringify(cohort),
    sourcePath: sourcePath ?? rosterPath(slug),
    sourceBlobSha: await gitBlobSha(raw),
  };
}

/**
 * What only the whole set can say: the files are the roster, so an empty set is a fault, and two files
 * cannot be one year.
 *
 * @param {Cohort[]} cohorts
 * @returns {string[]}
 */
export function rosterSetErrors(cohorts) {
  /** @type {string[]} */
  const errors = [];
  if (cohorts.length === 0) errors.push(`${ROSTER_DIR} holds no cohort files; the roster cannot be empty`);
  const years = new Set();
  for (const { year } of cohorts) {
    if (years.has(year)) errors.push(`two files are the ${year} cohort`);
    years.add(year);
  }
  return errors;
}
