// Relative, so test/nav.test.mjs can import this file under plain node.
import { CONTENT_PAGE_PATHS, CONTENT_PAGE_SECTIONS } from "./content-pages.mjs";
import { CV_PDF_PATH } from "./cv/entries.mjs";
import { IDENTITY } from "./identity.generated.mjs";
import { longDateUTC } from "./long-date.mjs";
import { NAV_DATA } from "./nav-data.generated.mjs";
import { OWNER_ORCID, OWNER_PUBMED, OWNER_SCHOLAR } from "./seo.ts";
import { seriesPath, seriesSlug } from "./series-path.mjs";
import { tagPath } from "./tag-path.mjs";
import { BASES } from "../kb/bases.mjs";
import { paperPath } from "./publications/paths.mjs";
import { EXPLORER_ORIGIN } from "./systems.mjs";

/*
 * The header's five destinations and the panels that hang from them ("structured panels", decided
 * 2026-10-11). Every panel has the same parts, top to bottom: a header band, a row of three tiles, a
 * band of grouped rows beside one spotlight, and three quick links. A link whose page does not exist is
 * left out (isLive), and so is a row or tile it empties, so no panel link answers 404.
 *
 * The facts a panel shows come from the repository, not from a request: the newest paper, the posts and
 * the lab's town are in nav-data.generated.mjs (scripts/lib/nav-data.mjs, written at build).
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
 * One grouped row of the left half. `title` is a link when `to` is set; `note` is plain text under it;
 * `links` are links under it, shown on one line separated by middots.
 */
export type MenuRow = { icon: NavIcon; title: string; to?: string; note?: string; links?: MenuLink[] };

/** The one block of the right half. */
type Spotlight = {
  kind: "text" | "map";
  eyebrow: string;
  /** An icon in a round well above the title (Join the lab). */
  icon?: NavIcon;
  title: string;
  body?: string;
  to: string;
};

