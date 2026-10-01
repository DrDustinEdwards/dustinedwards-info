// The pages table: read by the content-page route, its twin, the sitemap and the operator API. Written only
// by writeRow in app/lib/pages/save.server.ts and by sync:content, from a compile
// (app/lib/pages/compile.mjs).
import { and, asc, eq, inArray } from "drizzle-orm";

import { PUBLISHED_STATUS } from "~/lib/search/visibility.mjs";
import type { PageRecord } from "~/lib/pages/compile.mjs";

import { getDb } from "./client";
import { pages } from "./schema";

export type PageRow = {
  slug: string;
  path: string;
  status: "draft" | "published";
  record: PageRecord;
};

/** The page's row, or null. A draft comes back too: the route decides who may see it. */
export async function getPageByPath(env: Env, path: string): Promise<PageRow | null> {
  const row = (
    await getDb(env)
      .select({ slug: pages.slug, path: pages.path, status: pages.status, record: pages.record })
      .from(pages)
      .where(eq(pages.path, path))
      .limit(1)
  )[0];
  if (!row) return null;
  return { ...row, record: JSON.parse(row.record) as PageRecord };
}

/** The twin, published rows only: a draft's twin answers 404 like its page. */
export async function getPublishedPageMarkdown(env: Env, path: string) {
  const row = (
    await getDb(env)
      .select({ markdown: pages.markdown })
      .from(pages)
      .where(and(eq(pages.path, path), eq(pages.status, PUBLISHED_STATUS)))
      .limit(1)
  )[0];
  return row?.markdown ?? null;
}

/** The titles of other pages, for the trail above a page that sits under one. Published rows only. */
export async function getPublishedPageTitles(env: Env, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const rows = await getDb(env)
    .select({ path: pages.path, title: pages.title })
    .from(pages)
    .where(and(inArray(pages.path, paths), eq(pages.status, PUBLISHED_STATUS)));
  return new Map(rows.map((row) => [row.path, row.title]));
}

/** For the sitemap: the published pages' paths. */
export async function listPublishedPagePaths(env: Env) {
  const rows = await getDb(env)
    .select({ path: pages.path })
    .from(pages)
    .where(eq(pages.status, PUBLISHED_STATUS))
    .orderBy(asc(pages.path));
  return rows.map((row) => row.path);
}

/** For the save-time link check: every published page's rendered HTML, by path. */
export async function listPublishedPageHtml(env: Env) {
  const rows = await getDb(env)
    .select({ path: pages.path, record: pages.record })
    .from(pages)
    .where(eq(pages.status, PUBLISHED_STATUS));
  return new Map(rows.map((row) => [row.path, (JSON.parse(row.record) as PageRecord).html]));
}

/** For list_pages and Carrel's list: every row, drafts included, with when D1 last wrote it. */
export async function listPageRows(env: Env) {
  const rows = await getDb(env)
    .select({ slug: pages.slug, path: pages.path, title: pages.title, status: pages.status, syncedAt: pages.syncedAt })
    .from(pages)
    .orderBy(asc(pages.path));
  return rows.map(({ status, ...row }) => ({ ...row, draft: status === "draft" }));
}
