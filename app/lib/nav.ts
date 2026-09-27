// Relative, so test/nav.test.mjs can import this file under plain node.
import { CONTENT_PAGE_PATHS, CONTENT_PAGE_SECTIONS } from "./content-pages.mjs";

/*
 * The header's destinations and the mega menus that hang from them, in the order and with the labels
 * of cutover.md's site structure (approved 2026-09-27). Menu labels are the words people search for;
 * a description is six words at most, and is left off where the label explains itself.
 */

/** A line icon from the menu design, drawn in site-nav-panel.tsx. */
export type NavIcon =
  | "retroviruses"
  | "bacteriophages"
  | "science-education"
  | "recipes"
  | "travel"
  | "games"
  | "flying"
  | "scuba"
  | "art";

export type MenuLink = {
  to: string;
  label: string;
  description?: string;
  /** Mono text beside the label rather than under it: the COI primer names. */
  aside?: string;
  icon?: NavIcon;
};

/** A run of links, under a subheading when `label` is set. */
export type MenuSection = { label?: string; links: MenuLink[] };

export type MenuColumn = {
  label?: string;
  sections: MenuSection[];
  /** Two tracks wide, its links in a three-column grid: About's interests. */
  wide?: boolean;
  /** The menu opens only once this column has a live link; until then the word is a plain link. */
  launches?: boolean;
};

export type Menu = {
  /** Names the panel and its chevron: `site-nav-research`, "Show Research links". */
  id: string;
  /** The panel's first line, set larger: "All research". */
  head: MenuLink;
  /** Links on the head's line: About's CV and Contact. */
  beside?: MenuLink[];
  columns: MenuColumn[];
};

export type NavItem = { to: string; label: string; menu?: Menu };

/** The CV until /cv exists: the Google Doc's always-current PDF export (cutover.md). */
const CV_PDF =
  "https://docs.google.com/document/d/123n-n-ViE-OyUUqIjEY4byMVVUvfK8BjdNCNt-Gm7GQ/export?format=pdf";

const RESEARCH: Menu = {
  id: "research",
  head: { to: "/research", label: "All research", description: "Areas, phages, protocols and publications" },
  columns: [
    {
      label: "Research areas",
      sections: [
        {
          links: [
            {
              to: "/research/retroviruses",
              label: "Retroviruses",
              description: "HIV, HTLV, REV and LPDV",
              icon: "retroviruses",
            },
            {
              to: "/research/bacteriophages",
              label: "Bacteriophages",
              description: "Genomics, structure and host biology",
              icon: "bacteriophages",
            },
            {
              to: "/research/science-education",
              label: "Science education",
              description: "SEA-PHAGES and course-based research",
              icon: "science-education",
            },
          ],
        },
      ],
    },
    {
      sections: [
        { links: [{ to: "/research/phages", label: "Phages", description: "Every phage, linked to PhagesDB" }] },
      ],
    },
    {
      label: "Protocols",
      sections: [
        {
          label: "Phage methods",
          links: [
            {
              to: "/teaching/phage-discovery",
              label: "Phage discovery guide",
              description: "Steps and the Ward’s kit",
            },
            {
              to: "/research/protocols/phage-isolation",
              label: "Phage isolation and purification",
              description: "Webbed plates, spot titers, lysates",
            },
            {
              to: "/research/protocols/phage-dna-extraction",
              label: "Phage DNA extraction",
              description: "Our zinc chloride method",
            },
          ],
        },
        {
          label: "PCR and primers",
          links: [
            { to: "/research/protocols/coi-primers", label: "COI primers", aside: "LCO1490 · HCO2198" },
            {
              to: "/research/protocols/rev-lpdv-primers",
              label: "REV and LPDV",
              description: "Avian retrovirus PCR primers",
            },
            {
              to: "/research/protocols/pan-avian-gapdh",
              label: "Pan-avian GAPDH",
              description: "Bird DNA quality control",
            },
          ],
        },
      ],
    },
    { sections: [{ links: [{ to: "/research/publications", label: "Publications" }] }] },
  ],
};

