// Webmentions: receive, verify and show. Listing, deciding and the retention sweep are the site API's mentions group
// (app/lib/carrel/mentions-adapter.server.ts), for Carrel and the admin alike.
import { and, count, desc, eq, exists, inArray } from "drizzle-orm";
import { posts, webmentions } from "./schema";
import { getDb, publiclyVisible, isBlogPost } from "./client";

/** Statuses the global cap counts. The sweep never removes them (mentions-adapter.server.ts). */
const OPEN_WEBMENTION_STATUSES = ["unverified", "pending"] as const;

/** Composes `isBlogPost()` so drafts cannot be probed. Returns a boolean, never the row. */
export async function webmentionTarget(env: Env, slug: string): Promise<boolean> {
  const rows = await getDb(env)
    .select({ slug: posts.slug })
    .from(posts)
    .where(and(eq(posts.slug, slug), isBlogPost()))
    .limit(1);
  return rows.length > 0;
}

/** Open mentions; the endpoint refuses at the ceiling. */
export async function countOpenWebmentions(env: Env): Promise<number> {
  const rows = await getDb(env)
    .select({ n: count() })
    .from(webmentions)
    .where(inArray(webmentions.status, [...OPEN_WEBMENTION_STATUSES]));
  return rows[0]?.n ?? 0;
}

/**
 * Writes or resets one (source, target) row, clearing any decision; returns its id.
 * `received_at` is set here: the default applies on insert only.
 */
export async function receiveWebmention(
  env: Env,
  fields: { sourceUrl: string; targetSlug: string; now?: Date },
): Promise<number> {
  const now = fields.now ?? new Date();
  const rows = await getDb(env)
    .insert(webmentions)
    .values({
      sourceUrl: fields.sourceUrl,
      targetSlug: fields.targetSlug,
      status: "unverified",
      receivedAt: now,
    })
    .onConflictDoUpdate({
      target: [webmentions.sourceUrl, webmentions.targetSlug],
      set: {
        status: "unverified",
        receivedAt: now,
        verifiedAt: null,
        decidedAt: null,
        failureReason: null,
        authorName: null,
        authorUrl: null,
        excerpt: null,
      },
    })
    .returning({ id: webmentions.id });
  // An upsert always returns its row; none means the write did not land, and a stand-in id would send
  // the verifier after a row that does not exist.
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error(`receiveWebmention: the upsert for ${fields.sourceUrl} returned no row`);
  }
  return id;
}

/** The row the queue consumer re-reads before it fetches anything, or null once it is gone. */
export async function webmentionToVerify(
  env: Env,
  id: number,
): Promise<{ sourceUrl: string; status: string } | null> {
  const rows = await getDb(env)
    .select({ sourceUrl: webmentions.sourceUrl, status: webmentions.status })
    .from(webmentions)
    .where(eq(webmentions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export type WebmentionVerdict =
  | {
      status: "pending";
      authorName: string | null;
      authorUrl: string | null;
      excerpt: string | null;
    }
  | { status: "failed"; failureReason: string };

/** Only a row still `unverified` takes a verdict, so a stale fetch cannot overwrite a reset. */
export async function recordWebmentionVerdict(
  env: Env,
  id: number,
  verdict: WebmentionVerdict,
  now: Date = new Date(),
): Promise<void> {
  const shared = { verifiedAt: now, decidedAt: null };
  const set =
    verdict.status === "pending"
      ? {
          ...shared,
          status: "pending" as const,
          failureReason: null,
          authorName: verdict.authorName,
          authorUrl: verdict.authorUrl,
          excerpt: verdict.excerpt,
        }
      : {
          ...shared,
          status: "failed" as const,
          failureReason: verdict.failureReason,
        };
  await getDb(env)
    .update(webmentions)
    .set(set)
    .where(and(eq(webmentions.id, id), eq(webmentions.status, "unverified")));
}

/** The EXISTS on `posts` keeps an unpublished post's mentions hidden. */
export async function approvedMentionsFor(env: Env, slug: string) {
  const db = getDb(env);
  return db
    .select({
      id: webmentions.id,
      sourceUrl: webmentions.sourceUrl,
      authorName: webmentions.authorName,
      authorUrl: webmentions.authorUrl,
      excerpt: webmentions.excerpt,
      decidedAt: webmentions.decidedAt,
    })
    .from(webmentions)
    .where(
      and(
        eq(webmentions.targetSlug, slug),
        eq(webmentions.status, "approved"),
        exists(
          db
            .select({ visible: posts.id })
            .from(posts)
            .where(and(eq(posts.slug, slug), publiclyVisible())),
        ),
      ),
    )
    .orderBy(desc(webmentions.decidedAt));
}
