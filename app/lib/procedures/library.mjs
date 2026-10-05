// The protocol library's one declaration (docs/PROCEDURES.md): the fields a protocol is searched, filtered, sorted
// and listed by, declared once for Capsomer's catalog. The page, its facets and counts, its sort menu, the CSV and
// JSON downloads and the markdown twin all read this, so a field is described in exactly one place and a protocol's
// facts are drawn from its record, never typed again. Pure: the route passes in the records it read from D1.

import { catalogRedirect, defineCatalog, parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";

import { TOOLS } from "../phage-tools.mjs";
import { CALCULATORS_PATH, COURSES, LIBRARY_PATH, LIBRARY_TABS, METHODS, ORGANISMS, PHAGE_PIPELINE, courseLabel, methodLabel, organismLabel } from "./taxonomy.mjs";

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
      startHere: r.startHere ?? null,
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
    (s.href ? `- [${s.label}](${origin}${s.href}): ${countOf(s.count, noun)}` : `- ${s.label}`) +
    s.tools.map((t) => `\n  - [${t.label}](${origin}${t.href})`).join("");
  return [
    "## In the library",
    "",
    overviewSentence(overview),
    ...(overview.start.length > 0
      ? ["", "### Start here", "", ...overview.start.map((p, i) => `${i + 1}. [${p.title}](${origin}${p.href}): ${p.description}`)]
      : []),
    "",
    "### The phage workflow",
    "",
    ...overview.stages.map(stage),
    ...overview.browse.flatMap((group) => [
      "",
      `### ${group.title}`,
      "",
      ...group.tiles.map((t) => {
        const about = "about" in t && typeof t.about === "string" ? ` ([about the course](${origin}${t.about}))` : "";
        return `- [${t.label}](${origin}${t.href}): ${countOf(t.count, noun)}${about}`;
      }),
    ]),
    "",
    "### Calculators",
    "",
    `- [Phage Lab Calculators](${origin}${CALCULATORS_PATH}): ${countOf(calculatorCount(), ["calculator", "calculators"])}`,
  ].join("\n");
}

/**
 * The address of the library narrowed to some values of a facet: the one a person reaches by choosing them there.
 *
 * @param {string} key the facet's parameter (method, organism, course)
 * @param {readonly string[]} values
 */
export function facetHref(key, values) {
  return `${LIBRARY_PATH}?${values.map((v) => `${key}=${encodeURIComponent(v)}`).join("&")}`;
}

/** The library narrowed to some methods. @param {readonly string[]} methods */
export function methodHref(methods) {
  return facetHref("method", methods);
}

/**
 * A calculator as a link: its page and the name its form carries, both from the one registry. An id the registry does
 * not know is an error here, not a missing link.
 *
 * @param {string} id
 */
export function toolLink(id) {
  const tool = TOOLS[id];
  if (!tool) throw new Error(`the phage workflow names a calculator "${id}" that phage-tools.mjs does not define`);
  return { id, label: tool.title, href: tool.path };
}

/**
 * What the library says about itself, counted from its rows: how many protocols, over how many methods and
 * organisms, when the newest changed, a tile for each method that has a protocol, and the phage workflow with the
 * number of protocols under each stage. Nothing here is typed: a protocol saved changes every figure.
 *
 * @param {LibraryItem[]} items
 */