// The Research panel's component and layout, with no drawing of its own (Dustin, 2026-09-27).
const TEACHING: Menu = {
  id: "teaching",
  head: { to: "/teaching", label: "All teaching", description: "Courses, tutorials and undergraduate research" },
  columns: [
    {
      label: "Courses",
      sections: [
        {
          links: [
            {
              to: "/teaching/phage-discovery",
              label: "Phage Discovery Program",
              description: "Two-semester HHMI SEA-PHAGES program",
            },
            {
              to: "/teaching/virus-isolation",
              label: "Virus Isolation course",
              description: "First semester: phages from soil",
            },
            {
              to: "/teaching/virus-isolation/faq",
              label: "Lab calculations and common questions",
              description: "Titers, dilutions and lysate volumes",
            },
            {
              to: "/teaching/phage-bioinformatics",
              label: "Phage Bioinformatics course",
              description: "Second semester: genome annotation",
            },
          ],
        },
      ],
    },
    {
      label: "Tutorials",
      sections: [
        {
          links: [
            {
              to: "/teaching/central-dogma",
              label: "Central Dogma Tutorials",
              description: "Replication, transcription and translation",
            },
            { to: "/teaching/study-skills", label: "Study Skills Guide" },
          ],
        },
      ],
    },
    {
      sections: [
        { links: [{ to: "/teaching#join-the-lab", label: "Join the lab", description: "Research for undergraduates" }] },
      ],
    },
    { sections: [{ links: [{ to: "/teaching#teaching-philosophy", label: "Teaching philosophy" }] }] },
  ],
};

// Launches as a plain link: the panel opens once the first interest page exists (cutover.md).
const ABOUT: Menu = {
  id: "about",
  head: { to: "/about", label: "About Dustin" },
  beside: [
    { to: CV_PDF, label: "CV" },
    { to: "/contact", label: "Contact" },
  ],
  columns: [
    {
      label: "Interests",
      wide: true,
      launches: true,
      sections: [
        {
          links: [
            { to: "/interests/recipes", label: "Recipes", icon: "recipes" },
            { to: "/interests/travel", label: "Travel", icon: "travel" },
            { to: "/interests/games", label: "Games", icon: "games" },
            { to: "/interests/flying", label: "Flying", icon: "flying" },
            { to: "/interests/scuba", label: "Scuba", icon: "scuba" },
            { to: "/interests/art", label: "Art", icon: "art" },
          ],
        },
      ],
    },
  ],
};

/**
 * The pages outside the markdown set that a menu links to. test/nav.test.mjs holds each against
 * app/routes.ts, so a route removed there cannot leave a menu link behind.
 */
export const ROUTED_PATHS: readonly string[] = ["/research/publications", "/about"];

/**
 * Whether a menu link has a page to land on: a listed markdown page (for an anchor, a listed heading
 * on it), one of ROUTED_PATHS, or another site. Anything else is a page not yet written, and its link
 * stays out of the menu until it is, so no menu link answers 404.
 */
export function isLive(to: string): boolean {
  if (to.startsWith("https://")) return true;
  const anchored = to.includes("#");
  const path = anchored ? to.slice(0, to.indexOf("#")) : to;
  if ((CONTENT_PAGE_PATHS as readonly string[]).includes(path)) {
    return !anchored || CONTENT_PAGE_SECTIONS.includes(to);
  }
  return !anchored && ROUTED_PATHS.includes(path);
}

/**
 * The menu with every link that has no page taken out, and the sections and columns that empties.
 * Undefined when nothing is left, or a launching column is empty: the word is then a plain link.
 */
export function liveMenu(menu: Menu, live: (to: string) => boolean = isLive): Menu | undefined {
  const columns = menu.columns
    .map((column) => ({
      ...column,
      sections: column.sections
        .map((section) => ({ ...section, links: section.links.filter((link) => live(link.to)) }))
        .filter((section) => section.links.length > 0),
    }))
    .filter((column) => column.sections.length > 0);
  const launched = menu.columns.every((column) => !column.launches || columns.some((c) => c.label === column.label));
  if (columns.length === 0 || !launched) return undefined;
  return { ...menu, beside: menu.beside?.filter((link) => live(link.to)), columns };
}

/** The menus as written, before any link is taken out, for tests that bring a page into being. */
export const MENUS = { research: RESEARCH, teaching: TEACHING, about: ABOUT } as const;

export const NAV: readonly NavItem[] = [
  { to: "/research", label: "Research", menu: liveMenu(RESEARCH) },
  { to: "/teaching", label: "Teaching", menu: liveMenu(TEACHING) },
  { to: "/writing", label: "Writing" },
  { to: "/projects", label: "Projects" },
  { to: "/playground", label: "Playground" },
  { to: "/about", label: "About", menu: liveMenu(ABOUT) },
];
