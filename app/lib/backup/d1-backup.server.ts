// The nightly D1 dump, run by the site Worker's own cron at 05:00 UTC (workers/app.ts), and by hand
// through the operator API's backup_d1.
//
// BACKUPS is a separate bucket from MEDIA_BACKUP on purpose: check:destructive allows pruneDumps on
// this binding and no delete at all on the media mirror.
//
// WHAT ELSE THE SITE HOLDS, AND HOW EACH IS COVERED (area 8, B6 and B7):
// - MEDIA (R2): mirrored to MEDIA_BACKUP by this site's own code (app/lib/media/backup.server.ts), not
//   d1-dump's backupFiles, and that stays: MEDIA_BACKUP is also the revision store. Every earlier set of a
//   file's bytes is copied there under `replaced/<time>/<key>` before an overwrite and never deleted
//   (revisions.server.ts), and a revert reads it back. backupFiles copies objects forward into a pruned
//   files prefix; it keeps no history of a key's bytes, so it would be a second copy, not the store.
// Not backed up, because each is derived or transient:
// - OG (R2): share cards and the CV PDF, rebuilt by build:og and the next CV save.
// - APP_KV: caches (Ask answers, drift, the health snapshot) and the watchdog's alert state, each
//   rewritten by its next read or firing.
// - ASK_BUDGET (Durable Object): rate-limit counters, which reset by design.
// - AI_SEARCH: the Ask index, rebuilt from the published pages by ship's sync_ask.
// - The queues: messages in flight; a lost media event is caught by the watchdog's mirror pass, and a
//   webmention row waiting on verification stays in D1 (dumped) as `unverified`.

import { runCheckedBackup } from "@dustinedwards/d1-dump";
import { EXCLUDED_TABLES, REQUIRED_TABLES } from "~/lib/backup/policy.mjs";

type BackupEnv = Pick<Env, "DB" | "BACKUPS">;

export async function backupD1(env: BackupEnv) {
  // d1-dump's runCheckedBackup: dump without the marker, run its standard checks (not empty, every
  // required table present, nothing excluded in the dump) and its credential-column check, then write
  // the marker and prune. A run that fails keeps its objects as evidence and is never the newest dump
  // latestDump returns, so a bad run cannot become the restore point; with no new complete run,
  // nothing is pruned.
  const { dump, pruned } = await runCheckedBackup(env.DB, env.BACKUPS, {
    exclude: [...EXCLUDED_TABLES],
    required: [...REQUIRED_TABLES],
    credentials: true,
  });
  return {
    run_id: dump.run_id,
    exported_at: dump.exported_at,
    tables: dump.tables.length,
    rows: dump.tables.reduce((sum, t) => sum + t.rows, 0),
    kept: pruned.kept,
    pruned: pruned.pruned,
    locked: pruned.locked,
  };
}