export type Menu = {
  /** Names the panel and its button: `site-nav-research`. */
  id: string;
  icon: NavIcon;
  /** Initials in the band's well in place of the icon (About, which is the person). */
  badge?: string;
  /** The band's first line. */
  heading: string;
  /** The band's one-line description. */
  blurb: string;
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
  { to: "/software/foxhound", label: "Foxhound", description: "Failed Stripe payment recovery", icon: "card" },
  { to: "/software/foxing", label: "Foxing", description: "Public-domain reading", icon: "science-education" },
  { to: "/software/foxing-edu", label: "Foxing Edu", description: "Foxing, sold to schools", icon: "teaching" },
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

function researchMenu(): Menu {
  return {
    id: "research",
    icon: "research",
    heading: "Research",
    blurb: "Retroviruses, bacteriophages and science education",
    tiles: RESEARCH_AREAS,
    rows: [
      { icon: "publications", title: "Publications", to: "/research/publications", note: "Every paper, with BibTeX and RIS" },
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
          eyebrow: "Latest paper",
          title: NAV_DATA.latestPaper.title,
          body: [NAV_DATA.latestPaper.journal, NAV_DATA.latestPaper.year].filter(Boolean).join(", "),
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

/** A course tile; its line is the course page's own front matter description, read at build (scripts/lib/nav-data.mjs). */
function courseTile(to: string, label: string, icon: NavIcon): MenuLink {
  const description = (NAV_DATA.courses as Record<string, string> | undefined)?.[to];
  return description ? { to, label, icon, description } : { to, label, icon };
}

function teachingMenu(): Menu {
  return {
    id: "teaching",
    icon: "teaching",
    heading: "Teaching",
    blurb: "Courses, study help and joining the lab",
    tiles: [
      courseTile("/teaching/phage-discovery", "Phage Discovery Program", "bacteriophages"),
      courseTile("/teaching/virus-isolation", "Virus Isolation", "research"),
      courseTile("/teaching/phage-bioinformatics", "Phage Bioinformatics", "software"),
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
      { icon: "mail", title: "Questions about a course", links: [{ to: "/contact", label: "Contact" }] },
    ],
    spotlight: {
      kind: "text",
      eyebrow: "Prospective students",
      icon: "users",
      title: "Join the lab",
      body: "Undergraduate research beyond the courses",
      to: "/teaching#join-the-lab",
    },
    footer: [
      { to: "/teaching", label: "All teaching", icon: "arrow" },
      { to: "/teaching#join-the-lab", label: "Join the lab", icon: "users" },
      { to: "/contact", label: "Contact", icon: "mail" },
    ],
  };
}

function softwareMenu(): Menu {
  return {
    id: "software",
    icon: "software",
    heading: "Software",
    blurb: "Products, the open tools behind them, and how it fits together",
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
      { icon: "doc", title: "Software how-tos", to: "/software/how-tos", note: "Step-by-step guides" },
    ],
    spotlight: {
      kind: "map",
      eyebrow: "System map",
      title: "How the systems fit together",
      body: "Every system and what it connects to, with the Capsid explorer for the detail",
      to: "/systems",
    },
    footer: [
      { to: "/software", label: "All software", icon: "arrow" },
      { to: "/systems", label: "System map", icon: "map" },
      { to: `${EXPLORER_ORIGIN}/`, label: "Capsid explorer", icon: "search" },
    ],
  };
}

function writingMenu(now: number): Menu {
  const posts = visiblePosts(now);
  const newest = posts[0];
  const tags = counted(posts.flatMap((post) => post.tags)).slice(0, TAGS_SHOWN);
  const series = counted(posts.flatMap((post) => (post.series ? [post.series] : []))).slice(0, SERIES_SHOWN);
  return {
    id: "writing",
    icon: "writing",
    heading: "Writing",
    blurb: "Articles, series and tags",
    tiles: posts.slice(0, 3).map((post) => ({
      to: `/writing/${post.slug}`,
      label: post.title,
      description: longDateUTC(post.publishAt) ?? undefined,
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
      ? { kind: "text", eyebrow: "Newest", title: newest.title, body: newest.firstLine, to: `/writing/${newest.slug}` }
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

function aboutMenu(): Menu {
  return {
    id: "about",
    icon: "about",
    badge: initials(IDENTITY.name),
    // The band states the person and the whole identity line, university system included.
    heading: IDENTITY.name,
    blurb: `${IDENTITY.role}, ${IDENTITY.department}, ${IDENTITY.org}`,
    tiles: [
      { to: "/about", label: "About", icon: "about" },
      { to: "/cv", label: "CV", icon: "publications", also: { to: CV_PDF_PATH, label: "Also as a PDF" } },
      { to: "/contact", label: "Contact", icon: "mail" },
    ],
    rows: [
      { icon: "recipes", title: "Interests", links: [{ to: "/recipes", label: "Recipes" }] },
      { icon: "colophon", title: "Colophon", to: "/colophon", note: "How this site is built" },
    ],
    spotlight: {
      kind: "text",
      eyebrow: "The lab",
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


/**
 * The pages outside the markdown set that a panel links to. test/nav.test.mjs holds each against
 * app/routes.ts, so a route removed there cannot leave a panel link behind.
 */
export const ROUTED_PATHS: readonly string[] = [
  "/research/publications",
  "/research/lab",
  "/systems",
  "/search",
  "/writing",
  "/writing/rss.xml",
  "/about",
  "/contact",
  "/colophon",
  CV_PDF_PATH,
];

/** The prefixes whose pages are data: a post, a tag, a series, the newest paper. */
const POST_PREFIX = "/writing/";
const TAG_PREFIX = "/writing/tags/";
const SERIES_PREFIX = "/writing/series/";
const PAPER_PREFIX = "/research/publications/";

/**
 * The test for "does this link have a page", built once for a moment `now`: the visible posts, their tag
 * set and series set are worked out here, not again for every link. A listed markdown page (for an anchor,
 * a listed heading on it), one of ROUTED_PATHS, a library that has an entry, a post, tag or series the
 * visible posts have, the newest paper, or another site is live. Anything else is a page not yet written,
 * and its link stays out of the panel until it is.
 */
function makeLive(now: number = Date.now()): (to: string) => boolean {
  const posts = visiblePosts(now);
  const postPaths = new Set(posts.map((post) => `${POST_PREFIX}${post.slug}`));
  const tags = new Set(posts.flatMap((post) => post.tags));
  const series = new Set(posts.flatMap((post) => (post.series ? [seriesSlug(post.series)] : [])));
  const paper = NAV_DATA.latestPaper ? paperPath(NAV_DATA.latestPaper.slug) : null;
  return (to) => {
    if (to.startsWith("https://")) return true;
    const anchored = to.includes("#");
    const path = anchored ? to.slice(0, to.indexOf("#")) : to;
    if ((CONTENT_PAGE_PATHS as readonly string[]).includes(path)) {
      return !anchored || CONTENT_PAGE_SECTIONS.includes(to);
    }
    if (anchored) return false;
    if (ROUTED_PATHS.includes(path)) return true;
    const library = BASES.find((base) => base.library === path && base.profile !== "protocol");
    if (library) return (NAV_DATA.libraries[library.profile] ?? 0) > 0;
    if (path.startsWith(TAG_PREFIX)) return tags.has(decodeURIComponent(path.slice(TAG_PREFIX.length)));
    if (path.startsWith(SERIES_PREFIX)) return series.has(decodeURIComponent(path.slice(SERIES_PREFIX.length)));
    if (path.startsWith(PAPER_PREFIX)) return path === paper;
    if (path.startsWith(POST_PREFIX)) return postPaths.has(path);
    return false;
  };
}

/** One link, as of `now`. Builds the whole test each call, so a caller with many links uses `makeLive`. */
export function isLive(to: string, now: number = Date.now()): boolean {
  return makeLive(now)(to);
}

/**
 * The menu with every link that has no page taken out, and the tile, row or spotlight that empties. Undefined
 * only when nothing is left to show. A row whose title page is missing keeps its links as plain text above them.
 */
export function liveMenu(menu: Menu, live: (to: string) => boolean = makeLive()): Menu | undefined {
  const tiles = menu.tiles
    .filter((tile) => live(tile.to))
    .map((tile) => (tile.also && !live(tile.also.to) ? { ...tile, also: undefined } : tile));
  const rows = menu.rows
    .map((row) => ({
      ...row,
      to: row.to && live(row.to) ? row.to : undefined,
      links: row.links?.filter((link) => live(link.to)),
    }))
    .filter((row) => row.to || (row.links && row.links.length > 0));
  const footer = menu.footer.filter((link) => live(link.to));
  const spotlight = menu.spotlight && live(menu.spotlight.to) ? menu.spotlight : undefined;
  if (tiles.length === 0 && rows.length === 0 && footer.length === 0) return undefined;
  return { ...menu, tiles, rows, spotlight, footer };
}

/** Every address a panel renders, in page order: tiles (and their second links), rows, the spotlight, the quick links. */
export function menuLinks(menu: Menu): string[] {
  return [
    ...menu.tiles.flatMap((tile) => (tile.also ? [tile.to, tile.also.to] : [tile.to])),
    ...menu.rows.flatMap((row) => [...(row.to ? [row.to] : []), ...(row.links ?? []).map((link) => link.to)]),
    ...(menu.spotlight ? [menu.spotlight.to] : []),
    ...menu.footer.map((link) => link.to),
  ];
}

/** The panels as written, before any link is taken out, for tests that bring a page into being. */
export function menusAt(now: number = Date.now()) {
  return {
    research: researchMenu(),
    teaching: teachingMenu(),
    software: softwareMenu(),
    writing: writingMenu(now),
    about: aboutMenu(),
  } as const;
}

/** The five sections, once: the panel id, the hub it lives under and the label on its button. */
const SECTIONS = [
  { id: "research", to: "/research", label: "Research" },
  { id: "teaching", to: "/teaching", label: "Teaching" },
  { id: "software", to: "/software", label: "Software" },
  { id: "writing", to: "/writing", label: "Writing" },
  { id: "about", to: "/about", label: "About" },
] as const;

/**
 * The header's five items with their live panels, as of `now`. The posts, the newest paper and the lab's town
 * are a snapshot taken at build (nav-data.generated.mjs), so a post published, withdrawn or deleted in the
 * editor shows here after the next deploy (a merge, or the six-hourly rebuild from D1), and an edge-cached page
 * keeps the header it was rendered with for up to a day. A post scheduled for later is in the snapshot and
 * left out until `now` passes its time, so it appears on the first uncached render after that, not on the dot.
 */
export function buildNav(now: number = Date.now()): readonly NavItem[] {
  const menus = menusAt(now);
  const live = makeLive(now);
  const items: NavItem[] = [];
  for (const { id, to, label } of SECTIONS) {
    const resolved = liveMenu(menus[id], live);
    if (resolved) items.push({ to, label, menu: resolved });
  }
  return items;
}

/** The names and hubs of the five, for lists that need no panel (the 404 page). */
export const NAV: readonly Pick<NavItem, "to" | "label">[] = SECTIONS.map(({ to, label }) => ({ to, label }));
