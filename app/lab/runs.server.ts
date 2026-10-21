/**
 * /lab/runs: run records with the lots they used (docs/KNOWLEDGE-BASE.md step 7, finding P2), so a bad lot traces to
 * every run that used it.
 *
 * Append-only (Dustin, 2026-10-11): a saved run is never edited. A correction is a new run naming the one it replaces,
 * recorded by the run's own author or by someone who reads all runs, and a run is replaced at most once. The tables'
 * triggers refuse any UPDATE or DELETE whatever the code does.
 *
 * A new run's lot changes are writes to kb_lots, each with its kb_audit row in the same batch: the amount it used comes
 * off the lot (in the lot's own unit), a lot first used today is marked opened, and a lot the run emptied is marked
 * empty. A correction records the lots it used for the trace and changes no lot: a lot's amount is put right on its own
 * page, which audits that too.
 */

import { can, type Actor } from "@dustinedwards/site-runtime/members";

import { getLot, listLots, lotChange, type LotRow } from "~/db/inventory";
import { getRun, listRunnableProcedures, listRuns, runIdByUid, runInsert, runLots, type RunRow } from "~/db/runs";

import { amountOf, amountText, field, idOf, isDate, today } from "./forms.mjs";
import { itemNames, withItem } from "./inventory.server";
import { PERMISSION } from "./titles.mjs";

export type RunResult = { ok: boolean; text: string; runId?: number };

/** How many lot rows the record form offers: enough for a protocol's reagents, and the form works with no script. */
const LOT_ROWS = 6;
const OUTCOMES = ["completed", "failed", "abandoned"] as const;
const NOTE_MAX = 4000;

function refused(text: string): RunResult {
  return { ok: false, text };
}

/** Whether `actor` may see `run`: their own, or every run with `read_all_runs`. */
function canSeeRun(actor: Actor, run: Pick<RunRow, "actor">): boolean {
  return run.actor === actor.email || can(actor, PERMISSION.readAllRuns);
}

/** The lots as a form offers them: item, lot number and what is left. */
function lotLabels(names: Map<string, string>, lots: LotRow[]) {
  return lots.map((l) => {
    const item = withItem(l, names).item;
    return { value: String(l.id), label: `${item}, lot ${l.lot_number}${l.amount !== null ? ` (${amountText(l.amount, l.unit)} left)` : ""}` };
  });
}

export async function runsPage(env: Env, actor: Actor) {
  const all = can(actor, PERMISSION.readAllRuns);
  const [runs, procedures, lots, names] = await Promise.all([listRuns(env, all ? null : actor.email), listRunnableProcedures(env), listLots(env), itemNames(env)]);
  const titles = new Map(procedures.map((p) => [p.slug, p.title]));
  return {
    runs: runs.map((r) => ({ ...r, title: titles.get(r.procedure_slug) ?? r.procedure_slug })),
    procedures,
    lots: lotLabels(
      names,
      lots.filter((l) => l.status === "in_stock"),
    ),
    all,
    canRecord: can(actor, PERMISSION.recordRun),
    lotRows: LOT_ROWS,
  };
}

/** One run, its lots and its line of corrections, or null when it does not exist or is not the actor's to see. */
export async function runPage(env: Env, actor: Actor, id: number) {
  const run = await getRun(env, id);
  if (!run || !canSeeRun(actor, run)) return null;
  const [used, procedures, names, lots] = await Promise.all([runLots(env, id), listRunnableProcedures(env), itemNames(env), listLots(env)]);
  const title = procedures.find((p) => p.slug === run.procedure_slug)?.title ?? run.procedure_slug;
  return {
    run: { ...run, title },
    lots: used.map((l) => ({ ...l, item: names.get(`${l.item_kind}:${l.item_id}`) ?? l.item_id })),
    // The run's own protocol stays a choice even if it is no longer published, so it can still be corrected.
    procedures: procedures.some((p) => p.slug === run.procedure_slug) ? procedures : [{ slug: run.procedure_slug, title, version: run.procedure_version }, ...procedures],
    allLots: lotLabels(names, lots),
    canCorrect: run.replaced_by === null && can(actor, PERMISSION.recordRun) && canSeeRun(actor, run),
    lotRows: LOT_ROWS,
  };
}

type LotUse = { lot: LotRow; amount_used: number | null; emptied: boolean };

/** The lots a post names, each checked: it exists, is named once, and (for a new run) is in stock with enough left. */
async function lotUses(env: Env, form: FormData, correction: boolean): Promise<{ ok: true; uses: LotUse[] } | { ok: false; reason: string }> {
  const uses: LotUse[] = [];
  for (let i = 0; i < LOT_ROWS; i += 1) {
    const text = field(form, `lot-${i}`);
    if (!text) continue;
    const id = idOf(text);
    const lot = id ? await getLot(env, id) : null;
    if (!lot) return { ok: false, reason: "One of those lots does not exist." };
    if (uses.some((u) => u.lot.id === lot.id)) return { ok: false, reason: `Lot ${lot.lot_number} is named twice.` };
    const amount = amountOf(field(form, `amount-${i}`));
    if (!amount.ok) return amount;
    const emptied = field(form, `emptied-${i}`) === "yes";
    if (!correction) {
      if (lot.status !== "in_stock") return { ok: false, reason: `Lot ${lot.lot_number} is ${lot.status.replace("_", " ")}, so a new run cannot use it.` };
      if (amount.value !== null && lot.amount !== null && amount.value > lot.amount) {
        return { ok: false, reason: `Lot ${lot.lot_number} has only ${amountText(lot.amount, lot.unit)} left.` };
      }
    }
    uses.push({ lot, amount_used: amount.value, emptied });
  }
  return { ok: true, uses };
}

