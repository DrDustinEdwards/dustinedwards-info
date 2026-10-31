// The last failed cache purge, kept until a purge succeeds, so a write whose pages stayed stale is seen on /health and
// not only in a log line (area 5, J4). The purge runs after the answer has gone (purgeAfterWrite, schedulePurgeHook),
// so the writer cannot be told; /health is what Capsid's watcher and the uptime probe read. KV, as the divergence
// record is (app/lib/editor/divergence.server.ts): one key, and no TTL, since an expiring record would turn the
// check green while the pages are still stale.

import { logEvent } from "@dustinedwards/site-runtime/log";

const KEY = "purge:failed";

type PurgeFailure = { why: string; at: string };

/** `false` keeps the failure, `true` clears it, and `null` (a runtime with no purge API) changes nothing. */
export async function recordPurge(env: Pick<Env, "APP_KV">, why: string, purged: boolean | null): Promise<void> {
  try {
    if (purged === false) await env.APP_KV.put(KEY, JSON.stringify({ why, at: new Date().toISOString() } satisfies PurgeFailure));
    else if (purged === true) await env.APP_KV.delete(KEY);
  } catch (error) {
    logEvent("purge_record_failed", { why, error }, { level: "error" });
  }
}

/** /health's check: a failed purge not yet followed by a good one names only its time, since `why` can name a draft. */
export async function purgeCheck(env: Pick<Env, "APP_KV">): Promise<true | { ok: false; detail: string }> {
  const raw = await env.APP_KV.get(KEY);
  if (!raw) return true;
  const failure = JSON.parse(raw) as PurgeFailure;
  return { ok: false, detail: `a cache purge failed at ${failure.at}; pages may be stale until the next purge` };
}
