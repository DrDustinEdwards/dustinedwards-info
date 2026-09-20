import { desc, sql } from "drizzle-orm";

import { getDb } from "~/db";
import { zeroResultQueries } from "~/db/schema";
import {
  normaliseZeroResultQuery,
  ZERO_RESULT_MAX_LENGTH,
  ZERO_RESULT_RETENTION_SECONDS,
} from "./zero-result.mjs";

/**
 * Recording a search that found nothing, which is the one search result worth keeping.
 *
 * WHAT IS STORED IS THE QUERY AND THREE COUNTERS. There is no IP, no user agent, no session, no
 * cookie and no fingerprint, and the table has nowhere to put one: see the migration for why that
 * is a shape rather than a policy.
 *
 * IT NEVER FAILS A SEARCH. The write is fire-and-forget and its errors are swallowed at the call
 * site, because a reader whose search returned nothing should not then be shown an error about the
 * recording of that fact. Demand signal is worth strictly less than the page rendering.
 *
 * THE RETENTION SWEEP IS THE OTHER HALF. Without it this table only grows, and a demand signal
 * from two years ago is not demand.
 */

/**
 * Record one zero-result query, or do nothing if it is not worth recording.
 *
 * UPSERT ON THE QUERY, so the same miss asked fifty times is one row with a count of fifty. That
 * is what makes the table's size a function of the distinct things readers look for rather than of
 * how often they look, and it is the bound that matters more than the sweep.
 */
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

/**
 * Drop rows nobody has searched for inside the window.
 *
 * ON `last_seen`, NOT `first_seen`: a gap somebody asked about again last week is live demand
 * however long ago it was first recorded, and sweeping on first_seen would delete exactly the
 * long-running gaps worth writing about.
 */
export async function purgeZeroResults(env: Env, now = new Date()): Promise<number> {
  const cutoff = Math.floor(now.getTime() / 1000) - ZERO_RESULT_RETENTION_SECONDS;
  const result = await getDb(env)
    .run(sql`DELETE FROM zero_result_queries WHERE last_seen < ${cutoff}`);
  return result.meta?.changes ?? 0;
}

export { ZERO_RESULT_MAX_LENGTH, ZERO_RESULT_RETENTION_SECONDS };

/**
 * The demand list: distinct misses, most-asked first.
 *
 * CAPPED, because this is a reading surface rather than an export. A gap nobody has asked for
 * twice is not yet demand, and a page of four hundred one-off typos is a page nobody reads.
 */
export async function topZeroResults(env: Env, limit = 50) {
  return getDb(env)
    .select()
    .from(zeroResultQueries)
    .orderBy(desc(zeroResultQueries.count), desc(zeroResultQueries.lastSeen))
    .limit(limit);
}
