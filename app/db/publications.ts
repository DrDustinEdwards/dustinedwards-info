// The publications and publication_citations tables: read by the paper pages, the exports, the sitemap,
// the home page and the operator API. Written only by app/lib/publications/write.server.ts, from a compile
// (app/lib/publications/compile.mjs).
import { and, asc, eq } from "drizzle-orm";

import type { Publication } from "~/lib/publications/types";
import { sortPublications } from "~/lib/publications/record.mjs";
import { PUBLISHED_STATUS } from "~/lib/search/visibility.mjs";

import { getDb } from "./client";
import { publications } from "./schema";

/** Every published paper, newest first: the order the index, the exports and the CSL file all follow. */
export async function listPublishedPublications(env: Env): Promise<Publication[]> {
  const rows = await getDb(env)
    .select({ record: publications.record })
    .from(publications)
    .where(eq(publications.status, PUBLISHED_STATUS));
  return sortPublications(rows.map((row) => JSON.parse(row.record) as Publication));
}

/** The paper a `/research/publications/<slug>` URL names, or null. A draft is not public: it answers as absent. */
export async function getPublishedPublication(env: Env, slug: string): Promise<Publication | null> {
  const row = (
    await getDb(env)
      .select({ record: publications.record })
      .from(publications)
      .where(and(eq(publications.slug, slug), eq(publications.status, PUBLISHED_STATUS)))
      .limit(1)
  )[0];
  return row ? (JSON.parse(row.record) as Publication) : null;
}

/** The twin, published rows only: a draft's twin answers 404 like its page. */
export async function getPublishedPublicationMarkdown(env: Env, slug: string): Promise<string | null> {
  const row = (
    await getDb(env)
      .select({ markdown: publications.markdown })
      .from(publications)
      .where(and(eq(publications.slug, slug), eq(publications.status, PUBLISHED_STATUS)))
      .limit(1)
  )[0];
  return row?.markdown ?? null;
}

/** Each published twin by slug, for the Ask index to upload. */
export async function listPublishedPublicationTwins(env: Env): Promise<Array<{ slug: string; markdown: string }>> {
  return getDb(env)
    .select({ slug: publications.slug, markdown: publications.markdown })
    .from(publications)
    .where(eq(publications.status, PUBLISHED_STATUS))
    .orderBy(asc(publications.slug));
}

/** The raw Crossref records of the published papers that carry one, in the index's order, for the .json export. */
export async function listPublishedCslRecords(env: Env): Promise<unknown[]> {
  const rows = await getDb(env)
    .select({ title: publications.title, year: publications.year, csl: publications.csl })
    .from(publications)
    .where(eq(publications.status, PUBLISHED_STATUS));
  return sortPublications(rows)
    .filter((row) => row.csl !== null)
    .map((row) => JSON.parse(row.csl as string) as unknown);
}

/** Every row's identity, any status, for the save's uniqueness checks and the operator's list. */
export async function listPublicationIdentities(env: Env) {
  return getDb(env)
    .select({
      slug: publications.slug,
      doiKey: publications.doiKey,
      status: publications.status,
      stage: publications.stage,
      type: publications.type,
      title: publications.title,
      year: publications.year,
      record: publications.record,
      sourceBlobSha: publications.sourceBlobSha,
      syncedAt: publications.syncedAt,
    })
    .from(publications)
    .orderBy(asc(publications.slug));
}

/** The stored row for a slug, any status, or null. */
export async function getPublicationRow(env: Env, slug: string) {
  return (
    (
      await getDb(env)
        .select({
          slug: publications.slug,
          status: publications.status,
          sourceBlobSha: publications.sourceBlobSha,
          syncedAt: publications.syncedAt,
          record: publications.record,
        })
        .from(publications)
        .where(eq(publications.slug, slug))
        .limit(1)
    )[0] ?? null
  );
}
