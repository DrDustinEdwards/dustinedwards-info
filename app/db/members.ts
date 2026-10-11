// The /lab workspace's people (drizzle/0030_lab_members.sql). D1 is the source. Read uncached on every request, so a
// removal or an expiry takes effect on the next click; written only by app/lab/members.server.ts, each change in
// one batch with its member_audit row.
import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { MemberRow } from "@dustinedwards/site-runtime/members";

import { getDb } from "./client";
import { memberAudit, memberTerms, members } from "./schema";

export type SyncState = "pending" | "accepted" | "failed" | "not_needed";

export type MemberAuditRow = {
  at: string;
  actor: string;
  actor_title: string;
  action: string;
  member_email: string | null;
  before: string | null;
  after: string | null;
  reason: string | null;
  cloudflare: SyncState;
  cloudflare_error?: string | null;
};

const ROW = {
  email: members.email,
  name: members.name,
  title: members.title,
  end_date: members.endDate,
  status: members.status,
};

function asMemberRow(row: { email: string; name: string; title: string; end_date: string | null; status: string }): MemberRow {
  return { ...row, status: row.status as MemberRow["status"] };
}

/** One person's row by their normalized email, or null. */
export async function getMember(env: Env, email: string): Promise<MemberRow | null> {
  const row = await getDb(env).select(ROW).from(members).where(eq(members.email, email)).get();
  return row ? asMemberRow(row) : null;
}

/** Everyone ever added, removed and expired people included, by name. */
export async function listMembers(env: Env): Promise<MemberRow[]> {
  const rows = await getDb(env).select(ROW).from(members).orderBy(asc(members.name), asc(members.email));
  return rows.map(asMemberRow);
}

/** The semester end dates, earliest first. */
export async function listTerms(env: Env): Promise<string[]> {
  const rows = await getDb(env).select({ endDate: memberTerms.endDate }).from(memberTerms).orderBy(asc(memberTerms.endDate));
  return rows.map((r) => r.endDate);
}

/** Each person's latest change and whether the allow list has caught up with it. */
export async function latestSyncByEmail(env: Env): Promise<Map<string, { cloudflare: SyncState; error: string | null }>> {
  const latest = getDb(env)
    .select({ id: sql<number>`max(${memberAudit.id})`.as("id") })
    .from(memberAudit)
    .where(sql`${memberAudit.memberEmail} IS NOT NULL`)
    .groupBy(memberAudit.memberEmail);
  const rows = await getDb(env)
    .select({ email: memberAudit.memberEmail, cloudflare: memberAudit.cloudflare, error: memberAudit.cloudflareError })
    .from(memberAudit)
    .where(inArray(memberAudit.id, latest));
  return new Map(rows.map((r) => [r.email as string, { cloudflare: r.cloudflare as SyncState, error: r.error }]));
}

/** One person's changes, newest first. */
export async function memberHistory(env: Env, email: string) {
  return getDb(env).select().from(memberAudit).where(eq(memberAudit.memberEmail, email)).orderBy(desc(memberAudit.id));
}

/**
 * The emails whose removal or expiry the allow list has not confirmed yet, and who are not active again: their seats
 * are still to free. A person removed and then added back is never named, or Capsid would free a member's seat.
 */
export async function unsyncedRemovals(env: Env): Promise<string[]> {
  const rows = await getDb(env)
    .selectDistinct({ email: memberAudit.memberEmail })
    .from(memberAudit)
    .innerJoin(members, eq(members.email, memberAudit.memberEmail))
    .where(
      sql`${memberAudit.cloudflare} IN ('pending', 'failed') AND ${memberAudit.action} IN ('remove', 'expire') AND ${members.status} <> 'active'`,
    );
  return rows.map((r) => r.email).filter((e): e is string => !!e);
}

/** The newest audit row's id, or 0: a sync settles only the changes that existed when it read the list. */
export async function latestAuditId(env: Env): Promise<number> {
  const row = await getDb(env).select({ id: sql<number>`coalesce(max(${memberAudit.id}), 0)` }).from(memberAudit).get();
  return row?.id ?? 0;
}

/** Whether a change newer than `id` still waits on Access: another sync must carry it. */
export async function pendingAfter(env: Env, id: number): Promise<boolean> {
  const row = await getDb(env)
    .select({ id: memberAudit.id })
    .from(memberAudit)
    .where(and(gt(memberAudit.id, id), eq(memberAudit.cloudflare, "pending")))
    .get();
  return !!row;
}

function auditValues(audit: MemberAuditRow) {
  return {
    at: audit.at,
    actor: audit.actor,
    actorTitle: audit.actor_title,
    action: audit.action,
    memberEmail: audit.member_email,
    beforeRow: audit.before,
    afterRow: audit.after,
    reason: audit.reason,
    cloudflare: audit.cloudflare,
    cloudflareError: audit.cloudflare_error ?? null,
  };
}

/**
 * A person's new row and its audit row, together or not at all. `addedBy` is kept from the first add: a re-add of a
 * removed person replaces their title and dates, not who first added them.
 */
export async function writeMemberChange(env: Env, after: MemberRow, actorEmail: string, audit: MemberAuditRow): Promise<void> {
  const db = getDb(env);
  await db.batch([
    db
      .insert(members)
      .values({ email: after.email, name: after.name ?? "", title: after.title, endDate: after.end_date, status: after.status, addedBy: actorEmail })
      .onConflictDoUpdate({
        target: members.email,
        // A blank name never overwrites the one kept on the row, so past runs and edits keep it.
        set: { name: sql`coalesce(nullif(${after.name ?? ""}, ''), ${members.name})`, title: after.title, endDate: after.end_date, status: after.status, updatedAt: sql`(unixepoch())` },
      }),
    db.insert(memberAudit).values(auditValues(audit)),
  ]);
}

/** Several people's changes in one batch, as a term review saves them. */
export async function writeMemberChanges(env: Env, changes: Array<{ after: MemberRow; audit: MemberAuditRow }>): Promise<void> {
  if (changes.length === 0) return;
  const db = getDb(env);
  const statements = changes.flatMap(({ after, audit }) => [
    db
      .update(members)
      .set({ title: after.title, endDate: after.end_date, status: after.status, updatedAt: sql`(unixepoch())` })
      .where(eq(members.email, after.email)),
    db.insert(memberAudit).values(auditValues(audit)),
  ]);
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
}

/** Replaces the semester end dates with `dates`, with the change's audit row. */
export async function writeTerms(env: Env, dates: string[], actorEmail: string, audit: MemberAuditRow): Promise<void> {
  const db = getDb(env);
  await db.batch([
    db.delete(memberTerms),
    ...dates.map((endDate) => db.insert(memberTerms).values({ endDate, addedBy: actorEmail })),
    db.insert(memberAudit).values(auditValues(audit)),
  ]);
}

/**
 * Records the Access sync's answer on every change up to `uptoId` still waiting on it: one sync carries the whole list
 * as it stood when it was read, so it settles every change before that and none after.
 */
export async function recordSync(env: Env, state: "accepted" | "failed", error: string | null, uptoId: number): Promise<void> {
  await getDb(env)
    .update(memberAudit)
    .set({ cloudflare: state, cloudflareError: error })
    .where(and(inArray(memberAudit.cloudflare, ["pending", "failed"]), lte(memberAudit.id, uptoId)));
}
