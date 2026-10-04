/**
 * The publication index (docs/PUBLICATIONS.md): its fields declared once for Capsomer's catalog, so the search box, the
 * topic and other facets, the sort menu, the year headings and the counts all come from this one declaration. Pure
 * over the query string and the papers it is handed. The route adds the citation counts (a D1 read) and the page copy.
 *
 * What did not change, because search engines and the machine-readable gates hold it: `?topic=` is the address of a
 * topic's papers, and exactly the four bare single-topic addresses canonicalise to themselves (`soleTopic`); every other
 * address is a view of the base page.
 */

import { defineCatalog, parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";

import { decodeEntities } from "./entities.mjs";
import { TOPICS, TOPIC_IDS } from "./topics.mjs";

/** @typedef {import("./types.ts").Publication} Publication */
/** @typedef {import("./types.ts").PublicationType} PublicationType */
/** @typedef {import("./types.ts").TopicId} TopicId */

/**
 * Conference abstracts stay in the data file, which the CV also reads, and are excluded here.
 *
 * @type {Set<PublicationType>}
 */
export const SHOWCASE_TYPES = new Set([
  "article",
  "review",
  "chapter",
  "teaching-resource",
]);

export const PUBLICATIONS_BASE = "/research/publications";

const TYPE_LABELS = /** @type {Record<string, string>} */ ({
  article: "Article",
  review: "Review",
  chapter: "Chapter",
  "teaching-resource": "Teaching resource",
});

/** The journal, volume and pages as the page prints them, entities decoded (the year has its own column). @param {Publication} p */
export function venue(p) {
  return decodeEntities([p.journal, p.volume, p.pages].filter(Boolean).join(", "));
}

/** The papers' catalog. Newest first by default, under a heading for each year; any search or other sort is flat. */
export const PUBLICATIONS = defineCatalog(
  /** @type {import("capsomer/behaviour/catalog").CatalogDefinition<Publication>} */ ({
    id: "papers",
    noun: ["paper", "papers"],
    basePath: PUBLICATIONS_BASE,
    itemKey: (p) => p.id,
    defaultSort: "-year",
    group: { field: "year" },
    fields: [
      { key: "title", label: "Title", value: (p) => decodeEntities(p.title), search: 3, sort: true, column: { header: "Paper" } },
      { key: "authors", label: "Authors", value: (p) => p.authors.map(decodeEntities), search: 1 },
      { key: "journal", label: "Journal", value: (p) => venue(p), search: 2, column: { header: "Journal", drop: 1 } },
      {
        key: "year",
        label: "Year",
        value: (p) => p.year,
        type: "number",
        sort: { labels: { asc: "oldest first", desc: "newest first" } },
        column: { header: "Year", align: "end", hideWhenGrouped: true },
      },
      {
        key: "topic",
        label: "Topic",
        value: (p) => p.topics,
        facet: { kind: "many", general: true, order: TOPICS.map((t) => t.id), label: (v) => TOPICS.find((t) => t.id === v)?.label ?? v },
      },
      { key: "type", label: "Type", value: (p) => p.type, facet: { kind: "many", label: (v) => TYPE_LABELS[v] ?? v } },
      // Chosen with `?selected=1`, as the page's "Selected" filter always was.
      { key: "selected", label: "Selected", value: (p) => (p.selected ? "1" : null), facet: { kind: "one", label: () => "Selected papers" } },
      { key: "access", label: "Access", value: (p) => (p.isOpenAccess ? "open" : null), facet: { kind: "one", label: () => "Open access" } },
    ],
  }),
);

/**
 * The address a request written in the old parameters should have, or null. The page used `?sort=year-desc|year-asc|title`
 * and `?selected=1|true`; the catalog says `sort=-year|year|title` and `selected=1`. A link in the wild keeps working: it
 * is sent, once, to the same view at its new address. A request with none of the old spellings is left alone.
 *
 * @param {URL} url
 */
export function legacyAddress(url) {
  const params = url.searchParams;
  const sort = params.get("sort");
  const oldSort = sort === "year-desc" || sort === "year-asc";
  const oldSelected = (params.get("selected") ?? "").toLowerCase() === "true";
  if (!oldSort && !oldSelected) return null;
  const next = new URLSearchParams(params);
  if (sort === "year-desc") next.delete("sort");
  if (sort === "year-asc") next.set("sort", "year");
  if (oldSelected) next.set("selected", "1");
  return queryCatalog(PUBLICATIONS, [], parseCatalogParams(PUBLICATIONS, next)).href();
}

/**
 * Only the four bare single-topic URLs self-canonical: the rest are subsets or orderings, and q is unbounded.
 *
 * @param {URLSearchParams} params
 * @returns {TopicId | null}
 */
export function soleTopic(params) {
  const topics = params.getAll("topic").filter((t) => TOPIC_IDS.has(t));
  const KNOWN_PARAMS = new Set(["topic", "q", "sort", "selected"]);
  const hasUnknownParam = [...params.keys()].some((k) => !KNOWN_PARAMS.has(k));
  return topics.length === 1 &&
    params.getAll("topic").length === 1 &&
    !params.has("q") &&
    !params.has("sort") &&
    !params.has("selected") &&
    !hasUnknownParam
    ? /** @type {TopicId} */ (topics[0])
    : null;
}

/**
 * The page's state for an address: the showcase papers run through the catalog, with the span the header states and the
 * canonical topic. Everything shown is in `result`.
 *
 * @param {URLSearchParams} params
 * @param {Publication[]} publications every published paper, newest first (app/db/publications.ts)
 */
export function publicationListing(params, publications) {
  const showcase = publications.filter((p) => SHOWCASE_TYPES.has(p.type));
  const result = queryCatalog(PUBLICATIONS, showcase, parseCatalogParams(PUBLICATIONS, params));
  const items = result.rows;
  const span = {
    papers: items.length,
    firstYear: items.length > 0 ? Math.min(...items.map((p) => p.year)) : null,
    lastYear: items.length > 0 ? Math.max(...items.map((p) => p.year)) : null,
    venues: new Set(items.map((p) => p.journal).filter(Boolean)).size,
  };
  return { items, result, span, soleTopic: soleTopic(params), total: showcase.length };
}
