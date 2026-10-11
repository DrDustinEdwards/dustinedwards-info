/**
 * /lab/members: who may sign in to the lab, and every change to that list (capsid docs/design/design-identity-roles.md,
 * "The members page"; docs/KNOWLEDGE-BASE.md step 5). The page is Capsomer's `people-roles`; this module is what it
 * shows and what each of its posts does.
 *
 * Every rule is site-runtime's `checkChange`: nobody manages their own layer or anyone above it, and nobody grants a
 * permission they do not hold. The page offering an action is never permission to take it, so every post is checked
 * again here against the person's row as it is now. Each change is one batch (the row and its member_audit row), then
 * one Access sync through Capsid (app/lab/access-sync.server.ts), whose answer lands on the audit row.
 */

import {
  MANAGE_MEMBERS,
  auditRow,
  can,
  checkChange,
  defaultEndDate,
  isExpired,
  normalizeEmail,
  reviewOpen,
  type Actor,
  type MemberRow,
  type Title,
} from "@dustinedwards/site-runtime/members";
import type { HistoryEntry, PeopleData, PersonRow, TitleOption } from "capsomer/react/people-roles";

import {
  getMember,
  latestSyncByEmail,
  listMembers,
  listTerms,
  memberHistory,
  writeMemberChange,
  writeMemberChanges,
  writeTerms,
  type MemberAuditRow,
  type SyncState,
} from "~/db/members";

import { SYNC_NOT_SET_UP, syncAccess } from "./access-sync.server";
import { labRules } from "./actor.server";
import { field, isDate } from "./forms.mjs";
import { LAB_CATALOG, canEditTerms, titleLabel } from "./titles.mjs";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type MembersResult = { ok: boolean; text: string };

export type MembersActionData = {
  result?: MembersResult;
  /** A removal posted with no script: the page asks first, and the confirm posts `confirmed=yes`. */
  confirm?: { email: string; name: string };
};