/**
 * Records a run as `actor`, or, with `replacesId`, a correction of that run. A correction comes only from the run's own
 * page (the id is in its address), never from a form field. Nothing is saved unless every check passes.
 */
export async function recordRun(
  env: Env,
  actor: Actor,
  form: FormData,
  nowMs: number,
  { replacesId = null, uid = crypto.randomUUID() }: { replacesId?: number | null; uid?: string } = {},
): Promise<RunResult> {
  if (!can(actor, PERMISSION.recordRun)) return refused("You cannot record runs.");

  let replaces: RunRow | null = null;
  if (replacesId !== null) {
    replaces = await getRun(env, replacesId);
    if (!replaces || !canSeeRun(actor, replaces)) return refused("That run does not exist.");
    if (replaces.replaced_by !== null) return refused(`Run ${replaces.id} is already corrected by run ${replaces.replaced_by}: correct that one.`);
  }

  // A correction that keeps the run's protocol keeps the version it followed then, published or not.
  const slug = field(form, "procedure");
  const procedure =
    replaces && slug === replaces.procedure_slug
      ? { slug, title: slug, version: replaces.procedure_version }
      : (await listRunnableProcedures(env)).find((p) => p.slug === slug);
  if (!procedure) return refused("Choose the protocol the run followed.");
  const runOn = field(form, "run_on") || today(nowMs);
  if (!isDate(runOn)) return refused(`Not a date (YYYY-MM-DD): ${runOn}.`);
  if (runOn > today(nowMs)) return refused("A run is recorded on or after the day it happened.");
  const outcome = field(form, "outcome") || "completed";
  if (!(OUTCOMES as readonly string[]).includes(outcome)) return refused(`Unknown outcome: ${outcome}.`);
  const note = field(form, "note");
  if (note.length > NOTE_MAX) return refused(`The note is longer than ${NOTE_MAX} characters.`);

  const checked = await lotUses(env, form, replaces !== null);
  if (!checked.ok) return refused(checked.reason);
  const uses = checked.uses;
  if (!replaces && uses.some((u) => u.amount_used !== null || u.emptied || u.lot.opened === null) && !can(actor, PERMISSION.useLot)) {
    return refused("You cannot change lots, so the run cannot take from them.");
  }

  const statements = runInsert(
    env,
    { uid, procedure_slug: procedure.slug, procedure_version: procedure.version, actor: actor.email, run_on: runOn, outcome: outcome as RunRow["outcome"], note: note || null, replaces_run_id: replaces?.id ?? null },
    uses.map((u) => ({ lot_id: u.lot.id, amount_used: u.amount_used, unit: u.lot.unit, emptied: u.emptied })),
  );
  if (!replaces) {
    for (const u of uses) {
      const takes = u.amount_used !== null && u.lot.amount !== null;
      // The lot was in stock when it was read. If it left stock since, this sets an impossible amount, which fails
      // kb_lots_amount_check and aborts the whole batch: no run is saved against an emptied or discarded lot.
      statements.push(env.DB.prepare("UPDATE kb_lots SET amount = -1 WHERE id = ? AND status <> 'in_stock'").bind(u.lot.id));
      if (!takes && !u.emptied && u.lot.opened !== null) continue;
      statements.push(
        ...lotChange(
          env,
          actor.email,
          u.lot.id,
          env.DB.prepare(
            "UPDATE kb_lots SET amount = CASE WHEN ?1 IS NULL OR amount IS NULL THEN amount ELSE amount - ?1 END, opened = coalesce(opened, ?2), status = CASE WHEN ?3 = 1 THEN 'empty' ELSE status END, updated_at = unixepoch() WHERE id = ?4",
          ).bind(u.amount_used, runOn, u.emptied ? 1 : 0, u.lot.id),
        ),
      );
    }
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/kb_lots_amount_check/.test(message)) return refused("A lot ran short or left stock while the run was saved; nothing was recorded. Check the lots and try again.");
    if (/UNIQUE constraint failed: kb_runs.replaces_run_id/.test(message)) return refused("That run was corrected a moment ago: correct the newer run.");
    throw error;
  }
  const runId = (await runIdByUid(env, uid)) ?? undefined;
  const lots = uses.length === 1 ? "1 lot" : `${uses.length} lots`;
  return {
    ok: true,
    runId,
    text: replaces ? `Recorded run ${runId}, correcting run ${replaces.id}, with ${lots}.` : `Recorded run ${runId} of ${procedure.title}, with ${lots}.`,
  };
}
