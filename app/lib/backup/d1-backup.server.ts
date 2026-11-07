// The nightly D1 dump, run by the site Worker's own cron at 05:00 UTC (app/lib/cron-run.server.ts), and by hand
// as the same job through the operator API's run_job.
//
// BACKUPS holds the dumps under backups/json/ and the files backups under files/<name>/, both from d1-dump, and
// Capsid's nightly off-account copy (capsid-backups offaccount.yml) takes both to Amazon. check:destructive lets only
// the d1-dump functions touch it: pruneDumps deletes dump runs outside retention, and backupFiles removes a copy 30 days
// after its source is gone.
//
// WHAT ELSE THE SITE HOLDS, AND HOW EACH IS COVERED (area 8, B6 and B7):
// - MEDIA (R2): the uploaded originals, copied nightly to files/media/ by d1-dump's files backup (backupMedia below).
// - MEDIA_REVISIONS (R2): every earlier set of a file's bytes, kept by site-api's media library under
//   `replaced/<key>/<sha256>` before an overwrite (`replaced/<time>/<key>` and `resized/<time>/<key>` before v0.24.0),
//   with a deleted file's last bytes, and never deleted (media-adapter.server.ts), copied nightly to files/revisions/ the same way. It is a bucket of its own
//   because a revert reads it back and MEDIA's listing is the media index's truth (media-index-drift).
// Not backed up, because each is derived or transient:
// - OG (R2): share cards and the CV PDF, rebuilt by build:og and the next CV save.
// - APP_KV: caches (Ask answers, drift, the health snapshot) and the publication check's mailed DOIs, each
//   rewritten by its next read or firing.
// - ASK_BUDGET (Durable Object): rate-limit counters, which reset by design.
// - AI_SEARCH: the Ask index, rebuilt from the published pages by ship's sync_ask.
// - The queues: messages in flight; a lost media event is caught by Capsid's watcher's sync_media repair, and a
//   webmention row waiting on verification stays in D1 (dumped) as `unverified`.

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
