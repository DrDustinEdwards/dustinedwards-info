/**
 * The publication index's listing, pure over the query string: which papers show, in what order,
 * with which topic chips, and whether the URL is one of the four that self-canonical. The route adds
 * the citation counts (a KV read) and the page copy.
 */

import { PUBLICATIONS, TOPICS } from "../../data/publications.ts";
import { decodeEntities } from "./entities.mjs";

/** @typedef {import("../../data/publications.ts").Publication} Publication */
/** @typedef {import("../../data/publications.ts").PublicationType} PublicationType */
/** @typedef {import("../../data/publications.ts").TopicId} TopicId */

export const SORTS = /** @type {const} */ ([
  { value: "year-desc", label: "Newest first" },
  { value: "year-asc", label: "Oldest first" },
  { value: "title", label: "Title A to Z" },
]);

/** @typedef {(typeof SORTS)[number]["value"]} SortKey */

const TOPIC_IDS = new Set(TOPICS.map((t) => /** @type {string} */ (t.id)));

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

const SHOWCASE = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));

/**
 * Comparison-time only: Crossref titles carry em dashes nobody types into a search box.
 *
 * @param {string} value
 */
function fold(value) {
  return value
    .toLowerCase()
    // U+2010 to U+2015 hyphen and dash family, U+2212 minus, plain hyphen.
    // Written as escapes so the literal characters never appear in source.
    .replace(/[\u2010-\u2015\u2212-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decoded first, so the haystack is the text on the page, ampersands included.
 *
 * @param {Publication} p
 */
function haystack(p) {
  return fold(decodeEntities([p.title, p.journal ?? "", ...p.authors].join(" ")));
}

/**
 * @param {Publication[]} items
 * @param {SortKey} sort
 */
function sortItems(items, sort) {
  const byTitle = (/** @type {Publication} */ a, /** @type {Publication} */ b) =>
    a.title.localeCompare(b.title);
  return [...items].sort((a, b) => {
    if (sort === "title") return byTitle(a, b);
    if (sort === "year-asc") return a.year - b.year || byTitle(a, b);
    return b.year - a.year || byTitle(a, b);
  });
}

/**
 * @param {URLSearchParams} params
 */
export function publicationListing(params) {
  const topics = params
    .getAll("topic")
    .filter((t) => TOPIC_IDS.has(t))
    .map((t) => /** @type {TopicId} */ (t));
  const q = (params.get("q") ?? "").trim();
  const sortParam = params.get("sort");
  /** @type {SortKey} */
  const sort =
    SORTS.some((s) => s.value === sortParam) ? /** @type {SortKey} */ (sortParam) : "year-desc";
  // Any other value is absent rather than truthy, so `?selected=banana` shows the full list.
  const selectedParam = (params.get("selected") ?? "").toLowerCase();
  const selectedOnly = selectedParam === "1" || selectedParam === "true";

  // Chip counts run against everything except the topic filter, so a count only promises what a click returns.
  const needle = fold(q);
  const base = SHOWCASE.filter(
    (p) =>
      (!selectedOnly || p.selected) && (!needle || haystack(p).includes(needle)),
  );

  const items = sortItems(
    topics.length
      ? base.filter((p) => p.topics.some((t) => topics.includes(t)))
      : base,
    sort,
  );

  const linkParams = () => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (sort !== "year-desc") next.set("sort", sort);
    if (selectedOnly) next.set("selected", "1");
    return next;
  };
  const href = (/** @type {TopicId[]} */ list) => {
    const next = linkParams();
    for (const t of list) next.append("topic", t);
    const s = next.toString();
    return s ? `/publications?${s}` : "/publications";
  };

  const chips = TOPICS.map((topic) => {
    const active = topics.includes(topic.id);
    return {
      id: topic.id,
      label: topic.label,
      description: topic.description,
      count: base.filter((p) => p.topics.includes(topic.id)).length,
      active,
      href: href(
        active ? topics.filter((t) => t !== topic.id) : [...topics, topic.id],
      ),
    };
  });

  const selectedCount = SHOWCASE.filter((p) => p.selected).length;
  const filtered = topics.length > 0 || q !== "" || selectedOnly;

  const span = {
    papers: items.length,
    firstYear: items.length > 0 ? Math.min(...items.map((p) => p.year)) : null,
    lastYear: items.length > 0 ? Math.max(...items.map((p) => p.year)) : null,
    venues: new Set(items.map((p) => p.journal).filter(Boolean)).size,
  };

  // Only the four bare single-topic URLs self-canonical: the rest are subsets or orderings, and q is unbounded.
  const KNOWN_PARAMS = new Set(["topic", "q", "sort", "selected"]);
  const hasUnknownParam = [...params.keys()].some((k) => !KNOWN_PARAMS.has(k));
  /** @type {TopicId | null} */
  const soleTopic =
    topics.length === 1 &&
    params.getAll("topic").length === 1 &&
    !params.has("q") &&
    !params.has("sort") &&
    !params.has("selected") &&
    !hasUnknownParam
      ?
        (topics[0] ?? null)
      : null;

  return {
    items,
    chips,
    topics,
    q,
    sort,
    selectedOnly,
    selectedCount,
    selectedHref: (() => {
      const next = linkParams();
      next.delete("selected");
      if (!selectedOnly) next.set("selected", "1");
      for (const t of topics) next.append("topic", t);
      const s = next.toString();
      return s ? `/publications?${s}` : "/publications";
    })(),
    filtered,
    span,
    total: SHOWCASE.length,
    soleTopic,
  };
}