export function libraryOverview(items) {
  /** A tile for each id of a closed list that has a protocol: its words, its count and the library narrowed to it. */
  const tilesOf = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ list, /** @type {(item: LibraryItem) => readonly string[]} */ valuesOf, /** @type {(id: string) => string} */ label) =>
    Object.keys(list)
      .map((id) => ({ id, label: label(id), count: items.filter((p) => valuesOf(p).includes(id)).length, href: facetHref(key, [id]) }))
      .filter((tile) => tile.count > 0);
  const tiles = tilesOf("method", METHODS, (p) => p.methods, methodLabel);
  const browse = [
    { id: "method", title: "Browse by method", tiles },
    {
      id: "course",
      title: "Browse by course",
      // A course's tile also names the page that describes it, so the course is one click from its protocols.
      tiles: tilesOf("course", COURSES, (p) => p.courses, courseLabel).map((tile) => ({ ...tile, about: COURSES[/** @type {keyof typeof COURSES} */ (tile.id)].path })),
    },
    { id: "organism", title: "Browse by organism", tiles: tilesOf("organism", ORGANISMS, (p) => p.organisms, organismLabel) },
  ].filter((group) => group.tiles.length > 0);
  const stages = PHAGE_PIPELINE.map((stage) => {
    const count = items.filter((p) => p.methods.some((m) => stage.methods.includes(m))).length;
    const tools = stage.tools.map((id) => toolLink(id));
    return { id: stage.id, label: stage.label, count, href: count > 0 ? methodHref(stage.methods) : null, tools };
  });
  // The protocols that say where to begin, in the position each states (never inferred from anything else).
  const start = items
    .filter((p) => p.startHere !== null)
    .sort((a, b) => /** @type {number} */ (a.startHere) - /** @type {number} */ (b.startHere))
    .map((p) => ({ slug: p.slug, title: p.title, href: p.path, description: p.description }));
  const dates = items.map((p) => p.updated).filter(Boolean).sort();
  return {
    total: items.length,
    methods: tiles.length,
    organisms: new Set(items.flatMap((p) => p.organisms)).size,
    updated: dates.at(-1) ?? "",
    tiles,
    browse,
    stages,
    start,
  };
}

/**
 * The tabs over the catalog: All, then each kind of work with the number of protocols in it. A tab is a link, so a
 * tab, Back and a bookmark all work with no script. The current one is the tab whose methods are exactly the method
 * filter in the address; All is current while no method is chosen. The registry's kinds (primers, as they land) follow the
 * calculators as links to their own pages, counted from the registry and never the current tab here.
 *
 * @param {LibraryItem[]} items
 * @param {readonly string[]} chosen the method ids in the address
 * @param {Array<{ id: string, label: string, count: number, href: string }>} [registry] one entry for each registry kind that has items
 */
export function libraryTabs(items, chosen, registry = []) {
  const same = (/** @type {readonly string[]} */ methods) =>
    chosen.length === methods.length && methods.every((m) => chosen.includes(m));
  return [
    { id: "all", label: "All", count: items.length, href: LIBRARY_PATH, current: chosen.length === 0 },
    ...LIBRARY_TABS.map((tab) => ({
      id: tab.id,
      label: tab.label,
      count: items.filter((p) => p.methods.some((m) => tab.methods.includes(m))).length,
      href: methodHref(tab.methods),
      current: same(tab.methods),
    })),
    // The calculators are not protocols, so they are not rows of this catalog: their tab is a link to their own page,
    // counted from the registry that holds them, and never the current one here.
    { id: "calculators", label: "Calculators", count: calculatorCount(), href: CALCULATORS_PATH, current: false },
    ...registry.map((tab) => ({ ...tab, current: false })),
  ];
}

/** How many calculator pages there are: the distinct pages the registry's tools sit on. */
export function calculatorCount() {
  return new Set(Object.values(TOOLS).map((tool) => tool.path)).size;
}

/**
 * The address a request should have, or null. The catalog's own redirect sends an address with defaults spelled out,
 * or in another order, to its one clean address; and it drops every parameter it does not know. The library keeps
 * the first and leaves the second alone: a tracking parameter or a cache-buster on a library address is served, not
 * redirected, so a link carrying one still lands on the page it names.
 *
 * @param {URL} url
 */
export function libraryRedirect(url) {
  const known = new Set(["q", "sort", "page", ...LIBRARY.fields.filter((f) => f.facet).map((f) => f.key)]);
  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams) if (known.has(key)) kept.append(key, value);
  const only = new URL(url);
  only.search = kept.toString();
  return catalogRedirect(LIBRARY, only);
}

/**
 * How to cite the library, from the site's own identity and the library's address: nothing typed here but the shape
 * of a citation. The date of access is the reader's to add.
 *
 * @param {{ name: string, affiliation: string, origin: string }} who
 */
