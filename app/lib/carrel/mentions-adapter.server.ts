// The site API's mentions group (site-api v0.5.0, reset v0.6.0) over the webmentions table: the one place a
// mention is listed, decided, taken back, deleted or swept. Carrel's mentions page and tools and the site's own
// admin (Capsomer's MentionsList through localClient) all reach it, so every decision runs the same rules.
//
// Versions. The table has no version column, so a mention's version is a hash of the four columns any change
// moves: status, received_at, verified_at and decided_at (a re-send resets all of them, a decision sets the
// status and decided_at, the verifier sets status and verified_at). Each write checks the version and then
// writes with the same four values in its WHERE, so a change between the check and the write matches no row
// and is reported as a conflict, never applied over it.
//
// Purges. Only an approved mention renders on its post, so a write that moves a mention into or out of
// approved purges the post's page, in the same call, and reports whether the purge worked.

import { NotFoundError, RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type {
  MentionItem,
  MentionList,
  MentionListQuery,
  MentionStatus,
  MentionsAdapter,
} from "@dustinedwards/site-api";
import { sha256Hex } from "@dustinedwards/site-runtime/encoding";
import { likeContains } from "@dustinedwards/site-runtime/d1";
import { and, count, desc, eq, isNull, lt, or, type AnyColumn, type SQL } from "drizzle-orm";

import { getDb } from "~/db/client";
import { webmentions, type Webmention } from "~/db/schema";
import { purgePost } from "~/lib/cache-purge.server";
import {
  FAILED_RETENTION_DAYS,
  REJECTED_RETENTION_DAYS,
  daysInMilliseconds,
} from "~/lib/webmention/retention.mjs";

const STATUSES = webmentions.status.enumValues;

/** Only a verified mention takes a decision: `unverified` has no evidence and `failed` has evidence against. */
const DECIDABLE: readonly MentionStatus[] = ["pending", "approved", "rejected"];

const seconds = (d: Date | null) => (d ? Math.floor(d.getTime() / 1000) : null);

async function versionOf(
  row: Pick<Webmention, "status" | "receivedAt" | "verifiedAt" | "decidedAt">,
): Promise<string> {
  const basis = [
    row.status,
    seconds(row.receivedAt),
    seconds(row.verifiedAt),
    seconds(row.decidedAt),
  ].join("|");
  return `m${(await sha256Hex(basis)).slice(0, 16)}`;
}

async function itemOf(row: Webmention): Promise<MentionItem> {
  return {
    id: String(row.id),
    status: row.status,
    sourceUrl: row.sourceUrl,
    targetId: row.targetSlug,
    authorName: row.authorName,
    authorUrl: row.authorUrl,
    excerpt: row.excerpt,
    failureReason: row.failureReason,
    receivedAt: row.receivedAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    version: await versionOf(row),
  };
}

/** The row the four columns name, exactly: the version's columns in a WHERE. */
function unchanged(row: Webmention): SQL {
  const at = (column: AnyColumn, value: Date | null) =>
    value ? eq(column, value) : isNull(column);
  return and(
    eq(webmentions.id, row.id),
    eq(webmentions.status, row.status),
    eq(webmentions.receivedAt, row.receivedAt),
    at(webmentions.verifiedAt, row.verifiedAt),
    at(webmentions.decidedAt, row.decidedAt),
  ) as SQL;
}

/** The cursor is the last row's received time and id, so a page never repeats or skips a row another write moved. */
function mentionCursor(row: Webmention): string {
  return btoa(`${row.receivedAt.getTime()}:${row.id}`);
}

function readMentionCursor(cursor: string): { at: Date; id: number } {
  let decoded = "";
  try {
    decoded = atob(cursor);
  } catch {
    /* refused below */
  }
  const match = /^(\d{1,15}):(\d{1,15})$/.exec(decoded);
  if (!match)
    throw new RefusedError("That cursor is not one this site gave. Start from the first page.");
  return { at: new Date(Number(match[1])), id: Number(match[2]) };
}

/** What the sweep removes, by status: shared so the count and the sweep cannot drift apart. */
function expired(now: Date) {
  const pastRetention = (status: "failed" | "rejected", days: number) =>
    and(
      eq(webmentions.status, status),
      lt(webmentions.receivedAt, new Date(now.getTime() - daysInMilliseconds(days))),
    );
  return {
    failed: pastRetention("failed", FAILED_RETENTION_DAYS),
    rejected: pastRetention("rejected", REJECTED_RETENTION_DAYS),
  };
}

const purgeIf = (moved: boolean, slug: string, why: string) =>
  moved ? purgePost(slug, why) : Promise.resolve(null);

export function carrelMentionsAdapter(env: Env): MentionsAdapter {
  const db = getDb(env);

  /** The mention, its version checked: NotFoundError for a missing id, VersionConflictError for a stale one. */
  async function current(id: string, expectedVersion: string): Promise<Webmention> {
    const rowId = Number(id);
    const [row] =
      Number.isSafeInteger(rowId) && rowId > 0
        ? await db.select().from(webmentions).where(eq(webmentions.id, rowId)).limit(1)
        : [];
    if (!row) throw new NotFoundError(`There is no mention ${id}.`);
    const version = await versionOf(row);
    if (version !== expectedVersion)
      throw new VersionConflictError(version, "The mention changed since it was loaded.");
    return row;
  }

  /** One status write on the row as it was read; a row changed in between is a conflict. */
  async function moveTo(
    row: Webmention,
    set: { status: MentionStatus; decidedAt: Date | null },
    why: string,
  ) {
    const [written] = await db.update(webmentions).set(set).where(unchanged(row)).returning();
    if (!written)
      throw new VersionConflictError(null, "The mention changed while it was being decided.");
    const purged = await purgeIf(
      row.status === "approved" || written.status === "approved",
      row.targetSlug,
      why,
    );
    return { status: written.status, version: await versionOf(written), purged };
  }

  return {
    async list(query: MentionListQuery): Promise<MentionList> {
      const filters: SQL[] = [];
      if (query.status) filters.push(eq(webmentions.status, query.status));
      if (query.targetId) filters.push(eq(webmentions.targetSlug, query.targetId));
      if (query.q) {
        // LIKE's own characters in the words are matched as themselves. SQLite's LIKE ignores ASCII case.
        const words = query.q;
        const has = (column: AnyColumn) => likeContains(column, words);
        filters.push(
          or(
            has(webmentions.sourceUrl),
            has(webmentions.authorName),
            has(webmentions.excerpt),
          ) as SQL,
        );
      }
      if (query.cursor) {
        const { at, id } = readMentionCursor(query.cursor);
        filters.push(
          or(
            lt(webmentions.receivedAt, at),
            and(eq(webmentions.receivedAt, at), lt(webmentions.id, id)),
          ) as SQL,
        );
      }
      const now = new Date();
      const old = expired(now);
      const [rows, byStatus, failed, rejected] = await Promise.all([
        db
          .select()
          .from(webmentions)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(desc(webmentions.receivedAt), desc(webmentions.id))
          .limit(query.limit + 1),
        db
          .select({ status: webmentions.status, n: count() })
          .from(webmentions)
          .groupBy(webmentions.status),
        db.select({ n: count() }).from(webmentions).where(old.failed),
        db.select({ n: count() }).from(webmentions).where(old.rejected),
      ]);
      const page = rows.slice(0, query.limit);
      const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as MentionList["counts"];
      for (const { status, n } of byStatus) counts[status] = n;
      const last = page.at(-1);
      return {
        items: await Promise.all(page.map(itemOf)),
        nextCursor: rows.length > query.limit && last ? mentionCursor(last) : null,
        counts,
        expiring: { failed: failed[0]?.n ?? 0, rejected: rejected[0]?.n ?? 0 },
        ...(query.q !== undefined || query.targetId !== undefined
          ? {
              filtered: {
                ...(query.q !== undefined ? { q: query.q } : {}),
                ...(query.targetId !== undefined ? { targetId: query.targetId } : {}),
              },
            }
          : {}),
      };
    },

    async decide(id, { decision, expectedVersion }) {
      const row = await current(id, expectedVersion);
      if (!DECIDABLE.includes(row.status)) {
        throw new RefusedError(
          row.status === "failed"
            ? "This mention's source did not link here when it was checked, so it cannot be decided. Delete it, or let the sweep remove it."
            : "This mention has not been checked yet, so it cannot be decided. Try again in a minute.",
        );
      }
      return moveTo(
        row,
        { status: decision === "approve" ? "approved" : "rejected", decidedAt: new Date() },
        `mention ${decision}`,
      );
    },

    async reset(id, { expectedVersion }) {
      const row = await current(id, expectedVersion);
      if (row.status !== "approved" && row.status !== "rejected") {
        throw new RefusedError(
          "Only an approved or rejected mention goes back to waiting; this one has no decision to take back.",
        );
      }
      return moveTo(row, { status: "pending", decidedAt: null }, "mention reset");
    },

    async delete(id, { expectedVersion }) {
      const row = await current(id, expectedVersion);
      const [gone] = await db
        .delete(webmentions)
        .where(unchanged(row))
        .returning({ id: webmentions.id });
      if (!gone)
        throw new VersionConflictError(null, "The mention changed while it was being deleted.");
      return { purged: await purgeIf(row.status === "approved", row.targetSlug, "mention delete") };
    },

    // Never an open mention at any age: the endpoint's cap counts them, so expiring one would quietly raise it.
    // Never an approved one: it is on its post.
    async sweep() {
      const old = expired(new Date());
      const failed = await db
        .delete(webmentions)
        .where(old.failed)
        .returning({ id: webmentions.id });
      const rejected = await db
        .delete(webmentions)
        .where(old.rejected)
        .returning({ id: webmentions.id });
      return { failed: failed.length, rejected: rejected.length };
    },
  };
}
