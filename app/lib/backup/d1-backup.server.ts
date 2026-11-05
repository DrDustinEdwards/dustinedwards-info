// The nightly D1 dump, run by the site Worker's own cron at 05:00 UTC (workers/app.ts), and by hand
// through the operator API's backup_d1.
//
// BACKUPS holds the dumps under backups/json/ and the files backups under files/<name>/, both from d1-dump, and
// Capsid's nightly off-account copy (capsid-backups offaccount.yml) takes both to Amazon. check:destructive lets only
// the d1-dump functions touch it: pruneDumps deletes dump runs outside retention, and backupFiles removes a copy 30 days
// after its source is gone.
//
// WHAT ELSE THE SITE HOLDS, AND HOW EACH IS COVERED (area 8, B6 and B7):
// - MEDIA (R2): the uploaded originals, copied nightly to files/media/ by backupFiles (backupMedia below).
// - MEDIA_REVISIONS (R2): every earlier set of a file's bytes, kept under `replaced/<time>/<key>` before an overwrite
//   and never deleted (revisions.server.ts), copied nightly to files/revisions/ the same way. It is a bucket of its own
//   because a revert reads it back and MEDIA's listing is the media index's truth (media-index-drift).
// Not backed up, because each is derived or transient:
// - OG (R2): share cards and the CV PDF, rebuilt by build:og and the next CV save.
// - APP_KV: caches (Ask answers, drift, the health snapshot) and the watchdog's alert state, each
//   rewritten by its next read or firing.
// - ASK_BUDGET (Durable Object): rate-limit counters, which reset by design.
// - AI_SEARCH: the Ask index, rebuilt from the published pages by ship's sync_ask.
// - The queues: messages in flight; a lost media event is caught by the watchdog's sync_media pass, and a
//   webmention row waiting on verification stays in D1 (dumped) as `unverified`.

import { backupFiles, backupHealth, filesHealth, runCheckedBackup, type BackupHealth } from "@dustinedwards/d1-dump";
import { EXCLUDED_TABLES, REQUIRED_TABLES } from "~/lib/backup/policy.mjs";

type BackupEnv = Pick<Env, "DB" | "BACKUPS">;
type FilesEnv = Pick<Env, "MEDIA" | "MEDIA_REVISIONS" | "BACKUPS">;

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

/** The files backups, by name under files/ in BACKUPS: MEDIA to files/media/, MEDIA_REVISIONS to files/revisions/. */
const FILES_NAMES = ["media", "revisions"] as const;

/**
 * One backupFiles pass over each bucket into BACKUPS, by the nightly cron and by hand through the operator API's
 * backup_media. A pass goes on where the last one stopped, so a large first copy finishes over several nights.
 * backupFiles only lists and reads its source; it writes, and removes a copy 30 days after its source is gone, under
 * files/<name>/ in BACKUPS alone. Each pass runs even when the other throws, and the run then throws, so the cron
 * records it failed and the next night retries.
 */
export async function backupMedia(env: FilesEnv) {
  const results = await Promise.allSettled([
    backupFiles(env.MEDIA, env.BACKUPS, { name: "media" }),
    backupFiles(env.MEDIA_REVISIONS, env.BACKUPS, { name: "revisions" }),
  ]);
  const failed = results.flatMap((r, i) => (r.status === "rejected" ? [`${FILES_NAMES[i]}: ${String(r.reason)}`] : []));
  if (failed.length > 0) throw new Error(`files backup failed: ${failed.join("; ")}`);
  return results.map((r) => {
    const run = (r as PromiseFulfilledResult<Awaited<ReturnType<typeof backupFiles>>>).value;
    return { name: run.name, complete: run.complete, ...run.counts };
  });
}

/** /health's backup field: the newest dump's age with each files backup's, and any one's warning warns. */
export async function backupStatus(env: Pick<Env, "BACKUPS">): Promise<BackupHealth & { files: Record<string, BackupHealth> }> {
  const [dump, ...files] = await Promise.all([
    backupHealth(env.BACKUPS),
    ...FILES_NAMES.map((name) => filesHealth(env.BACKUPS, { name })),
  ]);
  const byName = Object.fromEntries(FILES_NAMES.map((name, i) => [name, files[i]!]));
  const warnings = [dump!.warning, ...files.map((f, i) => (f.warning ? `${FILES_NAMES[i]} files: ${f.warning}` : undefined))];
  const warning = warnings.filter(Boolean).join("; ");
  return { ...dump!, files: byName, ...(warning ? { warning } : {}) };
}
