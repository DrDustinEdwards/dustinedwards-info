import { listBlogPosts, listBlogSeries, listBlogTags, nextScheduledPublishAt } from "~/db";
import { listPublishedPageSources, listPublishedPageTitles } from "~/db/pages";
import { listPostsWithImages } from "~/db/posts";
import { listPublishedProcedures } from "~/db/procedures";
import { listPublishedRegistrySources, listRegistry } from "~/db/registry";
import { listRoster } from "~/db/roster";
import { listPublishedPublicationSources, listPublishedPublications } from "~/db/publications";
import { BASES } from "~/kb/bases.mjs";
import { LIBRARY_BASES } from "~/kb/libraries.mjs";
import { KINDS } from "~/kb/registry/kinds.mjs";
import { LAB_PATH, hasItemPage, itemPath, kindPath } from "~/kb/registry/catalog.mjs";
import { REGISTRY_CACHE_TAG } from "~/kb/registry/route";
import { CONTENT_PAGE_PATHS, CONTENT_PAGES_FROM_DATA, CONTENT_PAGES_OWN_ROUTE } from "~/lib/content-pages.mjs";
import { CONTENT_PAGES_CACHE_TAG } from "~/lib/pages/route";
import { paperPath } from "~/lib/publications/paths.mjs";
import { mediaSrc } from "~/lib/media/images.mjs";
import { ROSTER_PAGE_PATH } from "~/lib/roster/compile.mjs";
import { OWNER_PHOTO, POSTS_AND_PROCEDURES_CACHE_TAGS } from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import type { SiteUrl, Tally } from "~/lib/site-map.mjs";
import { SOURCE_DATES } from "~/lib/source-dates.generated.mjs";
import { tagPath } from "~/lib/tag-path.mjs";

/**
 * The public pages with a route of their own, each with the title the site map shows. Kept in step with
 * `routes.ts` by hand: every public page route is listed here, drawn from data below, or exempted by name in
 * test/site-map.test.mjs with a reason. check:links resolves each one. In the order the sitemap lists
 * them; a page with a row of its own (About) is listed only while its row is published. `sources` are the
 * files the page's own words live in, which date it (an index is also as new as the newest thing it lists).
 * @public read by test/site-map.test.mjs and check:links
 */
export const STATIC_PAGES = [
  { path: "/", title: "Home", sources: ["app/routes/home.tsx"] },
  { path: "/about", title: "About", sources: ["app/routes/about.tsx"] },
  { path: "/writing", title: "Articles", sources: ["app/routes/blog._index.tsx"] },
  { path: "/research/publications", title: "Publications", sources: ["app/routes/publications.tsx"] },
  { path: "/contact", title: "Contact", sources: ["app/routes/contact.tsx"] },
  // SITE_MAP_PATH, written out so check:links can read it off the syntax; test/site-map.test.mjs holds the two equal.
  { path: "/site-map", title: "Site map", sources: ["app/routes/site-map.tsx"] },
  { path: "/colophon", title: "Colophon", sources: ["app/routes/colophon.tsx", "content/stack-notes.json"] },
  { path: "/systems", title: "System map", sources: ["app/routes/systems.tsx", "data/system-model.json"] },
] as const;

/** The CV, page and PDF, is made from its files and the papers it lists. */
const CV_SOURCE_TREES = ["content/cv/", "content/publications/"];

/** The CV is generated from data and has no page row (CONTENT_PAGES_FROM_DATA), so its title is stated here. */
const DATA_PAGE_TITLES: Record<string, string> = { "/cv": "CV" };

/**
 * Every document both lists, so a save that changes either is purged from both: posts, tags and series,
 * procedures, the prose pages and the registry.
 */
export const SITE_URLS_CACHE_TAGS = `${POSTS_AND_PROCEDURES_CACHE_TAGS},${CONTENT_PAGES_CACHE_TAG},${REGISTRY_CACHE_TAG}`;

const POSTS: Tally = { key: "posts", label: "Articles", to: "/writing", merge: true };
// No tag index page and no stable anchor on /writing's tag list, so the count is plain text (site-map.mjs).
const TAGS: Tally = { key: "tags", label: "Tags", to: "/writing", merge: false };
const PAPERS: Tally = { key: "papers", label: "Publications", to: "/research/publications", merge: true };
const REGISTRY_ITEMS: Tally = { key: "registry", label: "Lab registry", to: LAB_PATH, merge: true };

/** A procedure is counted under its base's library: Protocols, Software how-tos or Recipes. */
function procedureTally(path: string): Tally | undefined {
  const base = BASES.find((b) => path.startsWith(b.entryRoot));
  return base ? { key: `procedures:${base.id}`, label: base.name, to: base.library, merge: true } : undefined;
}

