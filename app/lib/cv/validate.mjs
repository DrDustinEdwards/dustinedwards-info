// The one validation module for the CV (docs/CV.md). CI (build:content, test/cv.test.mjs), sync:content and the
// CV save all call it, so a file CI passes is the file a save accepts. It holds a file to its shape, to the
// privacy rules, to the house style (no wide dash) and, once the files are joined to the publications, to the
// rules that need the whole CV: a cited paper exists and lists Dustin, and each section reads newest first.
// Pure: no Env, no filesystem, no clock beyond the year bound below.

import matter from "gray-matter";

import { findWideDashes } from "../content/wide-dash.mjs";
import { canonicalAuthor } from "../publications/authors.mjs";
import { AREAS, ROLES } from "./view.mjs";

const AREA_IDS = new Set(AREAS.map(([id]) => /** @type {string} */ (id)));
const ROLE_IDS = new Set(ROLES.map(([id]) => /** @type {string} */ (id)));

/** The owner, whom every paper the CV claims must list (as the CV's role for it is read from the author list). */
export const OWNER = "Dustin Edwards";

/** The edition stamp the CV prints: a season and a year, as "Fall 2026". */
export const EDITION_PATTERN = /^(Spring|Summer|Fall|Winter) (\d{4})$/;

/** Entries are dated between these years, so a typo such as 2205 is refused rather than charted. */
export const YEAR_MIN = 1950;
export const YEAR_MAX = 2100;

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;
const HTTPS = /^https:\/\/\S+$/;

/** The sections an appointment or a service line sits under, in the order the CV prints them. */
export const APPOINTMENT_SECTIONS = ["Positions", "Administrative and leadership"];
export const SERVICE_SECTIONS = [
  "Department",
  "College",
  "University",
  "Professional",
  "Community",
  "Compensated professional consulting",
  "Professional memberships",
];

/**
 * What no CV line may carry (the privacy rules): an email, a phone number, a room, a private community group.
 * Read from the values, so a comment explaining the rule cannot trip it.
 */
const PRIVACY = /** @type {const} */ ([
  [/@[a-z0-9-]+\.[a-z]{2,}/i, "an email address"],
  [/\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/, "a phone number"],
  [/\bRoom\b|\bSuite\b|\bOffice \d/i, "a room"],
  [/Mountains Lake/i, "a private community group"],
]);

/**
 * A field's kind, for one entry type: `s` a non-empty string, `n` a non-negative integer, `money` US dollars to the cent, `b` a boolean, and
 * a trailing `?` makes it optional. The shared fields (year, endYear, areas, role, links) are checked apart.
 */
const SHAPES = /** @type {const} */ ({
  appointment: { section: "s", title: "s", org: "s", detail: "s?", duties: "duties?" },
  education: { title: "s", org: "s", detail: "s?" },
  grant: { amount: "money", title: "s", funder: "s?", note: "s?" },
  award: { title: "s", org: "s?", place: "s?" },
  talk: { title: "s", presenters: "strings", venue: "s" },
  course: { code: "s", title: "s", org: "s", term: "s" },
  mentoring: { section: "s", count: "n", unit: "unit", level: "s", program: "s", org: "s", detail: "s?", cohort: "b" },
  service: { section: "s", title: "s", org: "s?", place: "s?" },
  development: { title: "s", org: "s?", place: "s?" },
});

/** The inline paper (one the site has no record for) states its own citation. */
const INLINE_PAPER = /** @type {const} */ ({
  title: "s",
  authors: "strings",
  journal: "s",
  volume: "s?",
  issue: "s?",
  pages: "s?",
});

const SHARED_KEYS = ["year", "endYear", "areas", "role", "links"];

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** @param {unknown} value */
const isText = (value) => typeof value === "string" && value.length > 0 && value === value.trim();

/** @param {unknown} value @returns {value is number} */
const isCount = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0;

/**
 * @param {unknown} value
 * @param {string} kind
 * @returns {string | null} a reason, or null when the value fits
 */
