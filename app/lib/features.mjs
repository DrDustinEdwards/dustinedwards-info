/*
 * What the whole network does, for /features and its markdown twin: one list, so the two cannot disagree.
 * Every card was checked against the program's README, tool list or this site's pages; README numbers are
 * left out since nothing would catch them going stale. Plain data, so test/features.test.mjs runs under node.
 */
import { PLATFORM_SECTIONS } from "./features-platform.mjs";
import { PUBLISHING_SECTIONS } from "./features-publishing.mjs";

export const FEATURES_PATH = "/features";

/**
 * The programs a card can belong to, in the order of the footer's strip of sites, then the shared code. `id` is what a
 * card names and what a chip filters by.
 *
 * @type {ReadonlyArray<{ id: string, name: string, what: string }>}
 */
export const PROGRAMS = Object.freeze([
  { id: "site", name: "dustinedwards.info", what: "This site." },
  { id: "capsid", name: "Capsid", what: "Memory, jobs and access for AI agents." },
  { id: "capsomer", name: "Capsomer", what: "The design system." },
  { id: "prelum", name: "Prelum", what: "Turns writing into pages and feeds." },
  { id: "carrel", name: "Carrel", what: "The private writing desk." },
  { id: "enarratio", name: "Enarratio", what: "Accessible charts." },
  {
    id: "shared",
    name: "Shared code",
    what: "site-runtime, site-api, d1-dump and devkit.",
  },
]);

/** @typedef {{ id: string, label: string, title: string, intro: string, features: ReadonlyArray<{ name: string, program: string, text: string }> }} Section */

/**
 * The jobs, in reading order. Each has a short label for the contents, a title and one line saying what the group is.
 *
 * @type {ReadonlyArray<Section>}
 */
export const SECTIONS = Object.freeze([...PUBLISHING_SECTIONS, ...PLATFORM_SECTIONS]);

/** The cards, in page order. */
export const ALL_FEATURES = SECTIONS.flatMap((section) =>
  section.features.map((feature) => ({ ...feature, section: section.id })),
);

/** @param {string} id */
export function programName(id) {
  const program = PROGRAMS.find((p) => p.id === id);
  if (!program) throw new Error(`no program "${id}" in PROGRAMS`);
  return program.name;
}

/** How many cards each program has, for the filter's spoken count. @returns {Record<string, number>} */
export function programCounts() {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const feature of ALL_FEATURES) counts[feature.program] = (counts[feature.program] ?? 0) + 1;
  return counts;
}

/**
 * The page as markdown: every card, by section, with its program. What a person scans, an agent reads.
 * @param {string} origin
 */
export function featuresMarkdown(origin) {
  const lines = [
    "# Features",
    "",
    "What the whole network of programs and sites does, by job. Each entry names the program that does it.",
    "",
    `Programs: ${PROGRAMS.map((p) => p.name).join(", ")}.`,
    "",
  ];
  for (const section of SECTIONS) {
    lines.push(`## ${section.title}`, "", section.intro, "");
    for (const feature of section.features) {
      lines.push(`- **${feature.name}** (${programName(feature.program)}). ${feature.text}`);
    }
    lines.push("");
  }
  lines.push(`Systems map: ${origin}/systems`, `Colophon: ${origin}/colophon`, "");
  return lines.join("\n");
}