export type MembersPageData = {
  people: PeopleData;
  terms: string[];
  canEditTerms: boolean;
  /** Shown above the list while this site holds no Capsid key, so nobody takes a saved change for an Access change. */
  syncNotice: string | null;
  primaryOwner: boolean;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function titleOf(id: string): Title | undefined {
  return LAB_CATALOG.titles.get(id);
}

/** The person's row is below the actor's layer, so the actor may manage it, and it is not the actor's own. */
function manages(actor: Actor, row: MemberRow): boolean {
  const title = titleOf(row.title);
  return can(actor, MANAGE_MEMBERS) && !!title && title.layer > actor.layer && row.email !== actor.email;
}

/** A title's default end date, or null when it does not expire or no term date is entered yet. */
function safeDefault(title: Title, terms: string[], nowMs: number, after: string | null = null): string | null {
  try {
    return defaultEndDate(title, terms, nowMs, after);
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

const NO_TERMS = "Enter this year's semester end dates first: a Lab worker's or Lab manager's access ends on one of them.";

/** The titles the actor may give, below their layer and within what they hold; the least first, so it is the default. */
export function grantableTitles(actor: Actor): Title[] {
  return [...LAB_CATALOG.titles.values()]
    .filter((t) => t.layer > actor.layer && t.permissions.every((p) => actor.permissions.has(p)))
    .sort((a, b) => b.layer - a.layer);
}

function syncOf(state: { cloudflare: SyncState; error: string | null } | undefined): Pick<PersonRow, "sync" | "syncError"> {
  if (!state || state.cloudflare === "accepted" || state.cloudflare === "not_needed") return { sync: "ready" };
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
  const cloudflare = row.cloudflare === "pending" || row.cloudflare === "failed" ? row.cloudflare : "accepted";
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

function plural(label: string): string {
  return label.endsWith("s") ? label : `${label}s`;
}

function listText(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** What the members page shows this actor: the people they may manage and themselves, never anyone else. */
export async function membersPage(env: Env, actor: Actor, url: URL, nowMs: number): Promise<MembersPageData> {
  const [rows, terms, sync] = await Promise.all([listMembers(env), listTerms(env), latestSyncByEmail(env)]);
  const visible = rows.filter((row) => row.email === actor.email || manages(actor, row));
  const people = visible.map((row) => personRow(actor, row, terms, nowMs, sync));
  const titles: TitleOption[] = grantableTitles(actor).map((t) => ({ value: t.id, label: t.label, defaultEnd: safeDefault(t, terms, nowMs) }));

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

  const personParam = url.searchParams.get("person");
  const shown = personParam ? visible.find((r) => r.email === personParam.toLowerCase()) : undefined;
  const history = shown
    ? { email: shown.email, name: shown.name || shown.email, entries: (await memberHistory(env, shown.email)).map(historyEntry) }
    : undefined;

  const changeParam = url.searchParams.get("change");
  const changing = changeParam && visible.some((r) => r.email === changeParam.toLowerCase() && manages(actor, r)) ? changeParam.toLowerCase() : undefined;

  const lead = titles.length
    ? `You manage ${listText([...titles].reverse().map((t) => plural(t.label)))}.${terms.some((d) => d >= new Date(nowMs).toISOString().slice(0, 10)) ? "" : ` ${NO_TERMS}`}`
    : undefined;

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

function refused(text: string): MembersActionData {
  return { result: { ok: false, text } };
}

/** The sync's answer appended to a done change, so the result line never says more than Cloudflare has. */
async function withSync(env: Env, nowMs: number, done: string, fetchImpl?: Fetch): Promise<MembersActionData> {
  const outcome = await syncAccess(env, nowMs, fetchImpl);
  if (outcome.ok) return { result: { ok: true, text: `${done} Cloudflare Access matches the list.` } };
  return { result: { ok: true, text: `${done} Cloudflare Access does not match yet: ${outcome.error}` } };
}

function rulesFor(env: Env, terms: string[], nowMs: number) {
  return { ...labRules(env, nowMs), termEnds: terms };
}

/** Runs one post from the members page as `actor`. Every branch re-checks with `checkChange`. */
export async function membersAction(env: Env, actor: Actor, form: FormData, nowMs: number, fetchImpl?: Fetch): Promise<MembersActionData> {
  const intent = field(form, "intent");
  if (intent === "set_terms") return setTerms(env, actor, field(form, "terms"), nowMs);
  if (!can(actor, MANAGE_MEMBERS)) return refused("You do not manage people here.");
  if (intent === "retry") {
    const outcome = await syncAccess(env, nowMs, fetchImpl);
    return outcome.ok ? { result: { ok: true, text: "Cloudflare Access matches the list." } } : refused(outcome.error);
  }
  if (intent === "review") return review(env, actor, form, nowMs, fetchImpl);

  const terms = await listTerms(env);
  const rules = rulesFor(env, terms, nowMs);

  if (intent === "add") {
    const typed = field(form, "email");
    if (!EMAIL.test(typed)) return refused("Type the email address they sign in with.");
    const email = normalizeEmail(typed);
    const titleId = field(form, "title");
    const title = titleOf(titleId);
    const endDate = title?.expires ? field(form, "end_date") || safeDefault(title, terms, nowMs) : null;
    if (title?.expires && !endDate) return refused(NO_TERMS);
    if (endDate && !isDate(endDate)) return refused(`Not a date (YYYY-MM-DD): ${endDate}.`);
    const existing = await getMember(env, email);
    if (existing && existing.status !== "removed") return refused(`${existing.name || email} is already on the list: renew them or change their title.`);
    const verdict = check(actor, { kind: "add", email, title: titleId, end_date: endDate }, rules);
    if (!verdict.ok) return refused(verdict.reason);
    const after: MemberRow = { email, name: field(form, "name"), title: titleId, end_date: endDate, status: "active" };
    await writeMemberChange(env, after, actor.email, audit(actor, "add", email, existing, after, nowMs));
    return withSync(env, nowMs, `Added ${after.name || email} as ${titleLabel(titleId)}.`, fetchImpl);
  }

  const email = field(form, "email").toLowerCase();
  const target = email ? await getMember(env, email) : null;
  if (!target) return refused("That person is not on the list.");
  const who = target.name || target.email;

  if (intent === "change_title") {
    const titleId = field(form, "title");
    const reason = field(form, "reason");
    if (target.status === "removed") return refused("A removed person is added again, not given a new title.");
    const verdict = check(actor, { kind: "change_title", target, title: titleId, reason }, rules);
    if (!verdict.ok) return refused(verdict.reason);
    const title = titleOf(titleId) as Title;
    // A date already passed is not kept: a new title for someone whose access ended starts at the next term end.
    const current = target.end_date && !isExpired(target, nowMs) ? target.end_date : null;
    const endDate = title.expires ? (current ?? safeDefault(title, terms, nowMs)) : null;
    if (title.expires && !endDate) return refused(NO_TERMS);
    const after: MemberRow = { ...target, title: titleId, end_date: endDate };
    await writeMemberChange(env, after, actor.email, audit(actor, "change_title", email, target, after, nowMs, reason));
    return withSync(env, nowMs, `${who} is now ${title.label}.`, fetchImpl);
  }

  if (intent === "renew") {
    const verdict = check(actor, { kind: "renew", target }, rules);
    if (!verdict.ok) return refused(verdict.reason);
    const endDate = safeDefault(titleOf(target.title) as Title, terms, nowMs, target.end_date);
    if (!endDate) return refused(NO_TERMS);
    const after: MemberRow = { ...target, end_date: endDate, status: "active" };
    await writeMemberChange(env, after, actor.email, audit(actor, "renew", email, target, after, nowMs));
    return withSync(env, nowMs, `Renewed ${who} until ${endDate}.`, fetchImpl);
  }

  if (intent === "remove") {
    const verdict = check(actor, { kind: "remove", target }, rules);
    if (!verdict.ok) return refused(verdict.reason);
    if (field(form, "confirmed") !== "yes") return { confirm: { email: target.email, name: who } };
    const after: MemberRow = { ...target, status: "removed" };
    await writeMemberChange(env, after, actor.email, audit(actor, "remove", email, target, after, nowMs));
    return withSync(env, nowMs, `Removed ${who}.`, fetchImpl);
  }

  return refused(`Unknown action: ${intent || "none"}.`);
}

/** checkChange, with the one throw it can make (no term date entered yet) read as a refusal. */
function check(actor: Actor, change: Parameters<typeof checkChange>[1], rules: Parameters<typeof checkChange>[2]) {
  try {
    return checkChange(actor, change, rules);
  } catch (error) {
    if (error instanceof RangeError) return { ok: false as const, reason: NO_TERMS };
    throw error;
  }
}

function audit(
  actor: Actor,
  action: "add" | "change_title" | "renew" | "remove",
  email: string,
  before: MemberRow | null,
  after: MemberRow,
  nowMs: number,
  reason?: string,
): MemberAuditRow {
  return auditRow({ actor, action, email, before, after, nowMs, ...(reason ? { reason } : {}) });
}

/** The term review: Keep renews to the next term end, Remove removes; one batch, one sync. */
async function review(env: Env, actor: Actor, form: FormData, nowMs: number, fetchImpl?: Fetch): Promise<MembersActionData> {
  const terms = await listTerms(env);
  const rules = rulesFor(env, terms, nowMs);
  const changes: Array<{ after: MemberRow; audit: MemberAuditRow }> = [];
  const notDone: string[] = [];
  for (let i = 0; form.has(`email-${i}`); i += 1) {
    const answer = field(form, `answer-${i}`);
    if (answer !== "keep" && answer !== "remove") continue;
    const target = await getMember(env, field(form, `email-${i}`).toLowerCase());
    if (!target) continue;
    const kind = answer === "keep" ? "renew" : "remove";
    const verdict = check(actor, { kind, target }, rules);
    if (!verdict.ok) {
      notDone.push(`${target.name || target.email}: ${verdict.reason}`);
      continue;
    }
    if (answer === "keep") {
      const endDate = safeDefault(titleOf(target.title) as Title, terms, nowMs, target.end_date);
      if (!endDate) {
        notDone.push(`${target.name || target.email}: ${NO_TERMS}`);
        continue;
      }
      const after: MemberRow = { ...target, end_date: endDate, status: "active" };
      changes.push({ after, audit: { ...auditRow({ actor, action: "renew", email: target.email, before: target, after, nowMs }), action: "review_keep" } });
    } else {
      const after: MemberRow = { ...target, status: "removed" };
      changes.push({ after, audit: auditRow({ actor, action: "remove", email: target.email, before: target, after, nowMs }) });
    }
  }
  if (changes.length === 0) return refused(notDone.length ? notDone.join(" ") : "Nothing was answered, so nothing changed.");
  await writeMemberChanges(env, changes);
  const kept = changes.filter((c) => c.audit.action === "review_keep").length;
  const done = `Review saved: ${kept} kept, ${changes.length - kept} removed.${notDone.length ? ` Not done: ${notDone.join(" ")}` : ""}`;
  return withSync(env, nowMs, done, fetchImpl);
}

/**
 * The Semester end dates line: the Primary Owner and Owners only. Dates separated by commas or spaces, each a real
 * YYYY-MM-DD; the list replaces the old one, with a member_audit row holding both. No Access sync: a term date
 * changes no one's access today.
 */
async function setTerms(env: Env, actor: Actor, text: string, nowMs: number): Promise<MembersActionData> {
  if (!canEditTerms(actor)) return refused("Only an Owner sets the semester end dates.");
  const dates = [...new Set(text.split(/[\s,;]+/).filter(Boolean))].sort();
  const bad = dates.filter((d) => !isDate(d));
  if (bad.length) return refused(`Not a date (YYYY-MM-DD): ${bad.join(", ")}.`);
  const before = await listTerms(env);
  await writeTerms(env, dates, actor.email, {
    at: new Date(nowMs).toISOString(),
    actor: actor.email,
    actor_title: actor.title,
    action: "set_terms",
    member_email: null,
    before: JSON.stringify(before),
    after: JSON.stringify(dates),
    reason: null,
    cloudflare: "not_needed",
  });
  return { result: { ok: true, text: dates.length ? `Semester end dates: ${dates.join(", ")}.` : "Semester end dates cleared." } };
}