function misfit(value, kind) {
  const optional = kind.endsWith("?");
  const base = optional ? kind.slice(0, -1) : kind;
  if (value === undefined) return optional ? null : "is missing";
  switch (base) {
    case "s":
      return isText(value) ? null : "must be non-empty text with no space at either end";
    case "n":
      return isCount(value) ? null : "must be a whole number, zero or more";
    case "money":
      return typeof value === "number" && Number.isFinite(value) && value >= 0 && Math.round(value * 100) === value * 100
        ? null
        : "must be dollars, zero or more, to the cent";
    case "b":
      return typeof value === "boolean" ? null : "must be true or false";
    case "strings":
      return Array.isArray(value) && value.length > 0 && value.every(isText) ? null : "must be a non-empty list of text";
    case "unit":
      return value === "students" || value === "awards" ? null : 'must be "students" or "awards"';
    case "duties":
      return Array.isArray(value) &&
        value.length > 0 &&
        value.every(
          (duty) =>
            isRecord(duty) &&
            Object.keys(duty).every((key) => key === "heading" || key === "items") &&
            isText(duty.heading) &&
            Array.isArray(duty.items) &&
            duty.items.length > 0 &&
            duty.items.every(isText),
        )
        ? null
        : "must be a non-empty list of { heading, items } with items a non-empty list of text";
    default:
      throw new Error(`cv validate: unknown field kind ${kind}`);
  }
}

/**
 * @param {Record<string, unknown>} entry
 * @param {Record<string, string>} shape
 * @param {string} where
 * @param {string[]} errors
 */
function checkShape(entry, shape, where, errors) {
  for (const [key, kind] of Object.entries(shape)) {
    const reason = misfit(entry[key], kind);
    if (reason) errors.push(`${where}: ${key} ${reason}`);
  }
}

/**
 * The fields every dated entry carries, and the keys it may not.
 *
 * @param {Record<string, unknown>} entry
 * @param {string} where
 * @param {string[]} errors
 */
function checkShared(entry, where, errors) {
  const { year, endYear, areas, role, links } = entry;
  const yearOk = year === null || (typeof year === "number" && Number.isInteger(year) && year >= YEAR_MIN && year <= YEAR_MAX);
  if (!yearOk) errors.push(`${where}: year must be a whole year from ${YEAR_MIN} to ${YEAR_MAX}, or null for an undated line`);
  if (endYear !== undefined) {
    if (year === null) errors.push(`${where}: an undated line (year: null) has no endYear`);
    else if (endYear !== "present" && !(typeof endYear === "number" && Number.isInteger(endYear) && endYear <= YEAR_MAX)) {
      errors.push(`${where}: endYear must be a whole year or "present"`);
    } else if (typeof endYear === "number" && typeof year === "number" && endYear < year) {
      errors.push(`${where}: endYear ${endYear} is before year ${year}`);
    }
  }
  if (!Array.isArray(areas) || !areas.every((a) => typeof a === "string" && AREA_IDS.has(a))) {
    errors.push(`${where}: areas must be a list (empty is allowed) of ${[...AREA_IDS].join(", ")}`);
  } else if (new Set(areas).size !== areas.length) {
    errors.push(`${where}: areas names one area twice`);
  }
  if (role !== null && !(typeof role === "string" && ROLE_IDS.has(role))) {
    errors.push(`${where}: role must be null or one of ${[...ROLE_IDS].join(", ")}`);
  }
  if (links !== undefined) {
    const linksOk =
      Array.isArray(links) &&
      links.length > 0 &&
      links.every((l) => isRecord(l) && Object.keys(l).length === 2 && isText(l.label) && typeof l.href === "string" && HTTPS.test(l.href));
    if (!linksOk) errors.push(`${where}: links must be a non-empty list of { label, href } with an https href`);
  }
}

/**
 * One entry of a section file, held to its type's shape.
 *
 * @param {import("./types.ts").CvType} type
 * @param {unknown} entry
 * @param {string} where
 * @param {string[]} errors
 */
