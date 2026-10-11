// The lab's lots, locations and their audit (drizzle/0029_kb_inventory.sql): D1 is their source. Every write to a lot
// or a location goes through the statements here, which put its kb_audit row in the same batch, so no lot changes
// without one (docs/KNOWLEDGE-BASE.md steps 4 and 7).

/** A lot as the audit stores it, read by SQLite itself inside the write's transaction, so before and after are exact. */
const LOT_JSON = `json_object('id', id, 'item_kind', item_kind, 'item_id', item_id, 'lot_number', lot_number, 'expiry', expiry, 'amount', amount, 'unit', unit, 'location_id', location_id, 'received', received, 'opened', opened, 'status', status)`;
const LOCATION_JSON = `json_object('id', id, 'name', name, 'parent_id', parent_id, 'note', note)`;

export type LotRow = {
  id: number;
  item_kind: string;
  item_id: string;
  lot_number: string;
  expiry: string | null;
  amount: number | null;
  unit: string | null;
  location_id: number | null;
  location: string | null;
  received: string | null;
  opened: string | null;
  status: "in_stock" | "empty" | "discarded";
};

export type LocationRow = { id: number; name: string; parent_id: number | null; note: string | null };

export type AuditRow = { id: number; at: number; actor: string; action: string; before_row: string | null; after_row: string | null };

const LOT_SELECT = `SELECT l.id, l.item_kind, l.item_id, l.lot_number, l.expiry, l.amount, l.unit, l.location_id, c.name AS location,
  l.received, l.opened, l.status FROM kb_lots l LEFT JOIN kb_locations c ON c.id = l.location_id`;

export async function listLots(env: Env): Promise<LotRow[]> {
  const { results } = await env.DB.prepare(`${LOT_SELECT} ORDER BY l.status = 'in_stock' DESC, l.item_kind, l.item_id, l.lot_number`).all<LotRow>();
  return results;
}

export async function getLot(env: Env, id: number): Promise<LotRow | null> {
  return env.DB.prepare(`${LOT_SELECT} WHERE l.id = ?`).bind(id).first<LotRow>();
}

export async function listLocations(env: Env): Promise<LocationRow[]> {
  const { results } = await env.DB.prepare("SELECT id, name, parent_id, note FROM kb_locations ORDER BY name").all<LocationRow>();
  return results;
}

export async function lotAudit(env: Env, lotId: number): Promise<AuditRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, at, actor, action, before_row, after_row FROM kb_audit WHERE table_name = 'kb_lots' AND row_id = ? ORDER BY id DESC",
  )
    .bind(lotId)
    .all<AuditRow>();
  return results;
}

/**
 * A change to one lot, with its audit row: the lot as it was is copied into a new kb_audit row, the change runs, and the
 * lot as it is now is copied onto that row. One batch is one transaction, so the row cannot miss the change or
 * describe a lot that never existed.
 */
export function lotChange(env: Env, actor: string, lotId: number, update: D1PreparedStatement): D1PreparedStatement[] {
  return [
    env.DB.prepare(`INSERT INTO kb_audit (actor, table_name, row_id, action, before_row) SELECT ?, 'kb_lots', id, 'update', ${LOT_JSON} FROM kb_lots WHERE id = ?`).bind(
      actor,
      lotId,
    ),
    update,
    env.DB.prepare(
      `UPDATE kb_audit SET after_row = (SELECT ${LOT_JSON} FROM kb_lots WHERE id = ?1) WHERE id = (SELECT max(id) FROM kb_audit WHERE table_name = 'kb_lots' AND row_id = ?1)`,
    ).bind(lotId),
  ];
}

export type NewLot = Omit<LotRow, "id" | "location" | "status" | "opened">;

/** A new lot and its insert audit row. */
export function lotInsert(env: Env, actor: string, lot: NewLot): D1PreparedStatement[] {
  return [
    env.DB.prepare(
      "INSERT INTO kb_lots (item_kind, item_id, lot_number, expiry, amount, unit, location_id, received) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(lot.item_kind, lot.item_id, lot.lot_number, lot.expiry, lot.amount, lot.unit, lot.location_id, lot.received),
    env.DB.prepare(
      `INSERT INTO kb_audit (actor, table_name, row_id, action, after_row) SELECT ?, 'kb_lots', id, 'insert', ${LOT_JSON} FROM kb_lots WHERE item_kind = ? AND item_id = ? AND lot_number = ?`,
    ).bind(actor, lot.item_kind, lot.item_id, lot.lot_number),
  ];
}

/** A new location and its insert audit row. */
export function locationInsert(env: Env, actor: string, name: string, parentId: number | null): D1PreparedStatement[] {
  return [
    env.DB.prepare("INSERT INTO kb_locations (name, parent_id) VALUES (?, ?)").bind(name, parentId),
    env.DB.prepare(`INSERT INTO kb_audit (actor, table_name, row_id, action, after_row) SELECT ?, 'kb_locations', id, 'insert', ${LOCATION_JSON} FROM kb_locations WHERE name = ?`).bind(
      actor,
      name,
    ),
  ];
}
