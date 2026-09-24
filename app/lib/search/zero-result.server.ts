import { desc, sql } from "drizzle-orm";

import { getDb } from "~/db";
import { zeroResultQueries } from "~/db/schema";
import {
  normaliseZeroResultQuery,
  ZERO_RESULT_MAX_LENGTH,
  ZERO_RESULT_RETENTION_SECONDS,
} from "./zero-result.mjs";

// Stores the query and counters only, never an IP, user agent or session. The write never fails a search.

/** Upsert on the query, so table size tracks distinct misses rather than traffic. */
export async function recordZeroResult(env: Env, raw: string): Promise<void> {
  const query = normaliseZeroResultQuery(raw);
  if (query === null) return;

  const db = getDb(env);
  await db
    .insert(zeroResultQueries)
    .values({ query })
    .onConflictDoUpdate({
      target: zeroResultQueries.query,
      set: {
        count: sql`${zeroResultQueries.count} + 1`,
        lastSeen: sql`(unixepoch())`,
      },
    });
}

/** On last_seen, not first_seen: a long-running gap asked about last week is live demand. */
export async function purgeZeroResults(env: Env, now = new Date()): Promise<number> {
  const cutoff = Math.floor(now.getTime() / 1000) - ZERO_RESULT_RETENTION_SECONDS;
  const result = await getDb(env)
    .run(sql`DELETE FROM zero_result_queries WHERE last_seen < ${cutoff}`);
  return result.meta?.changes ?? 0;
}

export { ZERO_RESULT_MAX_LENGTH, ZERO_RESULT_RETENTION_SECONDS };

export async function topZeroResults(env: Env, limit = 50) {
  return getDb(env)
    .select()
    .from(zeroResultQueries)
    .orderBy(desc(zeroResultQueries.count), desc(zeroResultQueries.lastSeen))
    .limit(limit);
}