function checkEntry(type, entry, where, errors) {
  if (!isRecord(entry)) {
    errors.push(`${where}: an entry is a mapping of fields`);
    return;
  }
  if ("type" in entry) errors.push(`${where}: an entry does not state its type; the file's front matter does`);

  if (type === "publication" && "doi" in entry) {
    for (const key of Object.keys(entry)) {
      if (key !== "doi") {
        errors.push(`${where}: a paper named by DOI states nothing else (${key}); its facts come from content/publications/`);
      }
    }
    if (typeof entry.doi !== "string" || !DOI_PATTERN.test(entry.doi)) errors.push(`${where}: doi is not a DOI`);
    return;
  }

  /** @type {Record<string, string>} */
  const shape = type === "publication" ? INLINE_PAPER : SHAPES[/** @type {Exclude<typeof type, "publication">} */ (type)];
  checkShape(entry, shape, where, errors);
  checkShared(entry, where, errors);
  const known = new Set([...Object.keys(shape), ...SHARED_KEYS]);
  for (const key of Object.keys(entry)) {
    if (!known.has(key)) errors.push(`${where}: "${key}" is not a field of a ${type} entry`);
  }
  if (type === "appointment" && !APPOINTMENT_SECTIONS.includes(/** @type {string} */ (entry.section))) {
    errors.push(`${where}: section must be one of ${APPOINTMENT_SECTIONS.join(", ")}`);
  }
  if (type === "service" && !SERVICE_SECTIONS.includes(/** @type {string} */ (entry.section))) {
    errors.push(`${where}: section must be one of ${SERVICE_SECTIONS.join(", ")}`);
  }
}

/**
 * The profile: the edition stamp, the person and the presentation totals.
 *
 * @param {Record<string, unknown>} data
 * @param {string[]} errors
 */
function checkProfile(data, errors) {
  const { edition, person, presentations } = data;
  for (const key of Object.keys(data)) {
    if (!["edition", "person", "presentations"].includes(key)) errors.push(`profile: "${key}" is not a field of the profile`);
  }
  if (typeof edition !== "string" || !EDITION_PATTERN.test(edition)) {
    errors.push('edition must be a season and a year, such as "Fall 2026"');
  }
  if (!isRecord(person)) {
    errors.push("person must be a mapping of name, degree, title, department and org");
  } else {
    for (const key of ["name", "degree", "title", "department", "org"]) {
      if (!isText(person[key])) errors.push(`person.${key} must be non-empty text with no space at either end`);
    }
    for (const key of Object.keys(person)) {
      if (!["name", "degree", "title", "department", "org"].includes(key)) errors.push(`person.${key} is not a field of the person`);
    }
    if (person.name !== OWNER) errors.push(`person.name is "${String(person.name)}", the site's one name for him is "${OWNER}"`);
  }
  if (!isRecord(presentations)) {
    errors.push("presentations must be a mapping of international, national, from and to");
  } else {
    for (const key of ["international", "national"]) {
      if (!isCount(presentations[key])) errors.push(`presentations.${key} must be a whole number, zero or more`);
    }
    for (const key of ["from", "to"]) {
      const value = presentations[key];
      if (!(typeof value === "number" && Number.isInteger(value) && value >= YEAR_MIN && value <= YEAR_MAX)) {
        errors.push(`presentations.${key} must be a whole year from ${YEAR_MIN} to ${YEAR_MAX}`);
      }
    }
    for (const key of Object.keys(presentations)) {
      if (!["international", "national", "from", "to"].includes(key)) errors.push(`presentations.${key} is not a field of the presentations`);
    }
    if (typeof presentations.from === "number" && typeof presentations.to === "number" && presentations.from > presentations.to) {
      errors.push("presentations.from is after presentations.to");
    }
  }
}

/**
 * Parses and judges one CV file.
 *
 * @param {{ slug: string, type: import("./types.ts").CvType | "profile" }} file the registry's entry for it
 * @param {string} raw the whole file, front matter included
 * @returns {{ ok: false, errors: string[] } | { ok: true, errors: [], record: import("./types.ts").CvFileRecord }}
 */
