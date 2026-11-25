// The nightly D1 dump, run by the site Worker's cron at 05:00 UTC (app/lib/cron-run.server.ts) and by hand
// through the operator API's run_job. BACKUPS holds backups/json/ and files/<name>/, both from d1-dump, and
// Capsid's off-account copy takes both. check:destructive lets only the d1-dump functions touch it.
// Also backed up: MEDIA (R2, to files/media/) and MEDIA_REVISIONS (every earlier set of a file's bytes, kept
// under `replaced/<key>/<sha256>`, to files/revisions/; its own bucket because MEDIA's listing is the media
// index's truth). Not backed up, being derived or transient: OG (rebuilt by build:og and the next CV save),
// APP_KV (caches), ASK_BUDGET (counters), AI_SEARCH (rebuilt by sync_ask), the queues (a lost media event is
// caught by sync_media; a webmention awaiting verification stays in D1 as `unverified`).

import { createSiteBackup, type BackupHealth, type SiteBackupStatus } from "@dustinedwards/d1-dump";
import { EXCLUDED_TABLES, REQUIRED_TABLES } from "~/lib/backup/policy.mjs";

type BackupEnv = Pick<Env, "DB" | "BACKUPS">;
type FilesEnv = Pick<Env, "MEDIA" | "MEDIA_REVISIONS" | "BACKUPS">;

// d1-dump's createSiteBackup holds the wiring: the checked dump (dump without the marker, its standard checks
// and credential-column check, then the marker and prune; a run that fails keeps its objects as evidence and is
// never the newest dump latestDump returns, so a bad run cannot become the restore point, and with no new
// complete run nothing is pruned), and one files backup per bucket under files/<name>/ in BACKUPS: MEDIA to
// files/media/, MEDIA_REVISIONS to files/revisions/. A files pass only lists and reads its source; it writes, and
// removes a copy 30 days after its source is gone, in BACKUPS alone.
const backup = createSiteBackup<FilesEnv & BackupEnv>({
  bucket: (env) => env.BACKUPS,
  dump: {
    exclude: [...EXCLUDED_TABLES],
    required: [...REQUIRED_TABLES],
    credentials: true,
  },
  files: [
    { name: "media", source: (env) => env.MEDIA },
    { name: "revisions", source: (env) => env.MEDIA_REVISIONS },
  ],
});

export async function backupD1(env: BackupEnv) {
  const { dump, pruned } = await backup.runBackup(env as FilesEnv & BackupEnv);
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

/**
 * One files pass over each bucket into BACKUPS, by the nightly cron and by hand as the same job through the
 * operator API's run_job. A pass goes on where the last one stopped, so a large first copy finishes over several nights.
 * Each pass runs even when the other throws, and the run then throws, so the cron records it failed and the next
 * night retries.
 */
export async function backupMedia(env: FilesEnv) {
  const names = ["media", "revisions"];
  const results = await Promise.allSettled(
    names.map((name) => backup.runFilesBackup(env as FilesEnv & BackupEnv, [name])),
  );
  const failed = results.flatMap((r, i) =>
    r.status === "rejected" ? [`${names[i]}: ${String(r.reason)}`] : [],
  );
  if (failed.length > 0) throw new Error(`files backup failed: ${failed.join("; ")}`);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value.files : []));
}

/** /health's backup field: the newest dump's age with each files backup's, and any one's warning warns. */
export async function backupStatus(
  env: Pick<Env, "BACKUPS">,
): Promise<SiteBackupStatus & { files: Record<string, BackupHealth> }> {
  // Both passes are configured, so `files` is always there.
  return (await backup.status(env as FilesEnv & BackupEnv)) as SiteBackupStatus & {
    files: Record<string, BackupHealth>;
  };
}