/** Each tracked file's last commit day (scripts/lib/source-dates.mjs). Empty when the build had no history. */
const DATES: Readonly<Record<string, string>> = SOURCE_DATES;

/** The newest of some dates, or null when there are none. */
function latest(dates: Iterable<Date | null | undefined>): Date | null {
  let newest: Date | null = null;
  for (const date of dates) if (date && (!newest || date > newest)) newest = date;
  return newest;
}

/** The day the newest of these files last changed, or null when none is dated. */
function sourceDate(files: Iterable<string | null | undefined>): Date | null {
  const days = [...files].map((file) => (file ? DATES[file] : undefined));
  return latest(days.map((day) => (day ? new Date(`${day}T00:00:00.000Z`) : null)));
}

/** The day the newest file under any of these directories last changed. */
const treeDate = (prefixes: readonly string[]) => sourceDate(Object.keys(DATES).filter((file) => prefixes.some((p) => file.startsWith(p))));

/** The images a page's HTML shows, as site paths. A diagram's dark twin is the same picture, so only its light one is listed. */
function imagesIn(html: string | null): string[] {
  const found = new Set<string>();
  for (const [tag] of (html ?? "").matchAll(/<img\b[^>]*>/g)) {
    const src = /\ssrc="(\/[^"/][^"]*)"/.exec(tag)?.[1];
    if (src && !/\bdiagram-dark\b/.test(tag)) found.add(src);
  }
  return [...found];
}

/** Files crawlers should find that are not pages, so the sitemap lists them and the site map page does not. */
export type SiteFile = { path: string; lastmod: Date | null };

const kindTitle = (kind: string) => {
  const plural = KINDS[kind as keyof typeof KINDS]?.plural ?? kind;
  return plural.charAt(0).toUpperCase() + plural.slice(1);
};

/**
 * Every public URL, the one list sitemap.xml and the site map page are both drawn from. Drafts,
 * unpublished rows and empty libraries are left out here, so neither can list one. Also returns the next
 * scheduled publish, which both use for the edge cache's lifetime, and the files only sitemap.xml lists.
 *
 * `lastmod` is the day the page's content last changed, never a sync or deploy time, which would mark every
 * page changed together and teach crawlers to ignore the field. A post or procedure uses the `updated` date
 * its author wrote; any other page uses its source file's last commit (scripts/lib/source-dates.mjs); an index,
 * tag or series is as new as the newest page it lists. With no dated source, `lastmod` is left out.
 */
