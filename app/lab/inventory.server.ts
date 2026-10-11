/**
 * /lab/inventory: the lab's lots and where they are (docs/KNOWLEDGE-BASE.md steps 4 and 7). A lot names a registry
 * item by its kind and id; the item's public facts stay in content/registry/, and the lot's number, amount, expiry and
 * place live only in D1. Every write to a lot or a location writes its kb_audit row in the same batch
 * (app/db/inventory.ts). Who may do what is a permission, never a title: `read` to see, `use_lot` to mark a lot opened
 * or empty, `edit_inventory` to add and change lots and locations.
 */

import { can, type Actor } from "@dustinedwards/site-runtime/members";

import { getLot, listLocations, listLots, lotAudit, lotChange, lotInsert, locationInsert, type LotRow } from "~/db/inventory";
import { listRegistry } from "~/db/registry";
import { listRunnableProcedures, runsUsingLot } from "~/db/runs";

import { amountOf, field, idOf, isDate, today } from "./forms.mjs";
import { PERMISSION } from "./titles.mjs";

export type InventoryResult = { ok: boolean; text: string };

export type LotView = LotRow & { item: string };

const STATUSES = ["in_stock", "empty", "discarded"] as const;

/** Every registry item by its address, `kind:id`, with the name the lab knows it by. */
export async function itemNames(env: Env): Promise<Map<string, string>> {
  const items = await listRegistry(env);
  return new Map(items.map((i) => [`${i.kind}:${i.id}`, i.name]));
}

export function withItem(lot: LotRow, names: Map<string, string>): LotView {
  return { ...lot, item: names.get(`${lot.item_kind}:${lot.item_id}`) ?? `${lot.item_kind} ${lot.item_id}` };
}

export async function inventoryPage(env: Env, actor: Actor) {
  const [lots, locations, names] = await Promise.all([listLots(env), listLocations(env), itemNames(env)]);
  const edits = can(actor, PERMISSION.editInventory);
  return {
    lots: lots.map((l) => withItem(l, names)),
    locations,
    items: edits ? [...names.entries()].map(([value, label]) => ({ value, label: `${label} (${value.split(":")[0]})` })).sort((a, b) => a.label.localeCompare(b.label)) : [],
    canEdit: edits,
    canUse: can(actor, PERMISSION.useLot),
  };
}

/** One lot, its history and the runs that used it: everyone's for a reader of all runs, otherwise the person's own. */
export async function lotPage(env: Env, actor: Actor, id: number) {
  const lot = await getLot(env, id);
  if (!lot) return null;
  const allRuns = can(actor, PERMISSION.readAllRuns);
  const [names, audit, runs, locations, procedures] = await Promise.all([
    itemNames(env),
    lotAudit(env, id),
    runsUsingLot(env, id, allRuns ? null : actor.email),
    listLocations(env),
    listRunnableProcedures(env),
  ]);
  const titles = new Map(procedures.map((p) => [p.slug, p.title]));
  return {
    lot: withItem(lot, names),
    // The history names who changed the lot, and a run's change names its author: someone who may see only their own
    // runs sees only their own rows, unless they keep the inventory.
    audit: allRuns || can(actor, PERMISSION.editInventory) ? audit : audit.filter((row) => row.actor === actor.email),
    runs: runs.map((r) => ({ ...r, title: titles.get(r.procedure_slug) ?? r.procedure_slug })),
    locations,
    allRuns,
    canEdit: can(actor, PERMISSION.editInventory),
    canUse: can(actor, PERMISSION.useLot),
  };
}

function refused(text: string): InventoryResult {
  return { ok: false, text };
}

/** A D1 constraint error read as the words a person needs; anything else is thrown on. */
function constraintText(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE/.test(message)) return "That is already recorded.";
  if (/kb_lots_amount_check/.test(message)) return "A lot's amount cannot go below zero.";
  if (/CHECK|FOREIGN KEY/.test(message)) return "That change breaks a rule of the inventory, so nothing was saved.";
  return null;
}

async function run(env: Env, statements: D1PreparedStatement[], done: string): Promise<InventoryResult> {
  try {
    await env.DB.batch(statements);
  } catch (error) {
    const text = constraintText(error);
    if (text) return refused(text);
    throw error;
  }
  return { ok: true, text: done };
}

