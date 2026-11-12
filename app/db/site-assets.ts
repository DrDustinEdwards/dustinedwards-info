// The site's own files (site_assets): the paths in public/ and the Worker's generated objects in OG, the rows the
// rebuild and the R2 events keep in step with them. Derived: the files win any conflict.
import { count, eq } from "drizzle-orm";
import { siteAssets } from "./schema";
import { getDb } from "./client";

export async function listSiteAssets(env: Env) {
  return getDb(env).select({ key: siteAssets.key }).from(siteAssets);
}

export async function siteAssetCounts(env: Env) {
  return getDb(env)
    .select({ storage: siteAssets.storage, kind: siteAssets.kind, n: count() })
    .from(siteAssets)
    .groupBy(siteAssets.storage, siteAssets.kind);
}

/** By role. Separate from `siteAssetCounts` so a broken `roleOf()` shows. */
export async function siteAssetRoleCounts(env: Env) {
  return getDb(env)
    .select({ role: siteAssets.role, n: count() })
    .from(siteAssets)
    .groupBy(siteAssets.role);
}

/** Every column is derived, so an upsert writes them all, but never blanks a size a caller could not measure. */
export async function upsertSiteAsset(env: Env, record: typeof siteAssets.$inferInsert) {
  const measured = record.width != null && record.height != null;
  const derived = {
    storage: record.storage,
    kind: record.kind,
    role: record.role,
    mime: record.mime ?? null,
    bytes: record.bytes ?? null,
    uploadedAt: record.uploadedAt ?? null,
  };
  await getDb(env)
    .insert(siteAssets)
    .values({
      key: record.key,
      ...derived,
      width: record.width ?? null,
      height: record.height ?? null,
    })
    .onConflictDoUpdate({
      target: siteAssets.key,
      set: { ...derived, ...(measured ? { width: record.width, height: record.height } : {}) },
    });
}

/** Drops the row once the file is gone, never to make it go. */
export async function deleteSiteAsset(env: Env, key: string) {
  await getDb(env).delete(siteAssets).where(eq(siteAssets.key, key));
}
