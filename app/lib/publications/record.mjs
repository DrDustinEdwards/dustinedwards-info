// The compiled record: what a publication file becomes once it is validated, in the shape every surface
// (the index, the paper page, the exports, search, the CV) reads. Derived values are derived here and
// nowhere else: the year from the date, the page range from `pages`.

import { paperPdfPath } from "./paths.mjs";

// Written as an escape: the repo's hook refuses the literal wide dash, and an invisible-width
// character in a class is unreviewable.
const PAGE_RANGE = new RegExp("^(\\d+)\\s*[-\\u2013]\\s*(\\d+)$");

/**
 * Some records carry an article number rather than pagination, so this is a positive match on the
 * range shape, never a split on the separator.
 *
 * @param {string | null | undefined} page
 * @returns {{ first: string | null, last: string | null }}
 */
function pageRange(page) {
  const value = (page ?? "").trim();
  const range = PAGE_RANGE.exec(value);
  if (range) return { first: range[1] ?? null, last: range[2] ?? null };
  if (/^\d+$/.test(value)) return { first: value, last: null };
  return { first: null, last: null };
}

/** @param {unknown} value @returns {string | null} */
const text = (value) => (value === null || value === undefined || value === "" ? null : String(value));

/**
 * @param {Record<string, any>} data the validated front matter
 * @param {string} slug the file's name
 * @returns {import("./types.ts").Publication}
 */
export function recordFromData(data, slug) {
  const stage = data.status === "submitted" ? "submitted" : "published";
  const publishedDate = text(data.publishedDate);
  // From the date it was deposited at; a manuscript with no date yet names its year.
  const year = publishedDate ? Number(publishedDate.slice(0, 4)) : Number(data.year);
  const { first, last } = pageRange(text(data.pages));
  const doi = text(data.doi);
  return {
    id: data.id,
    title: data.title,
    authors: [...data.authors],
    journal: text(data.journal),
    year,
    publishedDate,
    volume: text(data.volume),
    issue: text(data.issue),
    pages: text(data.pages),
    firstPage: first,
    lastPage: last,
    doi,
    pmid: text(data.pmid),
    pmcid: text(data.pmcid),
    pmcUrl: text(data.pmcUrl),
    type: data.type,
    topics: [...data.topics],
    access: data.access,
    pdfPath: data.access === "self-hosted" ? (text(data.pdfPath) ?? paperPdfPath(slug)) : null,
    externalUrl: text(data.externalUrl),
    preprintDoi: text(data.preprintDoi),
    isOpenAccess: data.isOpenAccess === true,
    license: text(data.license),
    licenseSource: text(data.licenseSource),
    summary: text(data.summary),
    updateNotice: data.updateNotice ? { type: data.updateNotice.type, doi: data.updateNotice.doi, date: data.updateNotice.date ?? null } : null,
    accessions: Array.isArray(data.accessions) ? data.accessions.map((/** @type {any} */ a) => ({ kind: a.kind, id: a.id })) : [],
    selected: data.selected === true,
    abstract: text(data.abstract),
    slug,
    stage,
  };
}

/**
 * Newest first, then by title lowercased: the order the generated module held, which the index, the
 * exports and the CSL file all follow. Compared with `<`, not localeCompare, as the generator did.
 *
 * @template {{ year: number, title: string }} T
 * @param {T[]} records
 * @returns {T[]}
 */
export function sortPublications(records) {
  return [...records].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    const x = a.title.toLowerCase();
    const y = b.title.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
