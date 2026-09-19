/**
 * Where a recorded D1 divergence lives, and how the status surface reads it.
 *
 * **IT IS KV.** The record says "D1 could not be written", so putting it in D1 would make it absent
 * in exactly the circumstance it exists to describe.
 *
 * **ONE KEY PER SLUG, not one list.** A single key holding an array is a read-modify-write, and two
 * saves failing at once would lose one record to the race.
 *
 * **OBSERVATION BOUNDARY.** `listDivergences` uses KV `list`, which is EVENTUALLY CONSISTENT, so an
 * empty result is "none visible", not "none exist". Acceptable because the operator was already told
 * directly, in the error that raised it. It would NOT be acceptable as the only alarm, and nothing
 * treats it as one.
 */

const PREFIX = "publish:divergence:";

/**
 * A recorded divergence. `at` is an ISO timestamp so it reads without tooling.
 */
export interface Divergence {
  slug: string;
  commitSha: string;
  error: string;
  at: string;
}

/**
 * Records that a commit landed and D1 did not follow.
 *
 * NO TTL, deliberately. A divergence expiring on its own would mean the status
 * surface silently returning to green while the index was still stale, which is
 * the reassuring-silence failure this repo keeps naming. It is cleared by the
 * repair, or it stays.
 */
export async function recordDivergence(
  env: Env,
  facts: { slug: string; commitSha: string; error: string },
): Promise<void> {
  const entry: Divergence = { ...facts, at: new Date().toISOString() };
  await env.APP_KV.put(`${PREFIX}${facts.slug}`, JSON.stringify(entry));
}

/** Clears the record for one slug. Called when a later save for it succeeds. */
export async function clearDivergence(env: Env, slug: string): Promise<void> {
  await env.APP_KV.delete(`${PREFIX}${slug}`);
}

/**
 * Every visible divergence, for the sync status surface.
 *
 * Fails SOFT and says so in its own return value rather than throwing: this is
 * read by `sync_status`, whose job is to report the state of three stores, and
 * a status tool that cannot answer because one of its questions failed is less
 * useful than one that answers the other two and marks this one unknown.
 */
export async function listDivergences(
  env: Env,
): Promise<{ known: true; entries: Divergence[] } | { known: false; reason: string }> {
  try {
    const listed = await env.APP_KV.list({ prefix: PREFIX });
    const entries: Divergence[] = [];
    for (const key of listed.keys) {
      const raw = await env.APP_KV.get(key.name);
      if (!raw) continue;
      try {
        entries.push(JSON.parse(raw) as Divergence);
      } catch {
        // A key that will not parse is still evidence something diverged, so it
        // is reported rather than dropped: losing it would understate the fault.
        entries.push({
          slug: key.name.slice(PREFIX.length),
          commitSha: "(unparseable record)",
          error: "the stored divergence record could not be parsed",
          at: "",
        });
      }
    }
    return { known: true, entries };
  } catch (error) {
    return {
      known: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
