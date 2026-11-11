// The Ask upload ledger: what was last uploaded to AI Search under each key (drizzle/0043_ask_uploads.sql).
import { inArray, sql } from "drizzle-orm";
import { askUploads } from "./schema";
import { getDb } from "./client";

/** D1 binds at most 100 parameters per statement; three per row. */
const ROWS_PER_INSERT = 30;

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
  for (let i = 0; i < uploads.length; i += ROWS_PER_INSERT) {
    const values = uploads
      .slice(i, i + ROWS_PER_INSERT)
      .map(({ key, hash }) => ({ key, bodySha256: hash, uploadedAt }));
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
  const db = getDb(env);
  for (let i = 0; i < keys.length; i += 90) {
    await db.delete(askUploads).where(inArray(askUploads.key, keys.slice(i, i + 90)));
  }
}
