// The connection and the predicates more than one table module composes.
// Only `getDb` and `publiclyVisible` are re-exported from `~/db`.
import { PUBLISHED_STATUS } from "~/lib/search/visibility.mjs";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";
import { media, posts } from "./schema";

export function getDb(env: Env) {
  return drizzle(env.DB, { schema: { ...schema, ...authSchema } });
}

export type DB = ReturnType<typeof getDb>;

export function publiclyVisible() {
  return and(
    eq(posts.status, PUBLISHED_STATUS),
    or(isNull(posts.publishAt), lte(posts.publishAt, new Date())),
  );
}

export function isBlogPost() {
  return and(eq(posts.kind, "post"), publiclyVisible());
}

/** Reconciliation readers must not use this filter, or a rebuild restores trashed rows. */
export function notTrashed() {
  return isNull(media.trashedAt);
}
