// The nightly D1 dump, run by the site Worker's own cron at 05:00 UTC (workers/app.ts), and by hand
// through the operator API's backup_d1.
//
// BACKUPS is a separate bucket from MEDIA_BACKUP on purpose: check:destructive allows pruneDumps on
// this binding and no delete at all on the media mirror.

import { readPlan, runCheckedBackup } from "@dustinedwards/d1-dump";
import { EXCLUDED_TABLES, REQUIRED_TABLES, dumpProblems } from "~/lib/backup/policy.mjs";

type BackupEnv = Pick<Env, "DB" | "BACKUPS">;

export async function backupD1(env: BackupEnv) {
  // d1-dump's runCheckedBackup: dump without the marker, run its standard checks and this site's
  // policy, then write the marker and prune. A run that fails keeps its objects as evidence and is
  // never the newest dump latestDump returns, so a bad run cannot become the restore point; with no
  // new complete run, nothing is pruned.
  const { dump, pruned } = await runCheckedBackup(env.DB, env.BACKUPS, {
    exclude: [...EXCLUDED_TABLES],
    required: [...REQUIRED_TABLES],
    check: async (d) => dumpProblems({ tables: d.tables, excluded: d.excluded, schema: (await readPlan(env.DB)).schema }),
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
