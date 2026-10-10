// The libraries of the knowledge bases other than Protocols (docs/KNOWLEDGE-BASE.md, step 8): Recipes and Software
// how-tos, each a catalog over its base's published procedure records, declared once here for Capsomer's catalog as the
// protocol library is in procedures/library.mjs. The page, its facets, its downloads and its markdown twin all read the
// declaration, and every fact is drawn from the records, never typed. Pure: the routes pass in the records from D1.

import { catalogRedirect, defineCatalog, parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";

import { BASES } from "./bases.mjs";
import { stepCount } from "./procedures/library.mjs";
import { courseLabel, methodLabel } from "./procedures/taxonomy.mjs";

/** @typedef {import("./bases.mjs").KnowledgeBase} KnowledgeBase */
/** @typedef {import("./procedures/render.mjs").ProcedureRecord} ProcedureRecord */

/** The bases that have a library here: every base but Protocols, whose library is its own (procedures/library.mjs). */
export const LIBRARY_BASES = Object.freeze(BASES.filter((base) => base.profile !== "protocol"));

/** The base whose library is at `path`, or null. @param {string} path */
export function baseAtLibrary(path) {
  return LIBRARY_BASES.find((base) => base.library === path.replace(/\/+$/, "")) ?? null;
}

/**
 * The trail to a library: a how-to's under Software, a recipe's on its own. The entry pages' trails extend it.
 *
 * @param {KnowledgeBase} base
 * @returns {Array<[string, string]>}
 */
export function libraryTrail(base) {
  return base.profile === "computational" ? [["Software", "/software"], [base.name, base.library]] : [[base.name, base.library]];
}

/** A record's times in words: "Prep 15 min, cook 40 min", else its total. @param {ProcedureRecord} r */
function timeOf(r) {
  const parts = [r.prepTime ? `prep ${r.prepTime}` : "", r.cookTime ? `cook ${r.cookTime}` : ""].filter(Boolean).join(", ");
  if (parts) return parts.charAt(0).toUpperCase() + parts.slice(1);
  return r.time?.total ? String(r.time.total) : "";
}

/**
 * The library's rows: the base's published records, each reduced to what its catalog reads.
 *
 * @param {KnowledgeBase} base
 * @param {ProcedureRecord[]} records
 */
export function baseItems(base, records) {
  return records
    .filter((r) => r.profile === base.profile)
    .map((r) => ({
      slug: r.slug,
      path: r.path,
      title: r.title,
      description: r.description,
      updated: r.updated ? String(r.updated) : "",
      steps: stepCount(r),
      time: timeOf(r),
      // Recipe.
      servings: r.servings ?? null,
      cuisine: r.cuisine ? String(r.cuisine) : "",
      category: r.category ? String(r.category) : "",
      diet: r.diet ?? [],
      // Software how-to.
      methods: r.methods ?? [],
      courses: r.courses ?? [],
    }));
}

/** @typedef {ReturnType<typeof baseItems>[number]} BaseItem */

/** The noun a base's entries are counted with: ["recipe", "recipes"]. @param {KnowledgeBase} base @returns {[string, string]} */
export const nounOf = (base) => [base.singular.toLowerCase(), base.name.toLowerCase()];

/** @type {Map<string, import("capsomer/behaviour/catalog").CatalogDefinition<BaseItem>>} */
const catalogs = new Map();

/**
 * A base's catalog: the fields its facets, columns and sort menu list, in that order. A recipe is found by its category,
 * cuisine and diet; a how-to by the method and course it serves.
 *
 * @param {KnowledgeBase} base
 */
export function baseCatalog(base) {
  const known = catalogs.get(base.id);
  if (known) return known;
  const title = { key: "title", label: base.singular, value: (/** @type {BaseItem} */ p) => p.title, search: 3, column: { header: base.singular }, sort: true };
  const description = { key: "description", label: "Description", value: (/** @type {BaseItem} */ p) => p.description, search: 1 };
  const updated = { key: "updated", label: "Updated", value: (/** @type {BaseItem} */ p) => p.updated, type: "date", sort: { labels: { asc: "Updated, oldest first", desc: "Updated, newest first" } } };
  const fields =
    base.profile === "recipe"
      ? [
          title,
          description,
          { key: "category", label: "Category", value: (/** @type {BaseItem} */ p) => (p.category ? [p.category] : []), facet: { kind: "many", order: "alpha" }, column: { header: "Category", drop: 1 }, search: 1 },
          { key: "cuisine", label: "Cuisine", value: (/** @type {BaseItem} */ p) => (p.cuisine ? [p.cuisine] : []), facet: { kind: "many", order: "alpha" }, search: 1 },
          { key: "diet", label: "Diet", value: (/** @type {BaseItem} */ p) => p.diet, facet: { kind: "many", order: "alpha" } },
          { key: "servings", label: "Servings", value: (/** @type {BaseItem} */ p) => p.servings ?? 0, type: "number", column: { header: "Servings", align: "end", drop: 2 } },
          { key: "time", label: "Time", value: (/** @type {BaseItem} */ p) => p.time, column: { header: "Time", drop: 2 } },
          updated,
        ]
      : [
          title,
          description,
          { key: "method", label: "Method", value: (/** @type {BaseItem} */ p) => p.methods, facet: { kind: "many", label: methodLabel }, column: { header: "Method", drop: 1 }, search: 1 },
          { key: "course", label: "Course", value: (/** @type {BaseItem} */ p) => p.courses, facet: { kind: "many", label: courseLabel } },
          { key: "steps", label: "Steps", value: (/** @type {BaseItem} */ p) => p.steps, type: "number", sort: true, column: { header: "Steps", align: "end", drop: 2 } },
          updated,
        ];
  const catalog = defineCatalog(
    /** @type {import("capsomer/behaviour/catalog").CatalogDefinition<BaseItem>} */ ({
      id: base.id,
      noun: nounOf(base),
      basePath: base.library,
      itemKey: (p) => p.slug,
      defaultSort: "title",
      pageSize: 25,
      fields,
    }),
  );
  catalogs.set(base.id, catalog);
  return catalog;
}

/**
 * The address a request should have, or null: the catalog's own clean address, with unknown parameters (a tracking
 * tag) served rather than redirected, as the protocol library does.
 *
 * @param {KnowledgeBase} base
 * @param {URL} url
 */
export function baseRedirect(base, url) {
  const catalog = baseCatalog(base);
  const known = new Set(["q", "sort", "page", ...catalog.fields.filter((f) => f.facet).map((f) => f.key)]);
  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams) if (known.has(key)) kept.append(key, value);
  const only = new URL(url);
  only.search = kept.toString();
  return catalogRedirect(catalog, only);
}

