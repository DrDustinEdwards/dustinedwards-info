/** What the library says about itself, counted from its rows: the overview, its tabs and facet addresses. */

import { mdLink } from "../md-link.mjs";
import { TOOLS } from "../../lib/phage-tools.mjs";
import {
  CALCULATORS_PATH,
  COURSES,
  LIBRARY_PATH,
  LIBRARY_TABS,
  METHODS,
  PHAGE_PIPELINE,
  courseLabel,
  methodLabel,
  NON_STRAIN_ORGANISMS,
  organismLabel,
} from "./taxonomy.mjs";
import { toolLink } from "./library-workflow.mjs";
import { countOf } from "./library.mjs";

/** @typedef {import("./library.mjs").LibraryItem} LibraryItem */

/**
 * The overview's counts as a sentence: the one the page's count line and the twin both carry.
 *
 * @param {ReturnType<typeof libraryOverview>} overview
 */
function overviewSentence(overview) {
  const parts = [
    `${countOf(overview.total, ["protocol", "protocols"])} across ${countOf(overview.methods, ["method", "methods"])}`,
    overview.organisms > 0 ? `${countOf(overview.organisms, ["organism", "organisms"])}` : "",
    overview.updated ? `newest updated ${overview.updated}` : "",
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}

/**
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
      ? [
          "",
          "### Start here",
          "",
          ...overview.start.map(
            (p, i) => `${i + 1}. ${mdLink(p.title, origin + p.href)}: ${p.description}`,
          ),
        ]
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
        const about =
          "about" in t && typeof t.about === "string"
            ? ` ([about the course](${origin}${t.about}))`
            : "";
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
function facetHref(key, values) {
  return `${LIBRARY_PATH}?${values.map((v) => `${key}=${encodeURIComponent(v)}`).join("&")}`;
}

/** The library narrowed to some methods. @param {readonly string[]} methods */
function methodHref(methods) {
  return facetHref("method", methods);
}

/**
 * @param {LibraryItem[]} items
 */
export function libraryOverview(items) {
  /** A tile for each id of a closed list that has a protocol: its words, its count and the library narrowed to it. */
  const tilesOf = (
    /** @type {string} */ key,
    /** @type {Record<string, unknown>} */ list,
    /** @type {(item: LibraryItem) => readonly string[]} */ valuesOf,
    /** @type {(id: string) => string} */ label,
  ) =>
    Object.keys(list)
      .map((id) => ({
        id,
        label: label(id),
        count: items.filter((p) => valuesOf(p).includes(id)).length,
        href: facetHref(key, [id]),
      }))
      .filter((tile) => tile.count > 0);
  const tiles = tilesOf("method", METHODS, (p) => p.methods, methodLabel);
  const browse = [
    { id: "method", title: "Browse by method", tiles },
    {
      id: "course",
      title: "Browse by course",
      // A course's tile also names the page that describes it, so the course is one click from its protocols.
      tiles: tilesOf("course", COURSES, (p) => p.courses, courseLabel).map((tile) => ({
        ...tile,
        about: COURSES[/** @type {keyof typeof COURSES} */ (tile.id)].path,
      })),
    },
    {
      id: "organism",
      title: "Browse by organism",
      tiles: tilesOf(
        "organism",
        Object.fromEntries(
          [...new Set(items.flatMap((p) => p.organisms))]
            .sort(
              (a, b) =>
                Number(Object.hasOwn(NON_STRAIN_ORGANISMS, a)) -
                  Number(Object.hasOwn(NON_STRAIN_ORGANISMS, b)) ||
                organismLabel(a).localeCompare(organismLabel(b), "en"),
            )
            .map((id) => [id, true]),
        ),
        (p) => p.organisms,
        organismLabel,
      ),
    },
  ].filter((group) => group.tiles.length > 0);
  const stages = PHAGE_PIPELINE.map((stage) => {
    const count = items.filter((p) => p.methods.some((m) => stage.methods.includes(m))).length;
    const tools = stage.tools.map((id) => toolLink(id));
    return {
      id: stage.id,
      label: stage.label,
      count,
      href: count > 0 ? methodHref(stage.methods) : null,
      tools,
    };
  });
  // The protocols that say where to begin, in the position each states (never inferred from anything else).
  const start = items
    .filter((p) => p.startHere !== null)
    .sort((a, b) => /** @type {number} */ (a.startHere) - /** @type {number} */ (b.startHere))
    .map((p) => ({ slug: p.slug, title: p.title, href: p.path, description: p.description }));
  const dates = items
    .map((p) => p.updated)
    .filter(Boolean)
    .sort();
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
 * @param {LibraryItem[]} items
 * @param {readonly string[]} chosen the method ids in the address
 * @param {Array<{ id: string, label: string, count: number, href: string }>} [registry] one entry for each registry kind that has items
 */
export function libraryTabs(items, chosen, registry = []) {
  const same = (/** @type {readonly string[]} */ methods) =>
    chosen.length === methods.length && methods.every((m) => chosen.includes(m));
  return [
    {
      id: "all",
      label: "All",
      count: items.length,
      href: LIBRARY_PATH,
      current: chosen.length === 0,
    },
    ...LIBRARY_TABS.map((tab) => ({
      id: tab.id,
      label: tab.label,
      count: items.filter((p) => p.methods.some((m) => tab.methods.includes(m))).length,
      href: methodHref(tab.methods),
      current: same(tab.methods),
    })),
    // The calculators are not protocols, so they are not rows of this catalog: their tab is a link to their own page,
    // counted from the registry that holds them, and never the current one here.
    {
      id: "calculators",
      label: "Calculators",
      count: calculatorCount(),
      href: CALCULATORS_PATH,
      current: false,
    },
    ...registry.map((tab) => ({ ...tab, current: false })),
  ];
}

/** How many calculator pages there are: the distinct pages the registry's tools sit on. */
function calculatorCount() {
  return new Set(Object.values(TOOLS).map((tool) => tool.path)).size;
}
