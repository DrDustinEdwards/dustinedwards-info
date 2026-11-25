// Relative imports, so test/nav.test.mjs can import this file under plain node.
import { CONTENT_PAGE_PATHS, CONTENT_PAGE_SECTIONS } from "./content-pages.mjs";
import { CV_PDF_PATH } from "./cv/entries.mjs";
import { NAV_DATA } from "./nav-data.generated.mjs";
import { seriesSlug } from "./series-path.mjs";
import { BASES } from "../kb/bases.mjs";
import { paperPath } from "./publications/paths.mjs";
import {
  aboutMenu,
  researchMenu,
  softwareMenu,
  teachingMenu,
  visiblePosts,
  writingMenu,
  type Menu,
  type NavItem,
} from "./nav-menus.ts";

/**
 * The pages outside the markdown set that a panel links to. test/nav.test.mjs holds each against
 * app/routes.ts, so a route removed there cannot leave a panel link behind.
 */
const ROUTED_PATHS: readonly string[] = [
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
 * The "does this link have a page" test for a moment `now`, built once so the visible posts, tags and
 * series are not recomputed per link. Anything not a listed page, routed path, library with entries,
 * visible post/tag/series, the newest paper or another site stays out of the panel.
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
    if (path.startsWith(TAG_PREFIX))
      return tags.has(decodeURIComponent(path.slice(TAG_PREFIX.length)));
    if (path.startsWith(SERIES_PREFIX))
      return series.has(decodeURIComponent(path.slice(SERIES_PREFIX.length)));
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
    ...menu.rows.flatMap((row) => [
      ...(row.to ? [row.to] : []),
      ...(row.links ?? []).map((link) => link.to),
    ]),
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
 * The header's five items with their live panels, as of `now`. Posts, newest paper and lab town are a
 * build-time snapshot (nav-data.generated.mjs); a post scheduled for later appears on the first
 * uncached render after its time.
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
export const NAV: readonly Pick<NavItem, "to" | "label">[] = SECTIONS.map(({ to, label }) => ({
  to,
  label,
}));