export async function gatherSiteUrls(env: Env): Promise<{ urls: SiteUrl[]; files: SiteFile[]; nextPublishAt: Date | null }> {
  /* No `kind = 'page'` read: both writers into `posts` write only 'post'. Recheck that before relying on it. */
  const [
    blog,
    tagList,
    seriesList,
    nextPublishAt,
    procedureRows,
    papers,
    pageTitles,
    registryItems,
    pageSources,
    paperSources,
    registrySources,
    postsWithImages,
    cohorts,
  ] = await Promise.all([
    listBlogPosts(env, { perPage: 1000 }),
    listBlogTags(env),
    listBlogSeries(env),
    nextScheduledPublishAt(env),
    // Procedures live in D1, so one saved through the operator API is listed without a deploy.
    listPublishedProcedures(env),
    // Papers live in D1 too, so one saved through Carrel is listed without a deploy.
    listPublishedPublications(env),
    // The prose pages live in D1 too (docs/PAGES.md): a draft is left out, and so is a path whose row is missing.
    listPublishedPageTitles(env),
    // The lab registry lives in D1 too (docs/REGISTRY.md): an item saved through Carrel is listed without a deploy.
    listRegistry(env, { published: true }),
    listPublishedPageSources(env),
    listPublishedPublicationSources(env),
    listPublishedRegistrySources(env),
    listPostsWithImages(env),
    // The program page's cohort photos, for its image:image entries. A roster that cannot be read leaves them out
    // rather than taking the whole sitemap down with it; the page itself reports the fault.
    listRoster(env).catch(() => []),
  ]);
  const titleOf = (path: string) => pageTitles.get(path) ?? DATA_PAGE_TITLES[path];
  const cvDate = treeDate(CV_SOURCE_TREES);
  const pageDate = (path: string) => (CONTENT_PAGES_FROM_DATA.includes(path) ? cvDate : sourceDate([pageSources.get(path)]));
  const postImages = new Map(postsWithImages.map((p) => [p.slug, imagesIn(p.html)]));
  const itemSource = (item: { kind: string; id: string }) => registrySources.get(`${item.kind}/${item.id}`);

  const paperUrls = papers.map((p) => ({ path: paperPath(p.slug), lastmod: sourceDate([paperSources.get(p.slug)]), title: p.title, tally: PAPERS }));
  const procedureUrls = procedureRows.map((p) => ({
    path: p.path,
    lastmod: p.updated ? new Date(`${p.updated}T00:00:00.000Z`) : sourceDate([p.sourcePath]),
    title: p.title,
    tally: procedureTally(p.path),
  }));
  const itemDate = (kind?: string) => sourceDate(registryItems.filter((item) => !kind || item.kind === kind).map(itemSource));
  const postUrls = blog.posts.map((p) => {
    const images = postImages.get(p.slug) ?? [];
    return { path: `/writing/${p.slug}`, lastmod: p.updatedAt, title: p.title, tally: POSTS, ...(images.length > 0 ? { images } : {}) };
  });
  const newestPost = latest(postUrls.map((u) => u.lastmod));
  const newestPaper = latest(paperUrls.map((u) => u.lastmod));
  /** What an index lists makes it new, as well as its own words. */
  const listed: Record<string, Date | null> = {
    "/": latest([newestPost, newestPaper, ...procedureUrls.map((u) => u.lastmod)]),
    "/writing": newestPost,
    "/research/publications": newestPaper,
  };

  /** The pictures a page draws outside its prose, as the image sitemap lists them: About's portrait, the roster's photos. */
  const pageImages: Record<string, string[]> = {
    "/about": [`/media/${OWNER_PHOTO.key}`],
    [ROSTER_PAGE_PATH]: cohorts.flatMap((cohort) => (cohort.photo ? [mediaSrc(cohort.photo.src)] : [])),
  };
  const withImages = (path: string) => (pageImages[path]?.length ? { images: pageImages[path] } : {});

  const urls: SiteUrl[] = [
    // A page with a route of its own (About) is listed in its place, and only while its row is published.
    ...STATIC_PAGES.filter(({ path }) => !CONTENT_PAGES_OWN_ROUTE.includes(path) || pageTitles.has(path)).map(({ path, title, sources }) => ({
      path,
      lastmod: latest([sourceDate(sources), pageDate(path), listed[path]]),
      title: pageTitles.get(path) ?? title,
      ...withImages(path),
    })),
    // In the registry's order, which is the order the sitemap has always listed them in.
    ...CONTENT_PAGE_PATHS.filter((path) => CONTENT_PAGES_FROM_DATA.includes(path) || pageTitles.has(path)).map((path) => ({
      path,
      lastmod: pageDate(path),
      title: titleOf(path) ?? path,
      ...withImages(path),
    })),
    // No showcase filter: a crawler has no double-counting problem.
    ...paperUrls,
    // A knowledge base's library is listed once it has a published entry; until then it is not a page (kb-library.tsx).
    ...LIBRARY_BASES.filter((base) => procedureRows.some((p) => p.path.startsWith(base.entryRoot))).map((base) => ({
      path: base.library,
      lastmod: latest(procedureUrls.filter((u) => u.path.startsWith(base.entryRoot)).map((u) => u.lastmod)),
      title: base.name,
    })),
    ...procedureUrls,
    // The registry's inventory, each kind that has an item, and each item.
    { path: LAB_PATH, lastmod: itemDate(), title: "Lab registry" },
    ...[...new Set(registryItems.map((item) => item.kind))].map((kind) => ({ path: kindPath(kind), lastmod: itemDate(kind), title: kindTitle(kind) })),
    ...registryItems
      .filter((item) => hasItemPage(item.kind))
      .map((item) => ({ path: itemPath(item.kind, item.id), lastmod: sourceDate([itemSource(item)]), title: item.name, tally: REGISTRY_ITEMS })),
    ...postUrls,
    // A tag or series is as new as its newest post.
    ...tagList.map((t) => ({ path: tagPath(t.slug), lastmod: t.lastmod, title: t.name, tally: TAGS })),
    ...seriesList.flatMap((row) => (row.name === null ? [] : [{ path: seriesPath(row.name), lastmod: row.lastmod, title: row.name }])),
  ];
  // The site map page lists every page, so it is as new as the newest of them.
  const siteMap = urls.find((url) => url.path === "/site-map");
  if (siteMap) siteMap.lastmod = latest(urls.map((url) => url.lastmod));

  const files: SiteFile[] = [{ path: "/dustin-edwards-cv.pdf", lastmod: cvDate }];
  return { urls, files, nextPublishAt };
}
