import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@dustinedwards/site-runtime/members";

import { loadLabActor } from "~/lab/actor.server";
import { inventoryAction, lotPage } from "~/lab/inventory.server";
import { recordRun, runPage, runsPage } from "~/lab/runs.server";

import { seedProcedures, seedRegistry } from "./seed";

/*
 * Step 7 (docs/KNOWLEDGE-BASE.md): lots and run records in /lab. Runs are append-only, a correction is a new run naming
 * the one it replaces, and every change to a lot, by a person or by a run, writes a kb_audit row with the lot before
 * and after. Each rule here was seen red once, by breaking the code it names (see the pull request).
 */

const PRIMARY = "dustin@example.org";
const MANAGER = "maya@example.org";
const WORKER = "rosa@example.org";
const WORKER_2 = "sam@example.org";
const testEnv = { ...env, PRIMARY_OWNER_EMAIL: PRIMARY } as unknown as Env;
const NOW = Date.UTC(2026, 9, 11, 12);
const PROTOCOL = "phage-dna-extraction";

beforeAll(async () => {
  await seedProcedures();
  await seedRegistry();
});

beforeEach(async () => {
  // The run tables refuse DELETE by design, so each case starts from a fresh name space instead: lots and runs added
  // here are found by their own numbers and uids, and the audit by its newest rows.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM members"),
    ...[
      [MANAGER, "lab_manager"],
      [WORKER, "lab_worker"],
      [WORKER_2, "lab_worker"],
    ].map(([email, title]) =>
      env.DB.prepare("INSERT INTO members (email, name, title, end_date, status, added_by) VALUES (?, ?, ?, '2026-12-18', 'active', ?)").bind(email, email, title, PRIMARY),
    ),
  ]);
});

async function actor(email: string): Promise<Actor> {
  const a = await loadLabActor(testEnv, email, NOW);
  if (!a) throw new Error(`${email} has no access`);
  return a;
}

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

let serial = 0;
/** A new lot of ethanol, by the manager, with its own lot number; returns its id. */
async function newLot(amount = "100", unit = "mL") {
  serial += 1;
  const number = `T${Date.now()}-${serial}`;
  const out = await inventoryAction(testEnv, await actor(MANAGER), form({ intent: "add_lot", item: "reagent:ethanol", lot_number: number, amount, unit }), NOW);
  expect(out.ok, out.text).toBe(true);
  const row = await env.DB.prepare("SELECT id FROM kb_lots WHERE lot_number = ?").bind(number).first<{ id: number }>();
  return row!.id;
}

async function lotRow(id: number) {
  return env.DB.prepare("SELECT * FROM kb_lots WHERE id = ?").bind(id).first<Record<string, unknown>>();
}

async function auditFor(lotId: number) {
  return (await env.DB.prepare("SELECT * FROM kb_audit WHERE table_name = 'kb_lots' AND row_id = ? ORDER BY id").bind(lotId).all<Record<string, unknown>>()).results;
}

const parse = (json: unknown) => JSON.parse(String(json)) as Record<string, unknown>;

describe("every lot change writes a kb_audit row", () => {
  it("adds a lot with an insert row holding the lot as written", async () => {
    const id = await newLot();
    const [row, ...rest] = await auditFor(id);
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({ actor: MANAGER, action: "insert", before_row: null });
    expect(parse(row?.after_row)).toMatchObject({ id, item_id: "ethanol", amount: 100, unit: "mL", status: "in_stock" });
  });

  it("edits, opens and empties a lot, each with the lot before and after", async () => {
    const id = await newLot();
    await inventoryAction(testEnv, await actor(MANAGER), form({ intent: "edit_lot", lot: String(id), amount: "80", unit: "mL", expiry: "2027-01-31", status: "in_stock" }), NOW);
    await inventoryAction(testEnv, await actor(WORKER), form({ intent: "mark_opened", lot: String(id) }), NOW);
    await inventoryAction(testEnv, await actor(WORKER), form({ intent: "mark_empty", lot: String(id) }), NOW);
    const [, edit, opened, emptied] = await auditFor(id);
    expect([parse(edit?.before_row).amount, parse(edit?.after_row).amount, parse(edit?.after_row).expiry]).toEqual([100, 80, "2027-01-31"]);
    expect([opened?.actor, parse(opened?.before_row).opened, parse(opened?.after_row).opened]).toEqual([WORKER, null, "2026-10-11"]);
    expect([parse(emptied?.before_row).status, parse(emptied?.after_row).status]).toEqual(["in_stock", "empty"]);
  });

  it("refuses a Lab worker an inventory edit, and records nothing", async () => {
    const id = await newLot();
    const out = await inventoryAction(testEnv, await actor(WORKER), form({ intent: "edit_lot", lot: String(id), amount: "1", status: "in_stock" }), NOW);
    expect(out).toEqual({ ok: false, text: "You cannot change the inventory." });
    const add = await inventoryAction(testEnv, await actor(WORKER), form({ intent: "add_lot", item: "reagent:ethanol", lot_number: "W1" }), NOW);
    expect(add.ok).toBe(false);
    expect(await auditFor(id)).toHaveLength(1);
  });
});

