// The protocol library's one declaration (docs/PROCEDURES.md): the fields a protocol is searched, filtered, sorted
// and listed by, declared once for Capsomer's catalog. The page, its facets and counts, its sort menu, the CSV and
// JSON downloads and the markdown twin all read this, so a field is described in exactly one place and a protocol's
// facts are drawn from its record, never typed again. Pure: the route passes in the records it read from D1.

import { defineCatalog, parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";

import { LIBRARY_PATH, METHODS, PHAGE_PIPELINE, courseLabel, methodLabel, organismLabel } from "./taxonomy.mjs";

export { LIBRARY_PATH };

/** The kinds a library entry can be: a bench protocol, or a computational method. */
const KINDS = Object.freeze({ protocol: "Protocol", computational: "Computational method" });

/** @param {string} id */
const kindLabel = (id) => /** @type {Record<string, string>} */ (KINDS)[id] ?? id;

/**
 * The one fact worth showing beside a title, drawn from the record and never typed: what it works on (its targets),
 * else how long it takes. A fact the record does not hold is left out; nothing stands in for it.
 *
 * @param {{ targets: string[], time: { total: string | null } }} record
 */
export function keyFact(record) {
  if (record.targets.length > 0) return record.targets.join(", ");
  if (record.time.total) return record.time.total;
  return "";
}

/** How many steps a record has, over all its method sections. @param {import("./render.mjs").ProcedureRecord} record */
export function stepCount(record) {
  let n = 0;
  for (const section of record.sections) {
    for (const block of section.blocks) if (block.type === "steps") n += block.steps.length;
  }
  return n;
}

/**
 * The library's rows: the published protocols and computational methods, each reduced to what the catalog reads.
 * Recipes are not laboratory protocols and have their own address.
 *
 * @param {Array<import("./render.mjs").ProcedureRecord>} records
 */
export function libraryItems(records) {
  return records
    .filter((r) => r.profile === "protocol" || r.profile === "computational")
    .map((r) => ({
      slug: r.slug,
      path: r.path,
      title: r.title,
      description: r.description,
      kind: r.profile,
      methods: r.methods,
      organisms: r.organisms,
      targets: r.targets,
      courses: r.courses,
      updated: r.updated ? String(r.updated) : "",
      version: r.version ? String(r.version) : "",
      time: r.time.total ? String(r.time.total) : "",
      steps: stepCount(r),
      keyFact: keyFact(r),
    }));
}

/** @typedef {ReturnType<typeof libraryItems>[number]} LibraryItem */

/**
 * The catalog: fields in the order the facets, columns and sort menu list them. There is no Kind facet while every
 * entry is a protocol, because a facet of one value filters nothing; it returns with the first computational method.
 */
export const LIBRARY = defineCatalog(
  /** @type {import("capsomer/behaviour/catalog").CatalogDefinition<LibraryItem>} */ ({
    id: "protocols",
    noun: ["protocol", "protocols"],
    basePath: LIBRARY_PATH,
    itemKey: (p) => p.slug,
    defaultSort: "title",
    pageSize: 25,
    fields: [
      { key: "title", label: "Protocol", value: (p) => p.title, search: 3, column: { header: "Protocol" }, sort: true },
      { key: "description", label: "Description", value: (p) => p.description, search: 1 },
      {
        key: "method",
        label: "Method",
        value: (p) => p.methods,
        facet: { kind: "many", general: true, label: methodLabel },
        column: { header: "Method", drop: 1 },
        search: 1,
      },
      {
        key: "organism",
        label: "Organism",
        value: (p) => p.organisms,
        facet: { kind: "many", label: organismLabel },
        search: 1,
      },
      {
        key: "target",
        label: "Target",
        value: (p) => p.targets,
        facet: { kind: "many", order: "alpha" },
        search: 2,
      },
      {
        key: "course",
        label: "Course",
        value: (p) => p.courses,
        facet: { kind: "many", label: courseLabel },
      },
      { key: "fact", label: "Key fact", value: (p) => p.keyFact, column: { header: "Key fact", drop: 2 } },
      { key: "steps", label: "Steps", value: (p) => p.steps, type: "number", sort: true, column: { header: "Steps", align: "end", drop: 2 } },
      { key: "links", label: "Quick links", value: () => "", column: { header: "Quick links", drop: 2 } },
      { key: "updated", label: "Updated", value: (p) => p.updated, type: "date", sort: { labels: { asc: "Updated, oldest first", desc: "Updated, newest first" } } },
    ],
  }),
);

/**
 * The library as rows for a download: every fact the page shows, for the filter state in the address, as ids with
 * their words, so a machine reads what a person sees. The CSV and the JSON are both this.
 *
 * @param {LibraryItem[]} items
 * @param {URLSearchParams | string} params
 * @param {string} origin
 */
export function libraryRecords(items, params, origin) {
  const state = parseCatalogParams(LIBRARY, params);
  return queryCatalog({ ...LIBRARY, pageSize: undefined }, items, { ...state, page: 1 }).rows.map((p) => ({
    id: p.slug,
    title: p.title,
    url: `${origin}${p.path}`,
    kind: kindLabel(p.kind),
    methods: p.methods.map(methodLabel),
    organisms: p.organisms.map(organismLabel),
    targets: p.targets,
    courses: p.courses.map(courseLabel),
    steps: p.steps,
    time: p.time,
    version: p.version,
    updated: p.updated,
    description: p.description,
  }));
}

/**
 * The same rows as CSV (RFC 4180): a list field is its values joined with "; ". A cell is quoted when it holds a
 * comma, a quote or a line break.
 *
 * @param {ReturnType<typeof libraryRecords>} rows
 */
export function libraryCsv(rows) {
  const columns = /** @type {Array<keyof (typeof rows)[number]>} */ (Object.keys(rows[0] ?? { id: 1, title: 1, url: 1 }));
  const cellOf = (/** @type {unknown} */ value) => {
    const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${[columns.join(","), ...rows.map((row) => columns.map((c) => cellOf(row[c])).join(","))].join("\r\n")}\r\n`;
}

/** One cell of a markdown table. @param {string} text */
const cell = (text) => text.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();

/**
 * The twin's table: every protocol with the facts the page shows, drawn from the same items. Links are to the
 * protocols' own pages, so an agent can follow them.
 *
 * @param {LibraryItem[]} items
 * @param {string} origin
 */
export function libraryMarkdown(items, origin) {
  const head = ["Protocol", "Method", "Organism", "Target", "Course", "Steps", "Updated"];
  const rows = items.map((p) =>
    [
      `[${cell(p.title)}](${origin}${p.path})`,
      p.methods.map(methodLabel).join(", "),
      p.organisms.map(organismLabel).join(", "),
      p.targets.join(", "),
      p.courses.map(courseLabel).join(", "),
      String(p.steps),
      p.updated,
    ].map((c, i) => (i === 0 ? c : cell(c))),
  );
  return [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

/** @param {number} n @param {[string, string]} noun */
export const countOf = (n, noun) => `${n} ${n === 1 ? noun[0] : noun[1]}`;

/**
 * The overview's counts as a sentence: the one the page's count line and the twin both carry.
 *
 * @param {ReturnType<typeof libraryOverview>} overview
 */
export function overviewSentence(overview) {
  const parts = [
    `${countOf(overview.total, ["protocol", "protocols"])} across ${countOf(overview.methods, ["method", "methods"])}`,
    overview.organisms > 0 ? `${countOf(overview.organisms, ["organism", "organisms"])}` : "",
    overview.updated ? `newest updated ${overview.updated}` : "",
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}

/**
 * The overview for the twin: the count sentence, the workflow as a list with a link for each stage that has
 * protocols, and the methods with their counts, so a machine reads what the page shows.
 *
 * @param {ReturnType<typeof libraryOverview>} overview
 * @param {string} origin
 */
export function overviewMarkdown(overview, origin) {
  const noun = /** @type {[string, string]} */ (["protocol", "protocols"]);
  const stage = (/** @type {(typeof overview.stages)[number]} */ s) =>
    s.href ? `- [${s.label}](${origin}${s.href}): ${countOf(s.count, noun)}` : `- ${s.label}`;
  return [
    "## In the library",
    "",
    overviewSentence(overview),
    "",
    "### The phage workflow",
    "",
    ...overview.stages.map(stage),
    "",
    "### Browse by method",
    "",
    ...overview.tiles.map((t) => `- [${t.label}](${origin}${t.href}): ${countOf(t.count, noun)}`),
  ].join("\n");
}

/**
 * The address of the library narrowed to some methods: the one a person reaches by choosing them in the facet.
 *
 * @param {readonly string[]} methods
 */
export function methodHref(methods) {
  return `${LIBRARY_PATH}?${methods.map((m) => `method=${encodeURIComponent(m)}`).join("&")}`;
}

/**
 * What the library says about itself, counted from its rows: how many protocols, over how many methods and
 * organisms, when the newest changed, a tile for each method that has a protocol, and the phage workflow with the
 * number of protocols under each stage. Nothing here is typed: a protocol saved changes every figure.
 *
 * @param {LibraryItem[]} items
 */
export function libraryOverview(items) {
  const tiles = Object.keys(METHODS)
    .map((id) => ({ id, label: methodLabel(id), count: items.filter((p) => p.methods.includes(id)).length, href: methodHref([id]) }))
    .filter((tile) => tile.count > 0);
  const stages = PHAGE_PIPELINE.map((stage) => {
    const count = items.filter((p) => p.methods.some((m) => stage.methods.includes(m))).length;
    return { id: stage.id, label: stage.label, count, href: count > 0 ? methodHref(stage.methods) : null };
  });
  const dates = items.map((p) => p.updated).filter(Boolean).sort();
  return {
    total: items.length,
    methods: tiles.length,
    organisms: new Set(items.flatMap((p) => p.organisms)).size,
    updated: dates.at(-1) ?? "",
    tiles,
    stages,
  };
}
