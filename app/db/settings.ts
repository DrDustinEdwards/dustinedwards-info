// The key-value settings table.
import { eq } from "drizzle-orm";
import { settings } from "./schema";
import { getDb } from "./client";

export async function getSetting(env: Env, key: string) {
  const rows = await getDb(env)
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string) {
  await getDb(env)
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}