describe("a run takes from its lots, each change audited", () => {
  it("records a run, takes the amount off the lot, opens it, and audits the change", async () => {
    const id = await newLot("100", "mL");
    const out = await recordRun(testEnv, await actor(WORKER), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "12.5" }), NOW);
    expect(out.ok, out.text).toBe(true);
    expect(await lotRow(id)).toMatchObject({ amount: 87.5, opened: "2026-10-11", status: "in_stock" });
    const audit = await auditFor(id);
    expect(audit).toHaveLength(2);
    const change = audit[1]!;
    expect(change).toMatchObject({ actor: WORKER, action: "update" });
    expect([parse(change.before_row).amount, parse(change.after_row).amount]).toEqual([100, 87.5]);
    const used = await env.DB.prepare("SELECT * FROM kb_run_lots WHERE run_id = ?").bind(out.runId!).all();
    expect(used.results).toEqual([{ run_id: out.runId, lot_id: id, amount_used: 12.5, unit: "mL", emptied: 0 }]);
  });

  it("marks a lot the run emptied as empty, with its audit row", async () => {
    const id = await newLot("5", "mL");
    await recordRun(testEnv, await actor(WORKER), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "5", "emptied-0": "yes" }), NOW);
    expect(await lotRow(id)).toMatchObject({ amount: 0, status: "empty" });
    expect(parse((await auditFor(id))[1]?.after_row).status).toBe("empty");
  });

  it("refuses more than a lot holds, and an empty lot, saving nothing", async () => {
    const id = await newLot("3", "mL");
    const runsBefore = (await env.DB.prepare("SELECT count(*) AS n FROM kb_runs").first<{ n: number }>())!.n;
    const over = await recordRun(testEnv, await actor(WORKER), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "4" }), NOW);
    expect(over.ok).toBe(false);
    expect(over.text).toMatch(/only 3 mL left/);
    await inventoryAction(testEnv, await actor(WORKER), form({ intent: "mark_empty", lot: String(id) }), NOW);
    const empty = await recordRun(testEnv, await actor(WORKER), form({ procedure: PROTOCOL, "lot-0": String(id) }), NOW);
    expect(empty.text).toMatch(/is empty, so a new run cannot use it/);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM kb_runs").first<{ n: number }>())!.n).toBe(runsBefore);
    expect(await auditFor(id)).toHaveLength(2);
  });
});

describe("runs are append-only", () => {
  it("refuses any UPDATE or DELETE of a saved run, whatever asks", async () => {
    const id = await newLot();
    const out = await recordRun(testEnv, await actor(WORKER), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "1" }), NOW);
    await expect(env.DB.prepare("UPDATE kb_runs SET note = 'edited' WHERE id = ?").bind(out.runId!).run()).rejects.toThrow(/never changed/);
    await expect(env.DB.prepare("DELETE FROM kb_run_lots WHERE run_id = ?").bind(out.runId!).run()).rejects.toThrow(/never deleted/);
  });

  it("records a correction as a new run, leaves the original as saved, takes nothing from the lots, and allows one", async () => {
    const id = await newLot("50", "mL");
    const worker = await actor(WORKER);
    const first = await recordRun(testEnv, worker, form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "10", note: "first" }), NOW);
    const fix = await recordRun(testEnv, worker, form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "8", note: "it was 8" }), NOW, { replacesId: first.runId! });
    expect(fix.ok, fix.text).toBe(true);
    const original = await env.DB.prepare("SELECT note FROM kb_runs WHERE id = ?").bind(first.runId!).first();
    expect(original).toEqual({ note: "first" });
    expect(await lotRow(id)).toMatchObject({ amount: 40 });
    expect(await auditFor(id)).toHaveLength(2);
    const again = await recordRun(testEnv, worker, form({ procedure: PROTOCOL }), NOW, { replacesId: first.runId! });
    expect(again).toEqual({ ok: false, text: `Run ${first.runId} is already corrected by run ${fix.runId}: correct that one.` });
    const page = await runPage(testEnv, worker, first.runId!);
    expect(page?.run.replaced_by).toBe(fix.runId);
    expect(page?.canCorrect).toBe(false);
  });
});

