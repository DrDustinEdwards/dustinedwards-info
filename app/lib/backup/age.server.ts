import { backupHealth } from "@dustinedwards/d1-dump";

/**
 * The newest complete D1 dump's time and age, for the public health body. Never throws, and drops
 * backupHealth's warning text: an unreadable bucket reads as nulls, which is the answer a caller
 * needs, and the cause is logged by name instead of going on the wire.
 */
export async function backupAge(env: Pick<Env, "BACKUPS">): Promise<{ last_ok: string | null; age_hours: number | null }> {
  const health = await backupHealth(env.BACKUPS);
  if (health.warning && health.last_ok === null) {
    console.error(JSON.stringify({ alert: "backup-age-unreadable", warning: health.warning }));
  }
  return { last_ok: health.last_ok, age_hours: health.age_hours };
}
