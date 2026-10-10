import { listBlogPosts, listBlogSeries, listBlogTags, nextScheduledPublishAt } from "~/db";
import { listPublishedPagePaths } from "~/db/pages";
import { listPublishedProcedures } from "~/db/procedures";
import { listRegistry } from "~/db/registry";
import { listPublishedPublications } from "~/db/publications";
import { getEnv } from "~/lib/context";
import {
  EDGE_CACHE_HEADER,
  POSTS_AND_PROCEDURES_CACHE_TAGS,
  SHARED_CACHE_CONTROL,
  SITE_ORIGIN,
  scheduledEdgeCacheControl,
} from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import { tagPath } from "~/lib/tag-path.mjs";
import { CONTENT_PAGE_PATHS, CONTENT_PAGES_FROM_DATA, CONTENT_PAGES_OWN_ROUTE } from "~/lib/content-pages.mjs";
import { CONTENT_PAGES_CACHE_TAG } from "~/lib/pages/route";
import { paperPath } from "~/lib/publications/paths.mjs";
import { LAB_PATH, hasItemPage, itemPath, kindPath } from "~/kb/registry/catalog.mjs";
import { LIBRARY_BASES } from "~/kb/libraries.mjs";
import { REGISTRY_CACHE_TAG } from "~/kb/registry/route";
import { sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";
import type { Route } from "./+types/sitemap";

/**
 * Kept in step with `routes.ts` by hand: every public page route is listed here or exempted by name
 * with a reason.
 */
const STATIC_PATHS = [
  "/",
  "/about",
  "/writing",
  "/research/publications",
  "/colophon",
  "/contact",
];

export async function loader({ context }: Route.LoaderArgs) {
  const origin = SITE_ORIGIN;
  const env = getEnv(context);

  /* No `kind = 'page'` read: both writers into `posts` write only 'post'. Recheck that before relying on it. */
  /* No `lastmod`: a tag has no modification date of its own. */
  const [blog, tagList, seriesList, nextPublishAt, procedureRows, papers, pagePaths, registryItems] = await Promise.all([
    listBlogPosts(env, { perPage: 1000 }),
    listBlogTags(env),
    listBlogSeries(env),
    nextScheduledPublishAt(env),
    // Procedures live in D1, so one saved through the operator API is listed without a deploy.
    listPublishedProcedures(env),
    // Papers live in D1 too, so one saved through Carrel is listed without a deploy.
    listPublishedPublications(env),
    // The prose pages live in D1 too (docs/PAGES.md): a draft is left out, and so is a path whose row is missing.
    listPublishedPagePaths(env),
    // The lab registry lives in D1 too (docs/REGISTRY.md): an item saved through Carrel is listed without a deploy.
    listRegistry(env, { published: true }),
  ]);
  // In the registry's order, which is the order the sitemap has always listed them in. The CV is generated
  // from data and has no row.
  const published = new Set(pagePaths);
  const pageUrls = CONTENT_PAGE_PATHS.filter((path) => CONTENT_PAGES_FROM_DATA.includes(path) || published.has(path));

  const urls = [
    // A page with a route of its own (About) is listed in its place, and only while its row is published.
    ...[...STATIC_PATHS.filter((path) => !CONTENT_PAGES_OWN_ROUTE.includes(path) || published.has(path)), ...pageUrls].map((path) => ({ loc: origin + path, lastmod: null as Date | null })),
    /*
     * No `lastmod`: one commit date would mark every paper changed together, which teaches crawlers to
     * ignore the field. No showcase filter: a crawler has no double-counting problem.
     */
    ...papers.map((p) => ({
      loc: `${origin}${paperPath(p.slug)}`,
      lastmod: null as Date | null,
    })),
    // A knowledge base's library is listed once it has a published entry; until then it is not a page (kb-library.tsx).
    ...LIBRARY_BASES.filter((base) => procedureRows.some((p) => p.path.startsWith(base.entryRoot))).map((base) => ({
      loc: `${origin}${base.library}`,
      lastmod: null as Date | null,
    })),
    ...procedureRows.map((p) => ({
      loc: `${origin}${p.path}`,
      lastmod: p.updated ? new Date(`${p.updated}T00:00:00.000Z`) : null,
    })),
    // The registry's inventory, each kind that has an item, and each item. No `lastmod`: a row's sync time is not the
    // date a fact changed.
    { loc: `${origin}${LAB_PATH}`, lastmod: null as Date | null },
    ...[...new Set(registryItems.map((item) => item.kind))].map((kind) => ({ loc: `${origin}${kindPath(kind)}`, lastmod: null as Date | null })),
    ...registryItems
      .filter((item) => hasItemPage(item.kind))
      .map((item) => ({ loc: `${origin}${itemPath(item.kind, item.id)}`, lastmod: null as Date | null })),
    ...blog.posts.map((p) => ({
      loc: `${origin}/writing/${p.slug}`,
      lastmod: p.updatedAt,
    })),
    ...tagList.map((t) => ({
      loc: `${origin}${tagPath(t.slug)}`,
      lastmod: null as Date | null,
    })),
    ...seriesList.flatMap((row) =>
      row.name === null
        ? []
        : [{ loc: `${origin}${seriesPath(row.name)}`, lastmod: null as Date | null }],
    ),
  ];

  const body = sitemapDocument(urls);

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      /* No `Vary`: this document embeds no reader state. */
      "cache-control": SHARED_CACHE_CONTROL,
      /* Lists posts, tags, series, procedures, the prose pages and the registry, so all four purges must reach it. */
      "cache-tag": `${POSTS_AND_PROCEDURES_CACHE_TAGS},${CONTENT_PAGES_CACHE_TAG},${REGISTRY_CACHE_TAG}`,
      [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt),
    },
  });
}
