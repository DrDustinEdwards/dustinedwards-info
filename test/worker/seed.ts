import { env } from "cloudflare:test";

/**
 * Rows written straight into D1, for cases whose subject reads them rather than writes them.
 * The publish path is not involved, so nothing here renders, hashes or reaches GitHub.
 */

/** 2026-01-01: a publish_at already in the past, so the post is live. */
const NEW_YEAR = Math.floor(Date.UTC(2026, 0, 1) / 1000);

/** One post row. Seeding a slug again restates its status and publish_at. */
export async function seedPost(
  slug: string,
  {
    status = "published",
    title = `Title for ${slug}`,
    body = "A body.",
    publishAt = NEW_YEAR,
  }: {
    status?: "draft" | "published";
    title?: string;
    body?: string;
    publishAt?: number | null;
  } = {},
) {
  await env.DB.prepare(
    `INSERT INTO posts (slug, kind, title, body, status, publish_at)
     VALUES (?1, 'post', ?2, ?3, ?4, ?5)
     ON CONFLICT(slug) DO UPDATE SET status = excluded.status, publish_at = excluded.publish_at`,
  )
    .bind(slug, title, body, status, publishAt)
    .run();
}

/** One webmention row, returning its id. Unset fields are NULL, which is also their default. */
export async function seedMention(
  sourceUrl: string,
  targetSlug: string,
  fields: {
    status: string;
    receivedAt: number;
    authorName?: string | null;
    authorUrl?: string | null;
    excerpt?: string | null;
    verifiedAt?: number | null;
    decidedAt?: number | null;
  },
): Promise<number> {
  await env.DB.prepare(
    `INSERT INTO webmentions
       (source_url, target_slug, status, author_name, author_url, excerpt, received_at, verified_at, decided_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  )
    .bind(
      sourceUrl,
      targetSlug,
      fields.status,
      fields.authorName ?? null,
      fields.authorUrl ?? null,
      fields.excerpt === undefined ? "An excerpt." : fields.excerpt,
      fields.receivedAt,
      fields.verifiedAt ?? null,
      fields.decidedAt ?? null,
    )
    .run();
  const row = await env.DB.prepare(`SELECT id FROM webmentions WHERE source_url = ?1`)
    .bind(sourceUrl)
    .first<{ id: number }>();
  return row?.id ?? -1;
}
