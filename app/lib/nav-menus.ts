import { CV_PDF_PATH } from "./cv/entries.mjs";
import { IDENTITY } from "./identity.generated.mjs";
import { formatDate } from "capsomer/behavior/time";
import { NAV_DATA } from "./nav-data.generated.mjs";
import { OWNER_ORCID, OWNER_PUBMED, OWNER_SCHOLAR } from "./seo.ts";
import { seriesPath } from "./series-path.mjs";
import { tagPath } from "./tag-path.mjs";
import { paperPath } from "./publications/paths.mjs";
import { EXPLORER_ORIGIN } from "capsomer/behavior/system-model";

/*
 * Content of the header's five panels: header band, three tiles, grouped rows beside one spotlight,
 * three quick links. Facts come from the build snapshot nav-data.generated.mjs, not a request;
 * nav.ts drops the links whose pages do not exist.
 */

/** A line icon, drawn in site-nav-panel.tsx. */
export type NavIcon =
  | "retroviruses"
  | "bacteriophages"
  | "science-education"
  | "recipes"
  | "research"
  | "teaching"
  | "software"
  | "writing"
  | "about"
  | "publications"
  | "collections"
  | "methods"
  | "help"
  | "chat"
  | "tools"
  | "series"
  | "tag"
  | "colophon"
  | "arrow"
  | "rss"
  | "search"
  | "mail"
  | "external"
  | "users"
  | "map"
  | "explorer"
  | "card"
  | "doc"
  | "file";

export type MenuLink = {
  to: string;
  label: string;
  description?: string;
  icon?: NavIcon;
  /** A second, smaller link under a tile: the CV tile's PDF. */
  also?: { to: string; label: string };
};

/**
 * One grouped row of the left half. `title` is a link when `to` is set;
 * `links` are links under it, shown on one line separated by middots.
 */
export type MenuRow = {
  icon: NavIcon;
  title: string;
  to?: string;
  links?: MenuLink[];
};

/** The one block of the right half. */
type Spotlight = {
  kind: "text" | "map";
  /** An icon in a round well above the title (Join the lab). */
  icon?: NavIcon;
  title: string;
  body?: string;
  to: string;
};

export type Menu = {
  /** The section's id in Capsomer's header, which ends its panel's id: `research`. */
  id: string;
  icon: NavIcon;
  /** Initials in the band's well in place of the icon (About, which is the person). */
  badge?: string;
  /** The band's first line. */
  heading: string;
  tiles: MenuLink[];
  rows: MenuRow[];
  spotlight?: Spotlight;
  footer: MenuLink[];
};

export type NavItem = { to: string; label: string; menu: Menu };

/** The three research areas, in the Research panel and on the home page. */
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

// The three products only. Germomics, TXASM, Capsid and this site stay off the tiles.
export const SOFTWARE_PRODUCTS: MenuLink[] = [
  {
    to: "/software/foxhound",
    label: "Foxhound",
    description: "Failed Stripe payment recovery",
    icon: "card",
  },
  {
    to: "/software/foxing",
    label: "Foxing",
    description: "Public-domain reading",
    icon: "science-education",
  },
  {
    to: "/software/foxing-edu",
    label: "Foxing Edu",
    description: "Foxing, sold to schools",
    icon: "teaching",
  },
];

/** The posts in the build snapshot a reader can see at `now`: past any scheduled time, newest first. Drafts never enter the snapshot. */
export function visiblePosts(now: number = Date.now()) {
  return NAV_DATA.posts.filter((post) => Date.parse(post.publishAt) <= now);
}

/** Tags and series of the visible posts, most used first (then A to Z), with their counts. */
function counted(names: string[]) {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
}

/** How many tags the Writing panel lists, and how many series. */
const TAGS_SHOWN = 4;
const SERIES_SHOWN = 4;

export function researchMenu(): Menu {
  return {
    id: "research",
    icon: "research",
    heading: "Research",
    tiles: RESEARCH_AREAS,
    rows: [
      {
        icon: "publications",
        title: "Publications",
        to: "/research/publications",
      },
      {
        icon: "collections",
        title: "Collections",
        links: [
          { to: "/research/phages", label: "Phages" },
          { to: "/research/lab", label: "Lab registry" },
        ],
      },
      {
        icon: "methods",
        title: "Lab methods",
        links: [
          { to: "/research/protocols", label: "Protocols" },
          { to: "/research/tools", label: "Tools" },
        ],
      },
    ],
    // None when the build found no published paper: the panel then has no spotlight (test/nav.test.mjs says so).
    spotlight: NAV_DATA.latestPaper
      ? {
          kind: "text",
          title: NAV_DATA.latestPaper.title,
          body: [NAV_DATA.latestPaper.journal, NAV_DATA.latestPaper.year]
            .filter(Boolean)
            .join(", "),
          to: paperPath(NAV_DATA.latestPaper.slug),
        }
      : undefined,
    footer: [
      { to: "/research", label: "All research", icon: "arrow" },
      { to: "/research/publications", label: "Publications", icon: "publications" },
      { to: "/research/protocols", label: "Protocols", icon: "methods" },
    ],
  };
}

