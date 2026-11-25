// The members page's data: the people list, their rows, the history and the titles the viewer may grant.

import {
  MANAGE_MEMBERS,
  can,
  defaultEndDate,
  isExpired,
  reviewOpen,
  type Actor,
  type MemberRow,
  type Title,
} from "@dustinedwards/site-runtime/members";
import type { HistoryEntry, PeopleData, PersonRow, TitleOption } from "capsomer/react/people-roles";
import { manageLead, personFromParam } from "capsomer/behavior/people-roles";
import {
  latestSyncByEmail,
  listMembers,
  listTerms,
  memberHistory,
  type SyncState,
} from "~/db/members";
import { SYNC_NOT_SET_UP } from "./access-sync.server";
import { today } from "./forms.mjs";
import { LAB_CATALOG, canEditTerms, titleLabel } from "./titles.mjs";

export type MembersPageData = {
  people: PeopleData;
  terms: string[];
  canEditTerms: boolean;
  /** Shown above the list while this site holds no Capsid key, so nobody takes a saved change for an Access change. */
  syncNotice: string | null;
  primaryOwner: boolean;
};

export function titleOf(id: string): Title | undefined {
  return LAB_CATALOG.titles.get(id);
}

/** The person's row is below the actor's layer, so the actor may manage it, and it is not the actor's own. */
function manages(actor: Actor, row: MemberRow): boolean {
  const title = titleOf(row.title);
  return (
    can(actor, MANAGE_MEMBERS) && !!title && title.layer > actor.layer && row.email !== actor.email
  );
}

/** A title's default end date, or null when it does not expire or no term date is entered yet. */
export function safeDefault(
  title: Title,
  terms: string[],
  nowMs: number,
  after: string | null = null,
): string | null {
  try {
    return defaultEndDate(title, terms, nowMs, after);
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

export const NO_TERMS =
  "Enter this year's semester end dates first: a Lab worker's or Lab manager's access ends on one of them.";

/** The titles the actor may give, below their layer and within what they hold; the least first, so it is the default. */
function grantableTitles(actor: Actor): Title[] {
  return [...LAB_CATALOG.titles.values()]
    .filter((t) => t.layer > actor.layer && t.permissions.every((p) => actor.permissions.has(p)))
    .sort((a, b) => b.layer - a.layer);
}

function syncOf(
  state: { cloudflare: SyncState; error: string | null } | undefined,
): Pick<PersonRow, "sync" | "syncError"> {
  if (!state || state.cloudflare === "accepted" || state.cloudflare === "not_needed")
    return { sync: "ready" };
  if (state.cloudflare === "pending") return { sync: "waiting" };
  return { sync: "failed", syncError: state.error ?? undefined };
}

function personRow(
  actor: Actor,
  row: MemberRow,
  terms: string[],
  nowMs: number,
  sync: Map<string, { cloudflare: SyncState; error: string | null }>,
): PersonRow {
  const title = titleOf(row.title);
  const expired = row.status === "active" && isExpired(row, nowMs);
  const status: PersonRow["status"] = expired ? "expired" : row.status;
  const renewable = !!title?.expires && status !== "removed";
  return {
    email: row.email,
    name: row.name || row.email,
    title: titleLabel(row.title),
    endDate: row.end_date,
    status,
    ...syncOf(sync.get(row.email)),
    manageable: manages(actor, row),
    renewTo: renewable && title ? safeDefault(title, terms, nowMs, row.end_date) : null,
    you: row.email === actor.email,
    ...(status === "expired" && row.end_date ? { endedOn: row.end_date } : {}),
  };
}

function parsed(json: string | null): Partial<MemberRow> | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Partial<MemberRow>;
  } catch {
    return null;
  }
}

function historyEntry(row: Awaited<ReturnType<typeof memberHistory>>[number]): HistoryEntry {
  const before = parsed(row.beforeRow);
  const after = parsed(row.afterRow);
  const cloudflare =
    row.cloudflare === "pending" || row.cloudflare === "failed" ? row.cloudflare : "accepted";
  return {
    at: row.at,
    by: row.actor,
    action: row.action as HistoryEntry["action"],
    ...(before?.title ? { fromTitle: titleLabel(before.title) } : {}),
    ...(after?.title ? { toTitle: titleLabel(after.title) } : {}),
    ...(after ? { endDate: after.end_date ?? null } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
    cloudflare,
    ...(row.cloudflareError ? { cloudflareError: row.cloudflareError } : {}),
  };
}

/** What the members page shows this actor: the people they may manage and themselves, never anyone else. */
export async function membersPage(
  env: Env,
  actor: Actor,
  url: URL,
  nowMs: number,
): Promise<MembersPageData> {
  const [rows, terms, sync] = await Promise.all([
    listMembers(env),
    listTerms(env),
    latestSyncByEmail(env),
  ]);
  const visible = rows.filter((row) => row.email === actor.email || manages(actor, row));
  const people = visible.map((row) => personRow(actor, row, terms, nowMs, sync));
  const titles: TitleOption[] = grantableTitles(actor).map((t) => ({
    value: t.id,
    label: t.label,
    defaultEnd: safeDefault(t, terms, nowMs),
  }));

  const reviewRows = visible.filter((row) => manages(actor, row) && reviewOpen(row, nowMs));
  const review = reviewRows.length
    ? {
        endDate: reviewRows.map((r) => r.end_date as string).sort()[0] as string,
        people: reviewRows.map((r) => {
          const p = people.find((x) => x.email === r.email) as PersonRow;
          return { email: p.email, name: p.name, title: p.title, renewTo: p.renewTo };
        }),
      }
    : undefined;

  const emails = visible.map((r) => r.email);
  const shownEmail = personFromParam(url.searchParams, "person", emails);
  const shown = shownEmail ? visible.find((r) => r.email === shownEmail) : undefined;
  const history = shown
    ? {
        email: shown.email,
        name: shown.name || shown.email,
        entries: (await memberHistory(env, shown.email)).map(historyEntry),
      }
    : undefined;

  const changing = personFromParam(url.searchParams, "change", emails, (email) =>
    visible.some((r) => r.email === email && manages(actor, r)),
  );

  const lead = manageLead(
    [...titles].reverse().map((t) => t.label),
    terms.some((d) => d >= today(nowMs)) ? undefined : NO_TERMS,
  );

  return {
    people: {
      heading: "Lab members",
      ...(lead ? { lead } : {}),
      people,
      titles,
      ...(review ? { review } : {}),
      ...(history ? { history } : {}),
      ...(changing ? { changing } : {}),
    },
    terms,
    canEditTerms: canEditTerms(actor),
    syncNotice: env.CAPSID_ACCESS_SYNC_KEY?.trim() ? null : SYNC_NOT_SET_UP,
    primaryOwner: actor.layer === 0,
  };
}