function optionalDate(form: FormData, name: string): { ok: true; value: string | null } | { ok: false; reason: string } {
  const text = field(form, name);
  if (!text) return { ok: true, value: null };
  return isDate(text) ? { ok: true, value: text } : { ok: false, reason: `Not a date (YYYY-MM-DD): ${text}.` };
}

async function locationId(env: Env, text: string): Promise<{ ok: true; value: number | null } | { ok: false; reason: string }> {
  if (!text) return { ok: true, value: null };
  const id = idOf(text);
  const known = (await listLocations(env)).some((l) => l.id === id);
  return known ? { ok: true, value: id } : { ok: false, reason: "That location does not exist." };
}

/** Runs one post from the inventory pages as `actor`, each intent behind its own permission. */
export async function inventoryAction(env: Env, actor: Actor, form: FormData, nowMs: number): Promise<InventoryResult> {
  const intent = field(form, "intent");

  if (intent === "mark_opened" || intent === "mark_empty") {
    if (!can(actor, PERMISSION.useLot)) return refused("You cannot mark lots.");
    const lotId = idOf(field(form, "lot"));
    const lot = lotId ? await getLot(env, lotId) : null;
    if (!lot) return refused("That lot does not exist.");
    if (lot.status !== "in_stock") return refused(`Lot ${lot.lot_number} is ${lot.status.replace("_", " ")}.`);
    const update =
      intent === "mark_opened"
        ? env.DB.prepare("UPDATE kb_lots SET opened = coalesce(opened, ?), updated_at = unixepoch() WHERE id = ?").bind(today(nowMs), lot.id)
        : env.DB.prepare("UPDATE kb_lots SET status = 'empty', updated_at = unixepoch() WHERE id = ?").bind(lot.id);
    return run(env, lotChange(env, actor.email, lot.id, update), intent === "mark_opened" ? `Lot ${lot.lot_number} marked opened.` : `Lot ${lot.lot_number} marked empty.`);
  }

  if (!can(actor, PERMISSION.editInventory)) return refused("You cannot change the inventory.");

  if (intent === "add_location") {
    const name = field(form, "name");
    if (!name) return refused("Name the location.");
    const parent = await locationId(env, field(form, "parent"));
    if (!parent.ok) return refused(parent.reason);
    return run(env, locationInsert(env, actor.email, name, parent.value), `Added ${name}.`);
  }

  if (intent === "add_lot") {
    const [kind, id] = field(form, "item").split(":");
    if (!kind || !id || !(await itemNames(env)).has(`${kind}:${id}`)) return refused("Choose an item from the registry.");
    const lotNumber = field(form, "lot_number");
    if (!lotNumber) return refused("Type the lot number from the label.");
    const expiry = optionalDate(form, "expiry");
    const received = optionalDate(form, "received");
    const amount = amountOf(field(form, "amount"));
    const location = await locationId(env, field(form, "location"));
    for (const check of [expiry, received, amount, location]) if (!check.ok) return refused(check.reason);
    return run(
      env,
      lotInsert(env, actor.email, {
        item_kind: kind,
        item_id: id,
        lot_number: lotNumber,
        expiry: expiry.ok ? expiry.value : null,
        received: received.ok ? received.value : null,
        amount: amount.ok ? amount.value : null,
        unit: field(form, "unit") || null,
        location_id: location.ok ? location.value : null,
      }),
      `Added lot ${lotNumber}.`,
    );
  }

  if (intent === "edit_lot") {
    const lotId = idOf(field(form, "lot"));
    const lot = lotId ? await getLot(env, lotId) : null;
    if (!lot) return refused("That lot does not exist.");
    const expiry = optionalDate(form, "expiry");
    const amount = amountOf(field(form, "amount"));
    const location = await locationId(env, field(form, "location"));
    const status = field(form, "status");
    for (const check of [expiry, amount, location]) if (!check.ok) return refused(check.reason);
    if (!(STATUSES as readonly string[]).includes(status)) return refused(`Unknown status: ${status}.`);
    const update = env.DB.prepare(
      "UPDATE kb_lots SET expiry = ?, amount = ?, unit = ?, location_id = ?, status = ?, updated_at = unixepoch() WHERE id = ?",
    ).bind(expiry.ok ? expiry.value : null, amount.ok ? amount.value : null, field(form, "unit") || null, location.ok ? location.value : null, status, lot.id);
    return run(env, lotChange(env, actor.email, lot.id, update), `Lot ${lot.lot_number} saved.`);
  }

  return refused(`Unknown action: ${intent || "none"}.`);
}
