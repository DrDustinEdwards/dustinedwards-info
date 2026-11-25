/** The lab bench: Knowledge Base inventory, run records and the workspace members. */
import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// The Knowledge Base's inventory (docs/KNOWLEDGE-BASE.md step 4): D1 is the source, not a copy of a file, because a
// lot changes daily and is private. A lot names a registry item by address,
// with no foreign key: the registry is rewritten by sync:content.
/** @public read by test/schema-invariants.test.mjs through the schema bundle */
export const kbLocations = sqliteTable("kb_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  parentId: integer("parent_id").references((): AnySQLiteColumn => kbLocations.id),
  note: text("note"),
});

/** @public read by test/schema-invariants.test.mjs through the schema bundle */
export const kbLots = sqliteTable(
  "kb_lots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemKind: text("item_kind").notNull(),
    itemId: text("item_id").notNull(),
    lotNumber: text("lot_number").notNull(),
    expiry: text("expiry"),
    amount: real("amount"),
    unit: text("unit"),
    locationId: integer("location_id").references(() => kbLocations.id),
    received: text("received"),
    opened: text("opened"),
    status: text("status").notNull().default("in_stock"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("kb_lots_item_kind_item_id_lot_number_unique").on(
      t.itemKind,
      t.itemId,
      t.lotNumber,
    ),
    index("kb_lots_location_idx").on(t.locationId),
    check("kb_lots_status_check", sql`${t.status} in ('in_stock', 'empty', 'discarded')`),
    check("kb_lots_amount_check", sql`${t.amount} IS NULL OR ${t.amount} >= 0`),
  ],
);

/** Append-only: one row per write to a lot or a location, with the row before and after as JSON. */
/** @public read by test/schema-invariants.test.mjs through the schema bundle */
export const kbAudit = sqliteTable(
  "kb_audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: integer("at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    actor: text("actor").notNull(),
    tableName: text("table_name").notNull(),
    rowId: integer("row_id").notNull(),
    action: text("action").notNull(),
    beforeRow: text("before_row"),
    afterRow: text("after_row"),
  },
  (t) => [
    index("kb_audit_row_idx").on(t.tableName, t.rowId, t.at),
    check("kb_audit_action_check", sql`${t.action} in ('insert', 'update', 'delete')`),
    check("kb_audit_table_check", sql`${t.tableName} in ('kb_lots', 'kb_locations')`),
  ],
);

// Run records (docs/KNOWLEDGE-BASE.md step 7, drizzle/0031_kb_runs.sql): append-only, so the migration's triggers
// refuse any UPDATE or DELETE and a correction is a new run naming the one it replaces. A run's lot changes are writes to
// kb_lots, each with its kb_audit row. Private to lab members.
/** @public read by test/schema-invariants.test.mjs through the schema bundle */
export const kbRuns = sqliteTable(
  "kb_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uid: text("uid").notNull().unique(),
    procedureSlug: text("procedure_slug").notNull(),
    procedureVersion: text("procedure_version"),
    actor: text("actor").notNull(),
    runOn: text("run_on").notNull(),
    outcome: text("outcome").notNull().default("completed"),
    note: text("note"),
    replacesRunId: integer("replaces_run_id")
      .unique()
      .references((): AnySQLiteColumn => kbRuns.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("kb_runs_actor_idx").on(t.actor, t.createdAt),
    check("kb_runs_outcome_check", sql`${t.outcome} in ('completed', 'failed', 'abandoned')`),
    check(
      "kb_runs_run_on_check",
      sql`${t.runOn} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
  ],
);

/** The lots one run used, how much of each, and whether it emptied one. Append-only, with its run. */
/** @public read by test/schema-invariants.test.mjs through the schema bundle */
export const kbRunLots = sqliteTable(
  "kb_run_lots",
  {
    runId: integer("run_id")
      .notNull()
      .references(() => kbRuns.id),
    lotId: integer("lot_id")
      .notNull()
      .references(() => kbLots.id),
    amountUsed: real("amount_used"),
    unit: text("unit"),
    emptied: integer("emptied").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.runId, t.lotId] }),
    index("kb_run_lots_lot_idx").on(t.lotId),
    check("kb_run_lots_amount_check", sql`${t.amountUsed} IS NULL OR ${t.amountUsed} >= 0`),
    check("kb_run_lots_emptied_check", sql`${t.emptied} in (0, 1)`),
  ],
);

// The /lab-bench workspace's people (docs/KNOWLEDGE-BASE.md step 5, drizzle/0030_lab_members.sql). D1 is the source: people
// change on /lab-bench/members and nowhere else. The rules are site-runtime's `./members`, the titles `app/lab/titles.mjs`;
// the Primary Owner is PRIMARY_OWNER_EMAIL and never a row.
export const members = sqliteTable(
  "members",
  {
    email: text("email").primaryKey().notNull(),
    name: text("name").notNull().default(""),
    title: text("title").notNull(),
    endDate: text("end_date"),
    status: text("status").notNull().default("active"),
    addedBy: text("added_by").notNull(),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    check("members_status_check", sql`${t.status} in ('active', 'removed', 'expired')`),
    check(
      "members_email_check",
      sql`${t.email} = lower(trim(${t.email})) AND instr(${t.email}, '@') > 1`,
    ),
  ],
);

/** Append-only: one row per change to a person or to the term dates, with the Access sync's answer. */
export const memberAudit = sqliteTable(
  "member_audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: text("at").notNull(),
    actor: text("actor").notNull(),
    actorTitle: text("actor_title").notNull(),
    action: text("action").notNull(),
    memberEmail: text("member_email"),
    beforeRow: text("before_row"),
    afterRow: text("after_row"),
    reason: text("reason"),
    cloudflare: text("cloudflare").notNull().default("pending"),
    cloudflareError: text("cloudflare_error"),
  },
  (t) => [
    index("member_audit_member_idx").on(t.memberEmail, t.at),
    index("member_audit_cloudflare_idx").on(t.cloudflare),
    check(
      "member_audit_action_check",
      sql`${t.action} in ('add', 'change_title', 'renew', 'remove', 'expire', 'review_keep', 'set_terms')`,
    ),
    check(
      "member_audit_cloudflare_check",
      sql`${t.cloudflare} in ('pending', 'accepted', 'failed', 'not_needed')`,
    ),
  ],
);

/** The semester end dates an Owner enters once a year; a lab title's end date defaults to the next one. */
export const memberTerms = sqliteTable(
  "member_terms",
  {
    endDate: text("end_date").primaryKey().notNull(),
    addedBy: text("added_by").notNull(),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    check(
      "member_terms_date_check",
      sql`${t.endDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
  ],
);
