// site-api's mentions group (v0.5.0, with v0.6.0's search, one-post filter and reset) over the site's own webmentions
// table (drizzle/0014_webmentions.sql), so Carrel's MentionsList lists and moderates the queue the /webmention
// endpoint fills. The endpoint, the verify queue and the retention windows stay the site's (app/db/webmentions.ts).
//
// The table has no version column, so a mention's version is a hash of what a decision or a verification moves: its
// status and its received, verified and decided times (a re-send resets all of them). Every write checks the version
// and then names those same values in its WHERE, so a change made in between matches no row and answers a conflict.

import { contentVersion, NotFoundError, RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type { MentionItem, MentionStatus, MentionsAdapter } from "@dustinedwards/site-api";

import { countExpiringWebmentions, sweepWebmentions } from "~/db";
import { purgePost } from "~/lib/cache-purge.server";

type Row = {
  id: number;
  status: MentionStatus;
  source_url: string;
  target_slug: string;
  author_name: string | null;
  author_url: string | null;
  excerpt: string | null;
  failure_reason: string | null;
  received_at: number;
  verified_at: number | null;
  decided_at: number | null;
};

const COLUMNS = `id, status, source_url, target_slug, author_name, author_url, excerpt, failure_reason, received_at,
  verified_at, decided_at`;

/** The statuses a decision can be made on: `unverified` has no evidence yet and `failed` has evidence against. */
const DECIDABLE: readonly MentionStatus[] = ["pending", "approved", "rejected"];

const iso = (seconds: number | null) => (seconds === null ? null : new Date(seconds * 1000).toISOString());

/** The contract's bounds; a stranger's text is cut, never refused, since the row is already stored. */
const bounded = (text: string | null, max: number) => (text === null ? null : text.slice(0, max));

const versionOf = (row: Row) => contentVersion([row.status, row.received_at, row.verified_at, row.decided_at]);

async function itemOf(row: Row): Promise<MentionItem> {
  return {
    id: String(row.id),
    status: row.status,
    sourceUrl: row.source_url.slice(0, 2000),
    targetId: row.target_slug.slice(0, 300),
    authorName: bounded(row.author_name, 500),
    authorUrl: bounded(row.author_url, 2000),
    excerpt: bounded(row.excerpt, 5000),
    failureReason: bounded(row.failure_reason, 500),
    receivedAt: iso(row.received_at)!,
    verifiedAt: iso(row.verified_at),
    decidedAt: iso(row.decided_at),
    version: await versionOf(row),
  };
}

export function carrelMentionsAdapter(env: Env): MentionsAdapter {
  const db = env.DB;

  /** The row at the version the caller loaded: 404 when there is none, 409 when it moved on. */
  async function held(id: string, expectedVersion: string): Promise<Row> {
    const row = /^\d+$/.test(id)
      ? await db.prepare(`SELECT ${COLUMNS} FROM webmentions WHERE id = ?1`).bind(Number(id)).first<Row>()
      : null;
    if (!row) throw new NotFoundError("No such mention.");
    const version = await versionOf(row);
    if (version !== expectedVersion) throw new VersionConflictError(version);
    return row;
  }

  /** The same row in its WHERE, so a write between the check and this one matches nothing and is a conflict. */
  const sameRow = `id = ?1 AND status = ?2 AND received_at = ?3 AND verified_at IS ?4 AND decided_at IS ?5`;
  const sameRowValues = (row: Row) => [row.id, row.status, row.received_at, row.verified_at, row.decided_at];

  async function moved(id: string): Promise<never> {
    const now = await db.prepare(`SELECT ${COLUMNS} FROM webmentions WHERE id = ?1`).bind(Number(id)).first<Row>();
    if (!now) throw new NotFoundError("No such mention.");
    throw new VersionConflictError(await versionOf(now));
  }

  /** Sets the status and decided time on a row still as it was read, then purges the post it shows on. */
  async function setDecision(id: string, row: Row, status: MentionStatus, decidedAt: number | null) {
    const result = await db
      .prepare(`UPDATE webmentions SET status = ?6, decided_at = ?7 WHERE ${sameRow}`)
      .bind(...sameRowValues(row), status, decidedAt)
      .run();
    if (result.meta.changes !== 1) return moved(id);
    const next = { ...row, status, decided_at: decidedAt };
    // The decision stands either way; a failed purge is reported to Carrel as purged: false.
    const purged = await purgePost(row.target_slug, `mention ${status} ${id}`);
    return { status, version: await versionOf(next), purged };
  }

  return {
    async list(query) {
      const needle = query.q?.trim().toLowerCase() || null;
      const target = query.targetId ?? null;
      const start = query.cursor && /^\d+$/.test(query.cursor) ? Number(query.cursor) : 0;
      const [page, counted, expiring] = await Promise.all([
        db
          .prepare(
            `SELECT ${COLUMNS} FROM webmentions
             WHERE (?1 IS NULL OR status = ?1) AND (?2 IS NULL OR target_slug = ?2)
               AND (?3 IS NULL OR instr(lower(source_url), ?3) > 0 OR instr(lower(COALESCE(author_name, '')), ?3) > 0
                 OR instr(lower(COALESCE(excerpt, '')), ?3) > 0)
             ORDER BY received_at DESC, id DESC LIMIT ?4 OFFSET ?5`,
          )
          .bind(query.status ?? null, target, needle, query.limit + 1, start)
          .all<Row>(),
        db.prepare(`SELECT status, COUNT(*) AS n FROM webmentions GROUP BY status`).all<{ status: MentionStatus; n: number }>(),
        countExpiringWebmentions(env),
      ]);
      const rows = page.results ?? [];
      const counts = { unverified: 0, pending: 0, approved: 0, rejected: 0, failed: 0 };
      for (const { status, n } of counted.results ?? []) counts[status] = n;
      return {
        items: await Promise.all(rows.slice(0, query.limit).map(itemOf)),
        nextCursor: rows.length > query.limit ? String(start + query.limit) : null,
        counts,
        expiring,
        ...(needle || target ? { filtered: { ...(query.q ? { q: query.q } : {}), ...(target ? { targetId: target } : {}) } } : {}),
      };
    },

    async decide(id, input) {
      const row = await held(id, input.expectedVersion);
      if (!DECIDABLE.includes(row.status)) {
        throw new RefusedError(`A ${row.status} mention cannot be decided: only a verified mention can.`);
      }
      return setDecision(id, row, input.decision === "approve" ? "approved" : "rejected", Math.floor(Date.now() / 1000));
    },

    async reset(id, input) {
      const row = await held(id, input.expectedVersion);
      if (row.status !== "approved" && row.status !== "rejected") {
        throw new RefusedError(`A ${row.status} mention has no decision to take back.`);
      }
      return setDecision(id, row, "pending", null);
    },

    async delete(id, input) {
      const row = await held(id, input.expectedVersion);
      const result = await db.prepare(`DELETE FROM webmentions WHERE ${sameRow}`).bind(...sameRowValues(row)).run();
      if (result.meta.changes !== 1) return moved(id);
      return { purged: await purgePost(row.target_slug, `mention delete ${id}`) };
    },

    // The site's own windows: 30 days for failed, 90 for rejected; open mentions never expire.
    sweep: () => sweepWebmentions(env),
  };
}