/**
 * The library as rows for a download, for the filter state in the address: every fact the page shows, ids with their
 * words. The CSV and the JSON are both this.
 *
 * @param {KnowledgeBase} base
 * @param {BaseItem[]} items
 * @param {URLSearchParams | string} params
 * @param {string} origin
 */
export function baseRecords(base, items, params, origin) {
  const catalog = baseCatalog(base);
  const state = parseCatalogParams(catalog, params);
  return queryCatalog({ ...catalog, pageSize: undefined }, items, { ...state, page: 1 }).rows.map((p) => ({
    id: p.slug,
    title: p.title,
    url: `${origin}${p.path}`,
    ...(base.profile === "recipe"
      ? { category: p.category, cuisine: p.cuisine, diet: p.diet, servings: p.servings, time: p.time }
      : { methods: p.methods.map(methodLabel), courses: p.courses.map(courseLabel), steps: p.steps }),
    updated: p.updated,
    description: p.description,
  }));
}

/** One cell of a markdown table. @param {string} text */
const cell = (text) => text.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();

/**
 * The twin's table: every entry with the facts the page shows, linked to its own page. An empty library says so.
 *
 * @param {KnowledgeBase} base
 * @param {BaseItem[]} items
 * @param {string} origin
 */
export function baseMarkdown(base, items, origin) {
  if (items.length === 0) return `No ${base.name.toLowerCase()} are published yet.`;
  const recipe = base.profile === "recipe";
  const head = recipe ? [base.singular, "Category", "Cuisine", "Diet", "Servings", "Time", "Updated"] : [base.singular, "Method", "Course", "Steps", "Updated"];
  const rows = items.map((p) =>
    (recipe
      ? [`[${cell(p.title)}](${origin}${p.path})`, p.category, p.cuisine, p.diet.join(", "), p.servings === null ? "" : String(p.servings), p.time, p.updated]
      : [`[${cell(p.title)}](${origin}${p.path})`, p.methods.map(methodLabel).join(", "), p.courses.map(courseLabel).join(", "), String(p.steps), p.updated]
    ).map((c, i) => (i === 0 ? c : cell(c))),
  );
  return [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

/** The downloads of a view, carrying its filter state; the twin is always the whole library. @param {KnowledgeBase} base @param {{ href: () => string }} result */
export function baseDownloads(base, result) {
  const href = result.href();
  const query = href.includes("?") ? href.slice(href.indexOf("?")) : "";
  return { csv: `${base.library}.csv${query}`, json: `${base.library}.json${query}`, markdown: `${base.library}.md` };
}

/** How to cite the library, from the site's identity and the library's address. @param {KnowledgeBase} base @param {{ name: string, affiliation: string, origin: string }} who */
export function baseCitation(base, { name, affiliation, origin }) {
  return {
    library: `${name}. ${base.name}. ${name} Lab, ${affiliation}. ${origin}${base.library}`,
    access: "Add the date you accessed it.",
    protocol: `To cite one ${base.singular.toLowerCase()}, cite its own page: its title, the lab, the institution, its address and the date you accessed it.`,
  };
}
