// Run records (drizzle/0031_kb_runs.sql): append-only. Rows are only ever inserted here; the migration's triggers refuse
// any UPDATE or DELETE, so a correction is a new run naming the one it replaces.

export type RunRow = {
  id: number;
  uid: string;
  procedure_slug: string;
  procedure_version: string | null;
  actor: string;
  run_on: string;
  outcome: "completed" | "failed" | "abandoned";
  note: string | null;
  replaces_run_id: number | null;
  replaced_by: number | null;
  created_at: number;
};

export type RunLotRow = {
  run_id: number;
  lot_id: number;
  amount_used: number | null;
  unit: string | null;
  emptied: number;
  item_kind: string;
  item_id: string;
  lot_number: string;
};

const RUN_SELECT = `SELECT r.id, r.uid, r.procedure_slug, r.procedure_version, r.actor, r.run_on, r.outcome, r.note, r.replaces_run_id,
  (SELECT n.id FROM kb_runs n WHERE n.replaces_run_id = r.id) AS replaced_by, r.created_at FROM kb_runs r`;

/** Runs newest first: everyone's, or one person's. */
export async function listRuns(env: Env, actor: string | null): Promise<RunRow[]> {
  const statement = actor
    ? env.DB.prepare(`${RUN_SELECT} WHERE r.actor = ? ORDER BY r.id DESC LIMIT 200`).bind(actor)
    : env.DB.prepare(`${RUN_SELECT} ORDER BY r.id DESC LIMIT 200`);
  return (await statement.all<RunRow>()).results;
}

export async function getRun(env: Env, id: number): Promise<RunRow | null> {
  return env.DB.prepare(`${RUN_SELECT} WHERE r.id = ?`).bind(id).first<RunRow>();
}

export async function runLots(env: Env, runId: number): Promise<RunLotRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.run_id, u.lot_id, u.amount_used, u.unit, u.emptied, l.item_kind, l.item_id, l.lot_number
     FROM kb_run_lots u JOIN kb_lots l ON l.id = u.lot_id WHERE u.run_id = ? ORDER BY l.item_kind, l.item_id`,
  )
    .bind(runId)
    .all<RunLotRow>();
  return results;
}

/** Every run that used a lot, newest first: the trace from a bad lot to its runs. Narrowed to one person's when given. */
export async function runsUsingLot(env: Env, lotId: number, actor: string | null): Promise<RunRow[]> {
  const where = actor ? "AND r.actor = ?" : "";
  const statement = env.DB.prepare(`${RUN_SELECT} WHERE r.id IN (SELECT run_id FROM kb_run_lots WHERE lot_id = ?) ${where} ORDER BY r.id DESC`);
  return (await (actor ? statement.bind(lotId, actor) : statement.bind(lotId)).all<RunRow>()).results;
}

export type NewRun = {
  uid: string;
  procedure_slug: string;
  procedure_version: string | null;
  actor: string;
  run_on: string;
  outcome: RunRow["outcome"];
  note: string | null;
  replaces_run_id: number | null;
};

/** The run's own row and one row per lot it used, the lots naming the run by its uid in the same batch. */
export function runInsert(env: Env, run: NewRun, lots: Array<{ lot_id: number; amount_used: number | null; unit: string | null; emptied: boolean }>): D1PreparedStatement[] {
  return [
    env.DB.prepare(
      "INSERT INTO kb_runs (uid, procedure_slug, procedure_version, actor, run_on, outcome, note, replaces_run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(run.uid, run.procedure_slug, run.procedure_version, run.actor, run.run_on, run.outcome, run.note, run.replaces_run_id),
    ...lots.map((l) =>
      env.DB.prepare("INSERT INTO kb_run_lots (run_id, lot_id, amount_used, unit, emptied) SELECT id, ?, ?, ?, ? FROM kb_runs WHERE uid = ?").bind(
        l.lot_id,
        l.amount_used,
        l.unit,
        l.emptied ? 1 : 0,
        run.uid,
      ),
    ),
  ];
}

export async function runIdByUid(env: Env, uid: string): Promise<number | null> {
  const row = await env.DB.prepare("SELECT id FROM kb_runs WHERE uid = ?").bind(uid).first<{ id: number }>();
  return row?.id ?? null;
}

/** The protocols a run can follow: the published ones, by title. */
export async function listRunnableProcedures(env: Env): Promise<Array<{ slug: string; title: string; version: string | null }>> {
  const { results } = await env.DB.prepare(
    "SELECT slug, title, version FROM procedures WHERE status = 'published' AND profile = 'protocol' ORDER BY title",
  ).all<{ slug: string; title: string; version: string | null }>();
  return results;
}
