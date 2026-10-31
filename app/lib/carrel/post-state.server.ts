// What Carrel's v0.17.0 contract needs about a post that its file does not hold (drizzle/0038_carrel_posts.sql): the
// trash, the redirects a rename leaves behind, and the first publishes that go live by time. A post's version stays the
// blob sha of its file (site-adapter.server.ts), so trashing a draft or restoring one does not move it; a trash of a
// live post writes the file as a draft first, which does. The same departure scheduled updates make
// (schedules-adapter.server.ts), recorded here.

import { utc } from "@dustinedwards/site-api/schedules";

type DbEnv = Pick<Env, "DB">;

/** When each trashed post went to the trash, by its content id. */
export async function trashedAt(env: DbEnv): Promise<Map<string, string>> {
  const { results } = await env.DB.prepare(`SELECT content_id, trashed_at FROM content_trash`).all<{
    content_id: string;
    trashed_at: string;
  }>();
  return new Map(results.map((row) => [row.content_id, row.trashed_at]));
}

export async function trashedAtOf(env: DbEnv, id: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT trashed_at FROM content_trash WHERE content_id = ?1`)
    .bind(id)
    .first<{ trashed_at: string }>();
  return row?.trashed_at ?? null;
}

export function putTrash(env: DbEnv, id: string, changeId: string, at = new Date()) {
  return env.DB.prepare(
    `INSERT INTO content_trash (content_id, trashed_at, change_id) VALUES (?1, ?2, ?3)
     ON CONFLICT (content_id) DO UPDATE SET trashed_at = excluded.trashed_at, change_id = excluded.change_id`,
  ).bind(id, utc(at), changeId);
}

export function dropTrash(env: DbEnv, id: string) {
  return env.DB.prepare(`DELETE FROM content_trash WHERE content_id = ?1`).bind(id);
}

/** The new slug a renamed post's old one answers with a 301, or null. */
export async function redirectFor(env: DbEnv, slug: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT to_slug FROM post_redirects WHERE from_slug = ?1`)
    .bind(slug)
    .first<{ to_slug: string }>();
  return row?.to_slug ?? null;
}

/** The redirects that lead to a post, dropped when it is deleted: a 301 to a page that is gone is a 404 in two hops. */
export function dropRedirectsTo(env: DbEnv, slug: string) {
  return env.DB.prepare(`DELETE FROM post_redirects WHERE to_slug = ?1`).bind(slug);
}

/**
 * Moves a post's file, its every revision and its waiting state from one slug to the other, and, when it was ever
 * public, leaves the old slug redirecting (an earlier rename's redirect is repointed, so there is never a chain). One
 * batch: the guard rows fail their CHECK, and nothing moves, if the old file is no longer `sha` or the new path is taken.
 */
export async function movePost(
  env: DbEnv,
  move: { from: string; to: string; fromPath: string; toPath: string; sha: string; redirect: boolean },
) {
  const db = env.DB;
  const statements = [
    db.prepare(`INSERT INTO source_guard (ok) VALUES ((SELECT sha FROM source_files WHERE path = ?1) IS ?2)`).bind(move.fromPath, move.sha),
    db.prepare(`INSERT INTO source_guard (ok) VALUES ((SELECT COUNT(*) FROM source_files WHERE path = ?1) = 0)`).bind(move.toPath),
    db.prepare(`UPDATE source_files SET path = ?2 WHERE path = ?1`).bind(move.fromPath, move.toPath),
    db.prepare(`UPDATE source_revisions SET path = ?2 WHERE path = ?1`).bind(move.fromPath, move.toPath),
    db.prepare(`UPDATE scheduled_updates SET content_id = ?2 WHERE content_id = ?1`).bind(move.from, move.to),
    db.prepare(`UPDATE scheduled_publishes SET content_id = ?2 WHERE content_id = ?1`).bind(move.from, move.to),
    db.prepare(`UPDATE content_trash SET content_id = ?2 WHERE content_id = ?1`).bind(move.from, move.to),
    // The new slug is a page of its own now, so it no longer redirects anywhere.
    db.prepare(`DELETE FROM post_redirects WHERE from_slug = ?1`).bind(move.to),
    ...(move.redirect
      ? [
          db.prepare(`UPDATE post_redirects SET to_slug = ?2 WHERE to_slug = ?1`).bind(move.from, move.to),
          db.prepare(
            `INSERT INTO post_redirects (from_slug, to_slug) VALUES (?1, ?2)
             ON CONFLICT (from_slug) DO UPDATE SET to_slug = excluded.to_slug`,
          ).bind(move.from, move.to),
        ]
      : []),
    db.prepare(`DELETE FROM source_guard`),
  ];
  try {
    await db.batch(statements);
  } catch (error) {
    if (/CHECK constraint failed/i.test(String(error))) return false;
    throw error;
  }
  return true;
}

/** A post scheduled before it was ever live: the cron lists it as due at `publishAt` (schedules-adapter.server.ts). */
export function putScheduledPublish(env: DbEnv, id: string, publishAt: string, changeId: string) {
  return env.DB.prepare(
    `INSERT INTO scheduled_publishes (content_id, publish_at, change_id) VALUES (?1, ?2, ?3)
     ON CONFLICT (content_id) DO UPDATE SET publish_at = excluded.publish_at, change_id = excluded.change_id`,
  ).bind(id, utc(publishAt), changeId);
}

export function dropScheduledPublish(env: DbEnv, id: string) {
  return env.DB.prepare(`DELETE FROM scheduled_publishes WHERE content_id = ?1`).bind(id);
}

export async function scheduledPublishOf(env: DbEnv, id: string) {
  return env.DB.prepare(`SELECT publish_at, change_id FROM scheduled_publishes WHERE content_id = ?1`)
    .bind(id)
    .first<{ publish_at: string; change_id: string }>();
}

export async function dueScheduledPublishes(env: DbEnv, now: Date, limit: number) {
  const { results } = await env.DB.prepare(
    `SELECT content_id, publish_at, change_id FROM scheduled_publishes WHERE publish_at <= ?1
     ORDER BY publish_at, content_id LIMIT ?2`,
  )
    .bind(utc(now), limit)
    .all<{ content_id: string; publish_at: string; change_id: string }>();
  return results.map((row) => ({
    id: row.content_id,
    kind: "publish" as const,
    publishAt: row.publish_at,
    changeId: row.change_id,
  }));
}
