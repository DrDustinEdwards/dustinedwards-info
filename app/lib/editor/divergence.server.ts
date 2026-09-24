// KV, not D1, because the record says D1 failed. One key per slug, because one shared
// array is a read-modify-write that loses a record when two saves fail at once.

const PREFIX = "publish:divergence:";

export interface Divergence {
  slug: string;
  commitSha: string;
  error: string;
  at: string;
}

/** No TTL: an expiring record would turn the status green while the index is still stale. */
export async function recordDivergence(
  env: Env,
  facts: { slug: string; commitSha: string; error: string },
): Promise<void> {
  const entry: Divergence = { ...facts, at: new Date().toISOString() };
  await env.APP_KV.put(`${PREFIX}${facts.slug}`, JSON.stringify(entry));
}

export async function clearDivergence(env: Env, slug: string): Promise<void> {
  await env.APP_KV.delete(`${PREFIX}${slug}`);
}

/** KV list is eventually consistent: an empty result means none visible, not none exist. */
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
        // Reported, not dropped: an unparseable key is still evidence of a divergence.
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
