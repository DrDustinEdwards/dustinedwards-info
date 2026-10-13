import { listBlogPosts, listBlogSeries, listBlogTags, nextScheduledPublishAt } from "~/db";
import { listPublishedPageTitles } from "~/db/pages";
import { listPublishedProcedures } from "~/db/procedures";
import { listRegistry } from "~/db/registry";
import { listPublishedPublications } from "~/db/publications";
import { BASES } from "~/kb/bases.mjs";
import { LIBRARY_BASES } from "~/kb/libraries.mjs";
import { KINDS } from "~/kb/registry/kinds.mjs";
import { LAB_PATH, hasItemPage, itemPath, kindPath } from "~/kb/registry/catalog.mjs";
import { REGISTRY_CACHE_TAG } from "~/kb/registry/route";
import { CONTENT_PAGE_PATHS, CONTENT_PAGES_FROM_DATA, CONTENT_PAGES_OWN_ROUTE } from "~/lib/content-pages.mjs";
import { CONTENT_PAGES_CACHE_TAG } from "~/lib/pages/route";
import { paperPath } from "~/lib/publications/paths.mjs";
import { POSTS_AND_PROCEDURES_CACHE_TAGS } from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import type { SiteUrl, Tally } from "~/lib/site-map.mjs";
import { loadSystemModel, systemPath } from "~/lib/systems.mjs";
import { tagPath } from "~/lib/tag-path.mjs";
import systemModel from "../../data/system-model.json";

/**
 * The public pages with a route of their own, each with the title the site map shows. Kept in step with
 * `routes.ts` by hand: every public page route is listed here, drawn from data below, or exempted by name
 * in test/site-map.test.mjs with a reason. check:links resolves each one. In the order the sitemap lists
 * them; a page with a row of its own (About) is listed only while its row is published.
 */
export const STATIC_PAGES = [
  { path: "/", title: "Home" },
  { path: "/about", title: "About" },
  { path: "/writing", title: "Articles" },
  { path: "/research/publications", title: "Publications" },
  { path: "/contact", title: "Contact" },
  // SITE_MAP_PATH, written out so check:links can read it off the syntax; test/site-map.test.mjs holds the two equal.
  { path: "/site-map", title: "Site map" },
  { path: "/colophon", title: "Colophon" },
  { path: "/systems", title: "System map" },
] as const;

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

const kindTitle = (kind: string) => {
  const plural = KINDS[kind as keyof typeof KINDS]?.plural ?? kind;
  return plural.charAt(0).toUpperCase() + plural.slice(1);
};

/**
 * Every public URL, the one list sitemap.xml and the site map page are both drawn from (CLAUDE.md, every
 * fact stored once). Drafts, unpublished rows and empty libraries are left out here, so neither can list
 * one. Also returns the next scheduled publish, which both use for the edge cache's lifetime.
 */
export async function gatherSiteUrls(env: Env): Promise<{ urls: SiteUrl[]; nextPublishAt: Date | null }> {
  /* No `kind = 'page'` read: both writers into `posts` write only 'post'. Recheck that before relying on it. */
  const [blog, tagList, seriesList, nextPublishAt, procedureRows, papers, pageTitles, registryItems] = await Promise.all([
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
  ]);
  const titleOf = (path: string) => pageTitles.get(path) ?? DATA_PAGE_TITLES[path];
  const none = null as Date | null;

  const urls: SiteUrl[] = [
    // A page with a route of its own (About) is listed in its place, and only while its row is published.
    ...STATIC_PAGES.filter(({ path }) => !CONTENT_PAGES_OWN_ROUTE.includes(path) || pageTitles.has(path)).map(({ path, title }) => ({
      path,
      lastmod: none,
      title: pageTitles.get(path) ?? title,
    })),
    // In the registry's order, which is the order the sitemap has always listed them in.
    ...CONTENT_PAGE_PATHS.filter((path) => CONTENT_PAGES_FROM_DATA.includes(path) || pageTitles.has(path)).map((path) => ({
      path,
      lastmod: none,
      title: titleOf(path) ?? path,
    })),
    /*
     * No `lastmod`: one commit date would mark every paper changed together, which teaches crawlers to
     * ignore the field. No showcase filter: a crawler has no double-counting problem.
     */
    ...papers.map((p) => ({ path: paperPath(p.slug), lastmod: none, title: p.title, tally: PAPERS })),
    // A knowledge base's library is listed once it has a published entry; until then it is not a page (kb-library.tsx).
    ...LIBRARY_BASES.filter((base) => procedureRows.some((p) => p.path.startsWith(base.entryRoot))).map((base) => ({
      path: base.library,
      lastmod: none,
      title: base.name,
    })),
    ...procedureRows.map((p) => ({
      path: p.path,
      lastmod: p.updated ? new Date(`${p.updated}T00:00:00.000Z`) : null,
      title: p.title,
      tally: procedureTally(p.path),
    })),
    // Each system's page (app/lib/systems.mjs), from the committed model; /systems itself is a static page. Titled
    // with the map's name, because several systems share a name with a Software page (Capsid, Carrel).
    ...loadSystemModel(systemModel).systems.map((s) => ({ path: systemPath(s.id), lastmod: none, title: `System map: ${s.name}` })),
    // The registry's inventory, each kind that has an item, and each item. No `lastmod`: a row's sync time is not the
    // date a fact changed.
    { path: LAB_PATH, lastmod: none, title: "Lab registry" },
    ...[...new Set(registryItems.map((item) => item.kind))].map((kind) => ({ path: kindPath(kind), lastmod: none, title: kindTitle(kind) })),
    ...registryItems
      .filter((item) => hasItemPage(item.kind))
      .map((item) => ({ path: itemPath(item.kind, item.id), lastmod: none, title: item.name, tally: REGISTRY_ITEMS })),
    ...blog.posts.map((p) => ({ path: `/writing/${p.slug}`, lastmod: p.updatedAt, title: p.title, tally: POSTS })),
    /* No `lastmod`: a tag has no modification date of its own. */
    ...tagList.map((t) => ({ path: tagPath(t.slug), lastmod: none, title: t.name, tally: TAGS })),
    ...seriesList.flatMap((row) => (row.name === null ? [] : [{ path: seriesPath(row.name), lastmod: none, title: row.name }])),
  ];
  return { urls, nextPublishAt };
}
