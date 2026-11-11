// The media listings behind /health, kept for an hour. Every listing is a Class A operation, billed after the
// first million a month (developers.cloudflare.com/r2/pricing/), and the live gates, the health-snapshot
// job and the Capsid watcher read /health all day. The media index check lists MEDIA and OG in full, so an uncached /health made
// about 324K listings a month. (The BACKUPS read is kept by site-runtime's healthResponse, in the Cache API, see health.ts.)
//
// A TTL entry in APP_KV through site-runtime's kvCached: KV refuses a TTL under 60 seconds and a fresh write can take
// up to 60 seconds to reach other locations (developers.cloudflare.com/kv/api/write-key-value-pairs/), both fine for a
// verdict an hour old. A repair
// drops its entry (dropHealthVerdicts), so the recheck after it reads the bucket, not the verdict it fixed.

import { kvCached } from "@dustinedwards/site-runtime/kv-cache";

/** An hour: drift is repaired within a Capsid watcher pass, and a verdict this old harms nothing. */
const HEALTH_VERDICT_TTL_SECONDS = 60 * 60;

const PREFIX = "health:verdict:";

/** The R2-backed verdicts, by check name. */
export const CACHED_VERDICTS = ["media-index-drift"] as const;

interface Verdict {
  ok: boolean;
  detail: string;
  counts?: { expected: number; present: number };
}

function isVerdict(value: unknown): value is Verdict {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Verdict;
  return typeof v.ok === "boolean" && typeof v.detail === "string";
}

/** The kept verdict for `name`, or the result of `run`, which is then kept (site-runtime ./kv-cache). A run that throws
 *  keeps nothing; a KV fault never fails the check. */
export function cachedVerdict(
  env: Pick<Env, "APP_KV">,
  name: (typeof CACHED_VERDICTS)[number],
  run: () => Promise<Verdict>,
): Promise<Verdict> {
  return kvCached(
    env.APP_KV,
    `${PREFIX}${name}`,
    { ttl: HEALTH_VERDICT_TTL_SECONDS, valid: isVerdict },
    run,
  );
}

/** For a repair: what it changed is not what the kept verdict says. */
export async function dropHealthVerdicts(env: Pick<Env, "APP_KV">): Promise<void> {
  await Promise.all(CACHED_VERDICTS.map((name) => env.APP_KV.delete(`${PREFIX}${name}`)));
}