export function parseCvFile(file, raw) {
  /** @type {string[]} */
  const errors = [];
  for (const hit of findWideDashes(raw)) {
    errors.push(`line ${hit.line}, column ${hit.column}: wide dash ${hit.char}; house style uses commas, periods, parentheses or colons ("${hit.excerpt}")`);
  }
  let parsed;
  try {
    parsed = matter(raw);
  } catch (error) {
    return { ok: false, errors: [...errors, `the front matter is not valid YAML: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const data = /** @type {Record<string, unknown>} */ (parsed.data);
  if (parsed.content.trim() !== "") errors.push("the file has text after its front matter, which no page shows; the CV is the front matter alone");

  const { slug, type } = file;
  if (type === "profile") {
    checkProfile(data, errors);
  } else {
    for (const key of Object.keys(data)) {
      if (key !== "type" && key !== "entries") errors.push(`"${key}" is not a field of a section file (type, entries)`);
    }
    if (data.type !== type) errors.push(`type is ${JSON.stringify(data.type)}, but ${slug} holds ${type} entries`);
    if (!Array.isArray(data.entries) || data.entries.length === 0) {
      errors.push("entries must be a non-empty list");
    } else {
      data.entries.forEach((entry, i) => checkEntry(type, entry, `entries[${i}]`, errors));
    }
  }

  // The privacy rules read the values, not the comments: JSON of what the file states.
  const values = JSON.stringify(data);
  for (const [pattern, what] of PRIVACY) {
    if (pattern.test(values)) errors.push(`the file carries ${what}; the CV never does`);
  }
  if (errors.length > 0) return { ok: false, errors };

  /** @type {import("./types.ts").CvFileRecord} */
  const record =
    type === "profile"
      ? {
          slug: "profile",
          type: "profile",
          edition: /** @type {string} */ (data.edition),
          person: /** @type {import("./types.ts").CvPerson} */ (data.person),
          presentations: /** @type {import("./types.ts").CvPresentations} */ (data.presentations),
        }
      : {
          slug,
          type,
          // The file states the type once; each entry carries it from here on.
          entries: /** @type {Array<Record<string, unknown>>} */ (data.entries).map(
            (e) => /** @type {import("./types.ts").CvSourceEntry} */ ({ type, ...e }),
          ),
        };
  return { ok: true, errors: [], record };
}

/**
 * The paper references against the publication records: each DOI exists as a published paper, appears once,
 * and the paper lists the owner among its authors (the CV cannot claim a paper he did not write).
 *
 * @param {import("./types.ts").CvSourceEntry[]} entries
 * @param {Map<string, import("../publications/types.ts").Publication>} byDoi the published records by lower-cased DOI
 * @returns {string[]}
 */
export function paperRefErrors(entries, byDoi) {
  /** @type {string[]} */
  const errors = [];
  const seen = new Set();
  for (const entry of entries) {
    if (entry.type !== "publication" || !("doi" in entry)) continue;
    const key = entry.doi.toLowerCase();
    if (seen.has(key)) errors.push(`DOI ${entry.doi} is listed twice`);
    seen.add(key);
    const paper = byDoi.get(key);
    if (!paper) {
      errors.push(`no published publication has DOI ${entry.doi}; add its file to content/publications/ first, and publish it`);
    } else if (!paper.authors.some((name) => canonicalAuthor(name) === OWNER)) {
      errors.push(`DOI ${entry.doi} does not list ${OWNER} among its authors, so the CV cannot claim it`);
    }
  }
  return errors;
}

/**
 * The types whose sections read newest first, undated lines last, so the page, the twin and the PDF agree on
 * an order the twin states for grants. Service and mentoring lines keep the CV's own order within a section (a
 * committee is listed with its chair first, a cohort by program), so the rule does not reach them.
 */
export const NEWEST_FIRST_TYPES = [
  "appointment",
  "education",
  "publication",
  "grant",
  "award",
  "talk",
  "course",
  "development",
];

/**
 * Judged on the resolved entries, so a paper's year is the record's.
 *
 * @param {Array<{ id: string, type: string, section: string | null, year: number | null }>} entries
 * @returns {string[]}
 */
export function orderErrors(entries) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, { year: number | null, id: string }>} */
  const last = new Map();
  for (const e of entries) {
    if (!NEWEST_FIRST_TYPES.includes(e.type)) continue;
    const key = `${e.type}/${e.section ?? ""}`;
    const before = last.get(key);
    if (before) {
      if (before.year === null && e.year !== null) {
        errors.push(`${e.id} is dated ${e.year} but follows the undated ${before.id}; undated lines come last in their section`);
      } else if (before.year !== null && e.year !== null && e.year > before.year) {
        errors.push(`${e.id} (${e.year}) follows ${before.id} (${before.year}); each section reads newest first`);
      }
    }
    last.set(key, { year: e.year, id: e.id });
  }
  return errors;
}