describe("who sees which runs", () => {
  it("shows a Lab worker only their own runs and refuses them another's, as if it did not exist", async () => {
    const id = await newLot();
    const mine = await recordRun(testEnv, await actor(WORKER), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "1" }), NOW);
    const theirs = await recordRun(testEnv, await actor(WORKER_2), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "1" }), NOW);
    const worker = await actor(WORKER);
    expect(await runPage(testEnv, worker, theirs.runId!)).toBeNull();
    const correct = await recordRun(testEnv, worker, form({ procedure: PROTOCOL }), NOW, { replacesId: theirs.runId! });
    expect(correct).toEqual({ ok: false, text: "That run does not exist." });
    const list = await runsPage(testEnv, worker);
    expect(list.runs.every((r) => r.actor === WORKER)).toBe(true);
    const trace = await lotPage(testEnv, worker, id);
    expect(trace?.runs.map((r) => r.id)).toEqual([mine.runId]);
  });

  it("traces a lot to every run that used it for a Lab manager", async () => {
    const id = await newLot();
    const a = await recordRun(testEnv, await actor(WORKER), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "1" }), NOW);
    const b = await recordRun(testEnv, await actor(WORKER_2), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "1" }), NOW);
    const trace = await lotPage(testEnv, await actor(MANAGER), id);
    expect(trace?.runs.map((r) => r.id)).toEqual([b.runId, a.runId]);
    expect(trace?.allRuns).toBe(true);
  });
});

describe("the review's fixes", () => {
  it("keeps the corrected run's protocol version, even once the protocol is no longer published", async () => {
    const id = await newLot();
    const worker = await actor(WORKER);
    const first = await recordRun(testEnv, worker, form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "1" }), NOW);
    const version = (await env.DB.prepare("SELECT procedure_version FROM kb_runs WHERE id = ?").bind(first.runId!).first<{ procedure_version: string | null }>())!.procedure_version;
    await env.DB.prepare("UPDATE procedures SET status = 'draft' WHERE slug = ?").bind(PROTOCOL).run();
    try {
      const fix = await recordRun(testEnv, worker, form({ procedure: PROTOCOL }), NOW, { replacesId: first.runId! });
      expect(fix.ok, fix.text).toBe(true);
      const row = await env.DB.prepare("SELECT procedure_slug, procedure_version FROM kb_runs WHERE id = ?").bind(fix.runId!).first();
      expect(row).toEqual({ procedure_slug: PROTOCOL, procedure_version: version });
    } finally {
      await env.DB.prepare("UPDATE procedures SET status = 'published' WHERE slug = ?").bind(PROTOCOL).run();
    }
  });

  it("aborts the whole run when a lot left stock after it was read", async () => {
    const id = await newLot("10", "mL");
    const runsBefore = (await env.DB.prepare("SELECT count(*) AS n FROM kb_runs").first<{ n: number }>())!.n;
    const realGetLot = (await import("~/db/inventory")).getLot;
    const lot = await realGetLot(testEnv, id);
    // Another member empties the lot between the read and the save.
    await env.DB.prepare("UPDATE kb_lots SET status = 'empty' WHERE id = ?").bind(id).run();
    const { vi } = await import("vitest");
    const spy = vi.spyOn(await import("~/db/inventory"), "getLot").mockResolvedValue(lot);
    try {
      const out = await recordRun(testEnv, await actor(WORKER), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "1" }), NOW);
      expect(out).toEqual({ ok: false, text: "A lot ran short or left stock while the run was saved; nothing was recorded. Check the lots and try again." });
    } finally {
      spy.mockRestore();
    }
    expect((await env.DB.prepare("SELECT count(*) AS n FROM kb_runs").first<{ n: number }>())!.n).toBe(runsBefore);
  });

  it("shows a Lab worker only their own rows of a lot's history", async () => {
    const id = await newLot();
    await recordRun(testEnv, await actor(WORKER_2), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "1" }), NOW);
    await recordRun(testEnv, await actor(WORKER), form({ procedure: PROTOCOL, "lot-0": String(id), "amount-0": "1" }), NOW);
    const worker = await lotPage(testEnv, await actor(WORKER), id);
    expect(worker?.audit.map((r) => r.actor)).toEqual([WORKER]);
    const manager = await lotPage(testEnv, await actor(MANAGER), id);
    expect(manager?.audit.map((r) => r.actor)).toEqual([WORKER, WORKER_2, MANAGER]);
  });
});
