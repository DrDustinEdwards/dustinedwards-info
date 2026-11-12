// The Ask upload ledger: what was last uploaded to AI Search under each key (drizzle/0043_ask_uploads.sql).
import { sql } from "drizzle-orm";
import { chunked, inList, rowsPerInsert } from "@dustinedwards/site-runtime/d1";
import { askUploads } from "./schema";
import { getDb } from "./client";

export async function readAskUploads(env: Env): Promise<Map<string, string>> {
  const rows = await getDb(env)
    .select({ key: askUploads.key, hash: askUploads.bodySha256 })
    .from(askUploads);
  return new Map(rows.map((row) => [row.key, row.hash]));
}

/** Written only after AI Search accepted the upload, so a row never claims a body the index was not sent. */
export async function recordAskUploads(
  env: Env,
  uploads: ReadonlyArray<{ key: string; hash: string }>,
): Promise<void> {
  const uploadedAt = new Date().toISOString();
  const db = getDb(env);
  // Three bound parameters per row.
  for (const part of chunked(uploads, rowsPerInsert(3))) {
    const values = part.map(({ key, hash }) => ({ key, bodySha256: hash, uploadedAt }));
    await db
      .insert(askUploads)
      .values(values)
      .onConflictDoUpdate({
        target: askUploads.key,
        set: { bodySha256: sql`excluded.body_sha256`, uploadedAt: sql`excluded.uploaded_at` },
      });
  }
}

/** An item deleted from the index takes its ledger row with it, so a key that returns is uploaded again. */
export async function forgetAskUploads(env: Env, keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  await getDb(env).delete(askUploads).where(inList(askUploads.key, keys));
}
