// The nightly D1 dump. The Worker holds DB and BACKUPS; the watchdog's cron reaches it through the
// operator API (workers/watchdog.ts), because the site Worker has no cron by ruling and the
// watchdog holds no database binding.
//
// BACKUPS is a separate bucket from MEDIA_BACKUP on purpose: check:destructive allows pruneDumps on
// this binding and no delete at all on the media mirror.

import { dumpDatabase, pruneDumps, readPlan, writeCompleteMarker } from "@dustinedwards/d1-dump";
import { EXCLUDED_TABLES, dumpProblems } from "~/lib/backup/policy.mjs";

type BackupEnv = Pick<Env, "DB" | "BACKUPS">;

export async function backupD1(env: BackupEnv) {
  // markComplete false: a run that fails the policy keeps its objects as evidence and is never the
  // newest dump latestDump returns, so a bad run cannot become the restore point.
  const dump = await dumpDatabase(env.DB, env.BACKUPS, {
    markComplete: false,
    exclude: [...EXCLUDED_TABLES],
  });
  const plan = await readPlan(env.DB);
  const problems = dumpProblems({ tables: dump.tables, excluded: dump.excluded, schema: plan.schema });
  if (problems.length > 0) {
    throw new Error(`the D1 dump ${dump.run_id} was left incomplete: ${problems.join("; ")}`);
  }
  await writeCompleteMarker(env.BACKUPS, dump);
  // After the marker and never before: with no complete run pruneDumps deletes nothing.
  const pruned = await pruneDumps(env.BACKUPS);
  return {
    run_id: dump.run_id,
    exported_at: dump.exported_at,
    tables: dump.tables.length,
    rows: dump.tables.reduce((sum, t) => sum + t.rows, 0),
    kept: pruned.kept,
    pruned: pruned.pruned,
  };
}
