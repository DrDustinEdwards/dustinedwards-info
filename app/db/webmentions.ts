// Webmentions: receive, verify, decide, list and the retention sweep.
import { and, count, desc, eq, exists, inArray, lt } from "drizzle-orm";
import {
  FAILED_RETENTION_DAYS,
  REJECTED_RETENTION_DAYS,
  daysInMilliseconds,
} from "../lib/webmention/retention.mjs";
import { posts, webmentions } from "./schema";
import { getDb, publiclyVisible, isBlogPost } from "./client";

/** Statuses the global cap counts, stated once so the cap and the sweep agree. */
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

export async function listWebmentionsForAdmin(env: Env) {
  return getDb(env).select().from(webmentions).orderBy(desc(webmentions.receivedAt));
}

/** Decidable: `unverified` has no evidence and `failed` has evidence against. */
const DECIDABLE_WEBMENTION_STATUSES = ["pending", "approved", "rejected"] as const;

/** Approve or reject one mention. Reversible, so decided rows stay decidable. */
export async function decideWebmention(
  env: Env,
  id: number,
  status: "approved" | "rejected",
  now: Date = new Date(),
): Promise<string | null> {
  /* Returns the slug from the write so `purgePost` names the moved row; null purges nothing. */
  const rows = await getDb(env)
    .update(webmentions)
    .set({ status, decidedAt: now })
    .where(
      and(
        eq(webmentions.id, id),
        inArray(webmentions.status, [...DECIDABLE_WEBMENTION_STATUSES]),
      ),
    )
    .returning({ targetSlug: webmentions.targetSlug });
  return rows[0]?.targetSlug ?? null;
}

/** What the sweep removes, per status: shared so the count and the sweep cannot drift apart. */
function expiryPredicates(now: Date) {
  const olderThan = (status: "failed" | "rejected", days: number) =>
    and(
      eq(webmentions.status, status),
      lt(webmentions.receivedAt, new Date(now.getTime() - daysInMilliseconds(days))),
    );
  return {
    failed: olderThan("failed", FAILED_RETENTION_DAYS),
    rejected: olderThan("rejected", REJECTED_RETENTION_DAYS),
  };
}

/** Rows the sweep would remove now, on `sweepWebmentions`'s predicates. */
export async function countExpiringWebmentions(
  env: Env,
  now: Date = new Date(),
): Promise<{ failed: number; rejected: number }> {
  const db = getDb(env);
  const expired = expiryPredicates(now);
  const [failed, rejected] = await Promise.all([
    db
      .select({ n: count() })
      .from(webmentions)
      .where(expired.failed),
    db
      .select({ n: count() })
      .from(webmentions)
      .where(expired.rejected),
  ]);
  return { failed: failed[0]?.n ?? 0, rejected: rejected[0]?.n ?? 0 };
}

/** Remove one mention outright. The only delete an admin makes by hand. */
export async function deleteWebmention(env: Env, id: number): Promise<string | null> {
  // The slug comes back for the purge.
  const rows = await getDb(env)
    .delete(webmentions)
    .where(eq(webmentions.id, id))
    .returning({ targetSlug: webmentions.targetSlug });
  return rows[0]?.targetSlug ?? null;
}

/** One statement per retention window. Open statuses never expire: the global cap counts them. */
export async function sweepWebmentions(
  env: Env,
  now: Date = new Date(),
): Promise<{ failed: number; rejected: number }> {
  const db = getDb(env);
  const expired = expiryPredicates(now);

  const failed = await db
    .delete(webmentions)
    .where(expired.failed)
    .returning({ id: webmentions.id });
  const rejected = await db
    .delete(webmentions)
    .where(expired.rejected)
    .returning({ id: webmentions.id });

  return { failed: failed.length, rejected: rejected.length };
}
