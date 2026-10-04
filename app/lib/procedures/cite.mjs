// How a procedure version is addressed and cited: the address of its frozen copy, the citation line, the BibTeX
// entry and the metadata Zenodo takes for a deposit. All of it is derived from the record (its path, its version,
// its history and its title), never typed, so a version bumped in the file changes every place that cites it.
//
// A procedure with no version cannot be cited: protocols.md mints a DOI only for a version that is being cited, so
// there is nothing to cite until one has been assigned. The DOI of a version is written once, on that version's
// entry in `history`, after Zenodo has minted it; this module never invents one.
//
// A cited version is a frozen copy (drizzle/0027_procedure_versions.sql), so a citation and a printed sheet's QR
// code point at `<page>/v/<version>`, which never changes, and not at the page, which moves on to the next version.

import { METHODS } from "./taxonomy.mjs";

/**
 * @typedef {{ name: string, affiliation: string }} Creator
 * @typedef {{ version: string, date: string, doi: string | null }} CiteFacts
 */

/** The shape Zenodo's DOIs and DataCite's share: the registrant prefix, a slash, the suffix. */
export const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

/** A version that can sit in a URL and a file name: letters, digits, dots, hyphens and underscores. */
export const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * The path of a version's frozen copy. The newest version also answers here, so a citation made today still
 * resolves to the same words when the page has moved on.
 *
 * @param {string} path the procedure's own path
 * @param {string} version
 */
export function versionPath(path, version) {
  return `${path}/v/${encodeURIComponent(version)}`;
}

/**
 * Whether saving this record freezes a copy: a published procedure with an assigned version. A draft is never
 * frozen, and a procedure with no version has no version to freeze.
 *
 * @param {{ draft: boolean, version: string | null }} record
 */
export function needsFreeze(record) {
  return !record.draft && record.version !== null && record.version !== "";
}

/**
 * What a citation of the record's current version needs, or null when it has no version or no date to cite.
 * The date is the one the history gives the version, else the date the page was last updated.
 *
 * @param {{ version: string | null, updated: string | null, history?: Array<{ version: string, date: string, doi: string | null }> }} record
 * @returns {CiteFacts | null}
 */
export function citeFacts(record) {
  if (!record.version) return null;
  const entry = record.history?.find((h) => h.version === String(record.version));
  const date = entry?.date ?? record.updated;
  if (!date) return null;
  return { version: String(record.version), date, doi: entry?.doi ?? null };
}

/**
 * "Dustin Edwards" as the family name and the given name. For a name written given-first, as the CV writes
 * the owner's; the last word is the family name.
 *
 * @param {string} name
 */
export function familyGiven(name) {
  const words = name.trim().split(/\s+/);
  const family = words.pop() ?? "";
  return { family, given: words.join(" ") };
}

/** @param {string} given */
const initials = (given) =>
  given
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w.charAt(0).toUpperCase()}.`)
    .join(" ");

/**
 * The address a citation points at: the version's DOI when it has one, else its frozen copy.
 *
 * @param {{ path: string }} record
 * @param {CiteFacts} facts
 * @param {string} origin
 */
const target = (record, facts, origin) => (facts.doi ? `https://doi.org/${facts.doi}` : `${origin}${versionPath(record.path, facts.version)}`);

/**
 * @param {{ title: string, path: string }} record
 * @param {CiteFacts} facts
 * @param {{ origin: string, creator: Creator }} where
 */
export function citationText(record, facts, { origin, creator }) {
  const { family, given } = familyGiven(creator.name);
  const host = new URL(origin).host;
  return `${family}, ${initials(given)} (${facts.date.slice(0, 4)}). ${record.title} (Version ${facts.version}) [Laboratory protocol]. ${host}. ${target(record, facts, origin)}`;
}

/**
 * @param {{ slug: string, title: string, path: string }} record
 * @param {CiteFacts} facts
 * @param {{ origin: string, creator: Creator }} where
 */
export function bibtex(record, facts, { origin, creator }) {
  const { family, given } = familyGiven(creator.name);
  const year = facts.date.slice(0, 4);
  const field = (/** @type {string} */ name, /** @type {string} */ value) => `  ${name} = {${value.replace(/[{}]/g, "")}},`;
  return [
    `@misc{${family.toLowerCase()}${year}${record.slug}v${facts.version.replace(/[^A-Za-z0-9.]/g, "")},`,
    field("author", `${family}, ${given}`),
    field("title", record.title),
    field("year", year),
    field("version", facts.version),
    field("howpublished", "Laboratory protocol"),
    ...(facts.doi ? [field("doi", facts.doi)] : []),
    field("url", target(record, facts, origin)),
    "}",
  ].join("\n");
}

/**
 * The metadata for depositing this version on Zenodo (its `.zenodo.json` or its upload form). No `doi` is
 * written: Zenodo mints it, and the maintainer then records it on the version's `history` entry. Earlier
 * versions that already have a DOI are linked as the ones this supersedes. The license is left out: it is
 * Dustin's to choose, and Zenodo asks for it at upload.
 *
 * @param {{ title: string, description: string, path: string, methods: string[], basedOn: Array<{ doi: string | null }>, history?: Array<{ version: string, date: string, doi: string | null }> }} record
 * @param {CiteFacts} facts
 * @param {{ origin: string, creator: Creator }} where
 */
export function zenodoMetadata(record, facts, { origin, creator }) {
  const { family, given } = familyGiven(creator.name);
  const history = record.history ?? [];
  const here = history.findIndex((h) => h.version === facts.version);
  const previous = here >= 0 ? history.slice(here + 1).find((h) => h.doi) : undefined;
  return {
    upload_type: "publication",
    publication_type: "other",
    title: `${record.title} (Version ${facts.version})`,
    description: record.description,
    version: facts.version,
    publication_date: facts.date,
    creators: [{ name: `${family}, ${given}`, affiliation: creator.affiliation }],
    access_right: "open",
    keywords: record.methods.map((id) => /** @type {Record<string, string>} */ (METHODS)[id] ?? id),
    related_identifiers: [
      { identifier: `${origin}${versionPath(record.path, facts.version)}`, relation: "isAlternateIdentifier", scheme: "url" },
      ...(previous?.doi ? [{ identifier: previous.doi, relation: "isNewVersionOf", scheme: "doi" }] : []),
      ...record.basedOn.filter((s) => s.doi).map((s) => ({ identifier: /** @type {string} */ (s.doi), relation: "isDerivedFrom", scheme: "doi" })),
    ],
  };
}
