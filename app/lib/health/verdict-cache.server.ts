// The R2 listings behind /health, kept for an hour. Every listing is a Class A operation, billed after the
// first million a month (developers.cloudflare.com/r2/pricing/), and the watchdog, the live gates and the
// Capsid watcher read /health all day. The media checks list MEDIA, OG and MEDIA_BACKUP in full and the backup
// check lists BACKUPS, so an uncached /health made about 324K listings a month.
//
// Same pattern as the Ask drift badge (ask-guard.server.ts): a TTL entry in APP_KV. KV refuses a TTL under 60
// seconds and a fresh write can take up to 60 seconds to reach other locations
// (developers.cloudflare.com/kv/api/write-key-value-pairs/), both fine for a verdict an hour old. A repair
// drops its entry (dropHealthVerdicts), so the recheck after it reads the bucket, not the verdict it fixed.

import { backupHealth, DEFAULT_STALE_HOURS, type BackupHealth } from "@dustinedwards/d1-dump";

/** An hour: drift is repaired within the watchdog's pass, and a verdict this old harms nothing. */
const HEALTH_VERDICT_TTL_SECONDS = 60 * 60;

const PREFIX = "health:verdict:";
const BACKUP_KEY = "health:backup-stamp";

/** The R2-backed verdicts, by check name. */
export const CACHED_VERDICTS = ["media-index-drift", "media-backup-drift"] as const;

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
  await Promise.all(CACHED_VERDICTS.map((name) => env.APP_KV.delete(`${PREFIX}${name}`)));
}

/**
 * backupHealth lists the BACKUPS runs on every call. The newest dump's stamp is kept for an hour and the age is
 * worked out from it each time, so age_hours stays true while the listing is skipped. A warning (no dump, an
 * unreadable listing) is not kept: it re-reads until the bucket answers.
 */
export async function cachedBackupHealth(
  env: Pick<Env, "APP_KV" | "BACKUPS">,
  now: Date = new Date(),
): Promise<BackupHealth> {
  try {
    const kept = await env.APP_KV.get<{ last_ok: string }>(BACKUP_KEY, "json");
    if (kept && typeof kept.last_ok === "string") {
      const ageMs = now.getTime() - Date.parse(kept.last_ok);
      if (Number.isFinite(ageMs)) {
        const ageHours = Math.round((ageMs / 3_600_000) * 10) / 10;
        const health: BackupHealth = { last_ok: kept.last_ok, age_hours: ageHours };
        if (ageMs > DEFAULT_STALE_HOURS * 3_600_000) {
          health.warning = `last complete dump was ${ageHours}h ago, over the ${DEFAULT_STALE_HOURS}h threshold`;
        }
        // A stale stamp may mean a newer dump has landed: read the bucket to find out.
        if (!health.warning) return health;
      }
    }
  } catch {
    // A miss.
  }
  const health = await backupHealth(env.BACKUPS, { now });
  if (!health.warning && health.last_ok) {
    try {
      await env.APP_KV.put(BACKUP_KEY, JSON.stringify({ last_ok: health.last_ok }), {
        expirationTtl: HEALTH_VERDICT_TTL_SECONDS,
      });
    } catch {
      // Costs one more listing.
    }
  }
  return health;
}
