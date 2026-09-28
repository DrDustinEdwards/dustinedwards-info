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

/** The three research areas, in the Research menu and on the home page. */
export const RESEARCH_AREAS: MenuLink[] = [
  {
    to: "/research/retroviruses",
    label: "Retroviruses",
    description: "HTLV-1, REV and LPDV",
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
];

const RESEARCH: Menu = {
  id: "research",
  head: { to: "/research", label: "All research", description: "Areas, phages, protocols and publications" },
  columns: [
    {
      label: "Research areas",
      sections: [
        {
          links: RESEARCH_AREAS,
        },
      ],
    },
    {
      label: "Collections",
      sections: [
        {
          links: [
            { to: "/research/publications", label: "Publications" },
            { to: "/research/phages", label: "Phages" },
            { to: "/research/protocols", label: "Protocols" },
            { to: "/research/tools", label: "Tools" },
          ],
        },
      ],
    },
  ],
};

// The three products only. Germomics, TXASM, Capsid and this site stay off the header.
export const SOFTWARE_PRODUCTS: MenuLink[] = [
  { to: "/software/foxhound", label: "Foxhound", description: "Failed Stripe payment recovery" },
  { to: "/software/foxing", label: "Foxing", description: "Public-domain reading" },
  { to: "/software/foxing-edu", label: "Foxing Edu", description: "Foxing, sold to schools" },
];

// Same panel as Research, with one short column. No new open/close behavior.
const SOFTWARE: Menu = {
  id: "software",
  head: { to: "/software", label: "All software" },
  columns: [{ sections: [{ links: SOFTWARE_PRODUCTS }] }],
};

// Same panel as Research, with one short column. No new open/close behavior.
const TEACHING: Menu = {
  id: "teaching",
  head: { to: "/teaching", label: "All teaching" },
  columns: [
    {
      sections: [
        {
          links: [
            { to: "/teaching/phage-discovery", label: "Phage Discovery Program" },
            { to: "/teaching/virus-isolation", label: "Virus Isolation" },
            { to: "/teaching/phage-bioinformatics", label: "Phage Bioinformatics" },
            { to: "/teaching/central-dogma", label: "Tutorials" },
            { to: "/teaching#join-the-lab", label: "Join the lab" },
          ],
        },
      ],
    },
  ],
};

// Interests stay in the data and out of the menu until a page exists. CV and Contact show now.
const ABOUT: Menu = {
  id: "about",
  head: { to: "/about", label: "About" },
  beside: [
    { to: CV_PDF, label: "CV" },
    { to: "/contact", label: "Contact" },
  ],
  columns: [
    {
      label: "Interests",
      wide: true,
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
export const ROUTED_PATHS: readonly string[] = ["/research/publications", "/about", "/contact"];

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
 * An empty column is omitted. It does not hide the head or the links beside it, so About can show
 * CV and Contact before any interest page exists. Undefined when the head itself has no page.
 */
export function liveMenu(menu: Menu, live: (to: string) => boolean = isLive): Menu | undefined {
  if (!live(menu.head.to)) return undefined;
  const columns = menu.columns
    .map((column) => ({
      ...column,
      sections: column.sections
        .map((section) => ({ ...section, links: section.links.filter((link) => live(link.to)) }))
        .filter((section) => section.links.length > 0),
    }))
    .filter((column) => column.sections.length > 0);
  const beside = menu.beside?.filter((link) => live(link.to));
  if (columns.length === 0 && (!beside || beside.length === 0)) return undefined;
  return { ...menu, beside, columns };
}

/** The menus as written, before any link is taken out, for tests that bring a page into being. */
export const MENUS = { research: RESEARCH, teaching: TEACHING, software: SOFTWARE, about: ABOUT } as const;

export const NAV: readonly NavItem[] = [
  { to: "/research", label: "Research", menu: liveMenu(RESEARCH) },
  { to: "/teaching", label: "Teaching", menu: liveMenu(TEACHING) },
  { to: "/software", label: "Software", menu: liveMenu(SOFTWARE) },
  { to: "/writing", label: "Writing" },
  { to: "/about", label: "About", menu: liveMenu(ABOUT) },
];
