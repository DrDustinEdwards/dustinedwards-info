// The media listings behind /health, kept for an hour. Every listing is a Class A operation, billed after the
// first million a month (developers.cloudflare.com/r2/pricing/), and the watchdog, the live gates and the
// Capsid watcher read /health all day. The media checks list MEDIA, OG and MEDIA_BACKUP in full, so an uncached /health made
// about 324K listings a month. The newest-dump read lists BACKUPS the same way; site-runtime's per-isolate hold
// left it at about 32 listings an hour, because isolates are many and short-lived, so it is kept here too.
//
// Same pattern as the Ask drift badge (ask-guard.server.ts): a TTL entry in APP_KV. KV refuses a TTL under 60
// seconds and a fresh write can take up to 60 seconds to reach other locations
// (developers.cloudflare.com/kv/api/write-key-value-pairs/), both fine for a verdict an hour old. A repair
// drops its entry (dropHealthVerdicts), so the recheck after it reads the bucket, not the verdict it fixed.

/** An hour: drift is repaired within the watchdog's pass, and a verdict this old harms nothing. */
const HEALTH_VERDICT_TTL_SECONDS = 60 * 60;

const PREFIX = "health:verdict:";

/** The R2-backed verdicts, by check name. */
export const CACHED_VERDICTS = ["media-index-drift", "media-backup-drift"] as const;

const BACKUP_KEY = `${PREFIX}backup-freshness`;

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

/** The kept verdict for `name`, or the result of `run`, which is then kept. A run that throws keeps nothing. */
export async function cachedVerdict(
  env: Pick<Env, "APP_KV">,
  name: (typeof CACHED_VERDICTS)[number],
  run: () => Promise<Verdict>,
): Promise<Verdict> {
  const key = `${PREFIX}${name}`;
  try {
    const kept = await env.APP_KV.get(key, "json");
    if (isVerdict(kept)) return kept;
  } catch {
    // An unreadable entry is a miss: the check still runs.
  }
  const verdict = await run();
  try {
    await env.APP_KV.put(key, JSON.stringify(verdict), { expirationTtl: HEALTH_VERDICT_TTL_SECONDS });
  } catch {
    // A failed write costs one more listing, never the answer.
  }
  return verdict;
}

/** For a repair: what it changed is not what the kept verdict says. */
export async function dropHealthVerdicts(env: Pick<Env, "APP_KV">): Promise<void> {
  await Promise.all([...CACHED_VERDICTS.map((name) => `${PREFIX}${name}`), BACKUP_KEY].map((key) => env.APP_KV.delete(key)));
}

interface KeptBackup {
  last_ok: string | null;
  age_hours: number | null;
  warning?: string;
}

function isKeptBackup(value: unknown): value is KeptBackup {
  if (typeof value !== "object" || value === null) return false;
  const v = value as KeptBackup;
  return "last_ok" in v && "age_hours" in v;
}

/** The newest-dump freshness, kept an hour. Its age is up to an hour behind; the warning threshold is 26 hours. */
export async function cachedBackupHealth(env: Pick<Env, "APP_KV">, run: () => Promise<KeptBackup>): Promise<KeptBackup> {
  try {
    const kept = await env.APP_KV.get(BACKUP_KEY, "json");
    if (isKeptBackup(kept)) return kept;
  } catch {
    // An unreadable entry is a miss.
  }
  const fresh = await run();
  try {
    await env.APP_KV.put(BACKUP_KEY, JSON.stringify(fresh), { expirationTtl: HEALTH_VERDICT_TTL_SECONDS });
  } catch {
    // A failed write costs one more listing, never the answer.
  }
  return fresh;
}