export function libraryCitation({ name, affiliation, origin }) {
  const lab = `${name} Lab`;
  return {
    library: `${name}. Protocol library. ${lab}, ${affiliation}. ${origin}${LIBRARY_PATH}`,
    access: "Add the date you accessed it.",
    protocol:
      "To cite one protocol, cite its own page: its title, the lab, the institution, its address and the date you accessed it. " +
      "A protocol's page names the papers it follows, so cite those for the method itself.",
  };
}

/**
 * The downloads of a view: the CSV and the JSON carry the filter state the address does, so what is downloaded is what is
 * shown; the markdown twin is always the whole library.
 *
 * @param {{ href: () => string }} result the catalog's result, whose `href()` is the clean address of this view
 */
export function libraryDownloads(result) {
  const href = result.href();
  const query = href.includes("?") ? href.slice(href.indexOf("?")) : "";
  return { csv: `${LIBRARY_PATH}.csv${query}`, json: `${LIBRARY_PATH}.json${query}`, markdown: `${LIBRARY_PATH}.md` };
}

/**
 * The twin's "Download and cite": the same addresses and the same citation the page shows, as absolute links.
 *
 * @param {ReturnType<typeof libraryCitation>} citation
 * @param {string} origin
 */
export function citeMarkdown(citation, origin) {
  return [
    "## Download and cite",
    "",
    `- [CSV](${origin}${LIBRARY_PATH}.csv): every protocol with every fact the table shows; a filtered address gives the filtered rows`,
    `- [JSON](${origin}${LIBRARY_PATH}.json): the same rows`,
    `- [Markdown](${origin}${LIBRARY_PATH}.md): this page`,
    "",
    "### Cite the library",
    "",
    citation.library,
    "",
    citation.access,
    "",
    citation.protocol,
  ].join("\n");
}

/**
 * Where a protocol sits in the phage workflow, drawn from the same stages the library's strip uses: its stage (the first
 * whose methods it carries out), the protocols of the nearest earlier and later stage that has any, and the calculators
 * of its stage. Nothing is typed per protocol: a protocol saved changes its neighbours' links. A protocol outside the
 * workflow (a PCR primer set) has none, and so does a stage with nothing before or after it.
 *
 * @param {LibraryItem[]} items every published library entry
 * @param {string} path the protocol's own path
 */
export function workflowContext(items, path) {
  const self = items.find((p) => p.path === path);
  if (!self) return null;
  const stageOf = (/** @type {LibraryItem} */ p) => PHAGE_PIPELINE.findIndex((stage) => p.methods.some((m) => stage.methods.includes(m)));
  const at = stageOf(self);
  if (at === -1) return null;
  const link = (/** @type {LibraryItem} */ p) => ({ title: p.title, href: p.path });
  const others = items.filter((p) => p.path !== path);
  const nearest = (/** @type {number} */ step) => {
    for (let i = at + step; i >= 0 && i < PHAGE_PIPELINE.length; i += step) {
      const found = others.filter((p) => stageOf(p) === i);
      if (found.length > 0) return found.map(link);
    }
    return [];
  };
  const stage = /** @type {(typeof PHAGE_PIPELINE)[number]} */ (PHAGE_PIPELINE[at]);
  return { stage: stage.label, before: nearest(-1), after: nearest(1), tools: stage.tools.map(toolLink) };
}

/**
 * The same context as lines for the markdown twin, so an agent reads the neighbours a person sees.
 *
 * @param {ReturnType<typeof workflowContext>} context
 * @param {string} origin
 */
export function workflowMarkdown(context, origin) {
  if (!context) return "";
  const links = (/** @type {Array<{ title: string, href: string }>} */ list) => list.map((p) => `[${p.title}](${origin}${p.href})`).join(", ");
  return [
    "## In the phage workflow",
    "",
    `Stage: ${context.stage}.`,
    ...(context.before.length > 0 ? ["", `Before this: ${links(context.before)}.`] : []),
    ...(context.after.length > 0 ? ["", `After this: ${links(context.after)}.`] : []),
    ...(context.tools.length > 0 ? ["", `Calculators: ${links(context.tools.map((t) => ({ title: t.label, href: t.href })))}.`] : []),
  ].join("\n");
}