export function teachingMenu(): Menu {
  return {
    id: "teaching",
    icon: "teaching",
    heading: "Teaching",
    tiles: [
      { to: "/teaching/phage-discovery", label: "Phage Discovery Program", icon: "bacteriophages" },
      { to: "/teaching/virus-isolation", label: "Virus Isolation", icon: "research" },
      { to: "/teaching/phage-bioinformatics", label: "Phage Bioinformatics", icon: "software" },
    ],
    rows: [
      {
        icon: "publications",
        title: "Study help",
        links: [
          { to: "/teaching/central-dogma", label: "Tutorials" },
          { to: "/teaching/study-skills", label: "Study skills" },
        ],
      },
      {
        icon: "mail",
        title: "Questions about a course",
        links: [{ to: "/contact", label: "Contact" }],
      },
    ],
    spotlight: {
      kind: "text",
      icon: "users",
      title: "Join the lab",
      to: "/teaching#join-the-lab",
    },
    footer: [
      { to: "/teaching", label: "All teaching", icon: "arrow" },
      { to: "/teaching#join-the-lab", label: "Join the lab", icon: "users" },
      { to: "/contact", label: "Contact", icon: "mail" },
    ],
  };
}

export function softwareMenu(): Menu {
  return {
    id: "software",
    icon: "software",
    heading: "Software",
    tiles: SOFTWARE_PRODUCTS,
    rows: [
      {
        icon: "tools",
        title: "Open tools",
        links: [
          { to: "/software/capsid", label: "Capsid" },
          { to: "/software/carrel", label: "Carrel" },
          { to: "/software/capsomer", label: "Capsomer" },
          { to: "/software/enarratio", label: "Enarratio" },
        ],
      },
      {
        icon: "doc",
        title: "Software how-tos",
        to: "/software/how-tos",
      },
    ],
    spotlight: {
      kind: "map",
      title: "How the systems fit together",
      to: "/systems",
    },
    footer: [
      { to: "/software", label: "All software", icon: "arrow" },
      { to: "/systems", label: "System map", icon: "map" },
      { to: `${EXPLORER_ORIGIN}/`, label: "Capsid explorer", icon: "search" },
    ],
  };
}

export function writingMenu(now: number): Menu {
  const posts = visiblePosts(now);
  const newest = posts[0];
  const tags = counted(posts.flatMap((post) => post.tags)).slice(0, TAGS_SHOWN);
  const series = counted(posts.flatMap((post) => (post.series ? [post.series] : []))).slice(
    0,
    SERIES_SHOWN,
  );
  return {
    id: "writing",
    icon: "writing",
    heading: "Writing",
    tiles: posts.slice(0, 3).map((post) => ({
      to: `/writing/${post.slug}`,
      label: post.title,
      description: formatDate(post.publishAt) ?? undefined,
    })),
    rows: [
      {
        icon: "series",
        title: "Series",
        links: series.map(({ name }) => ({ to: seriesPath(name), label: name })),
      },
      {
        icon: "tag",
        title: "Tags",
        links: tags.map(({ name }) => ({ to: tagPath(name), label: name })),
      },
    ],
    spotlight: newest
      ? {
          kind: "text",
          title: newest.title,
          body: newest.firstLine,
          to: `/writing/${newest.slug}`,
        }
      : undefined,
    footer: [
      { to: "/writing", label: "All articles", icon: "arrow" },
      { to: "/writing/rss.xml", label: "RSS feed", icon: "rss" },
      { to: "/search", label: "Search", icon: "search" },
    ],
  };
}

/** "Dustin Edwards" to "DE": the first letter of each word. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function aboutMenu(): Menu {
  return {
    id: "about",
    icon: "about",
    badge: initials(IDENTITY.name),
    // The band states the person and the whole identity line, university system included.
    heading: IDENTITY.name,
    tiles: [
      { to: "/about", label: "About", icon: "about" },
      {
        to: "/cv",
        label: "CV",
        icon: "publications",
        also: { to: CV_PDF_PATH, label: "Also as a PDF" },
      },
      { to: "/contact", label: "Contact", icon: "mail" },
    ],
    rows: [
      { icon: "recipes", title: "Interests", links: [{ to: "/recipes", label: "Recipes" }] },
      { icon: "colophon", title: "Colophon", to: "/colophon" },
    ],
    spotlight: {
      kind: "text",
      title: NAV_DATA.lab.department,
      body: [NAV_DATA.lab.university, NAV_DATA.lab.place].filter(Boolean).join(", "),
      to: "/research",
    },
    footer: [
      { to: OWNER_SCHOLAR, label: "Google Scholar", icon: "publications" },
      { to: OWNER_PUBMED, label: "PubMed", icon: "file" },
      { to: OWNER_ORCID, label: "ORCID", icon: "about" },
    ],
  };
}
