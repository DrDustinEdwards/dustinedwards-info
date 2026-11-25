/**
 * /lab-bench/members: every change to the lab's sign-in list (docs/KNOWLEDGE-BASE.md step 5). Every rule is
 * site-runtime's `checkChange`, and every post is re-checked here against the person's row as it is now: the page
 * offering an action is never permission to take it. Each change is one batch (the row and its member_audit row),
 * then one Access sync (app/lab/access-sync.server.ts) whose answer lands on the audit row.
 */

import { isEmail } from "@dustinedwards/site-runtime/email";
import {
  MANAGE_MEMBERS,
  auditRow,
  can,
  checkChange,
  isExpired,
  normalizeEmail,
  type Actor,
  type MemberRow,
  type Title,
} from "@dustinedwards/site-runtime/members";
import {
  getMember,
  listTerms,
  writeMemberChange,
  writeMemberChanges,
  writeTerms,
  type MemberAuditRow,
} from "~/db/members";
import { labRules } from "./actor.server";
import { syncAccess } from "./access-sync.server";
import { field, isDate } from "./forms.mjs";
import { canEditTerms, titleLabel } from "./titles.mjs";
import { NO_TERMS, safeDefault, titleOf } from "./members-page.server";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

type MembersResult = { ok: boolean; text: string };

export type MembersActionData = {
  result?: MembersResult;
  /** A removal posted with no script: the page asks first, and the confirm posts `confirmed=yes`. */
  confirm?: { email: string; name: string };
};

function refused(text: string): MembersActionData {
  return { result: { ok: false, text } };
}

/** The sync's answer appended to a done change, so the result line never says more than Cloudflare has. */
async function withSync(
  env: Env,
  nowMs: number,
  done: string,
  fetchImpl?: Fetch,
): Promise<MembersActionData> {
  const outcome = await syncAccess(env, nowMs, fetchImpl);
  if (outcome.ok)
    return { result: { ok: true, text: `${done} Cloudflare Access matches the list.` } };
  return {
    result: { ok: true, text: `${done} Cloudflare Access does not match yet: ${outcome.error}` },
  };
}

function rulesFor(env: Env, terms: string[], nowMs: number) {
  return { ...labRules(env, nowMs), termEnds: terms };
}

/** Runs one post from the members page as `actor`. Every branch re-checks with `checkChange`. */
export async function membersAction(
  env: Env,
  actor: Actor,
  form: FormData,
  nowMs: number,
  fetchImpl?: Fetch,
): Promise<MembersActionData> {
  const intent = field(form, "intent");
  if (intent === "set_terms") return setTerms(env, actor, field(form, "terms"), nowMs);
  if (!can(actor, MANAGE_MEMBERS)) return refused("You do not manage people here.");
  if (intent === "retry") {
    const outcome = await syncAccess(env, nowMs, fetchImpl);
    return outcome.ok
      ? { result: { ok: true, text: "Cloudflare Access matches the list." } }
      : refused(outcome.error);
  }
  if (intent === "review") return review(env, actor, form, nowMs, fetchImpl);

  const terms = await listTerms(env);
  const rules = rulesFor(env, terms, nowMs);

  if (intent === "add") {
    const typed = field(form, "email");
    if (!isEmail(typed)) return refused("Type the email address they sign in with.");
    const email = normalizeEmail(typed);
    const titleId = field(form, "title");
    const title = titleOf(titleId);
    const endDate = title?.expires
      ? field(form, "end_date") || safeDefault(title, terms, nowMs)
      : null;
    if (title?.expires && !endDate) return refused(NO_TERMS);
    if (endDate && !isDate(endDate)) return refused(`Not a date (YYYY-MM-DD): ${endDate}.`);
    const existing = await getMember(env, email);
    if (existing && existing.status !== "removed")
      return refused(
        `${existing.name || email} is already on the list: renew them or change their title.`,
      );
    const verdict = check(actor, { kind: "add", email, title: titleId, end_date: endDate }, rules);
    if (!verdict.ok) return refused(verdict.reason);
    const after: MemberRow = {
      email,
      name: field(form, "name"),
      title: titleId,
      end_date: endDate,
      status: "active",
    };
    await writeMemberChange(
      env,
      after,
      actor.email,
      audit(actor, "add", email, existing, after, nowMs),
    );
    return withSync(
      env,
      nowMs,
      `Added ${after.name || email} as ${titleLabel(titleId)}.`,
      fetchImpl,
    );
  }

  const email = field(form, "email").toLowerCase();
  const target = email ? await getMember(env, email) : null;
  if (!target) return refused("That person is not on the list.");
  const who = target.name || target.email;

  if (intent === "change_title") {
    const titleId = field(form, "title");
    const reason = field(form, "reason");
    if (target.status === "removed")
      return refused("A removed person is added again, not given a new title.");
    const verdict = check(actor, { kind: "change_title", target, title: titleId, reason }, rules);
    if (!verdict.ok) return refused(verdict.reason);
    const title = titleOf(titleId) as Title;
    // A date already passed is not kept: a new title for someone whose access ended starts at the next term end.
    const current = target.end_date && !isExpired(target, nowMs) ? target.end_date : null;
    const endDate = title.expires ? (current ?? safeDefault(title, terms, nowMs)) : null;
    if (title.expires && !endDate) return refused(NO_TERMS);
    const after: MemberRow = { ...target, title: titleId, end_date: endDate };
    await writeMemberChange(
      env,
      after,
      actor.email,
      audit(actor, "change_title", email, target, after, nowMs, reason),
    );
    return withSync(env, nowMs, `${who} is now ${title.label}.`, fetchImpl);
  }

  if (intent === "renew") {
    const verdict = check(actor, { kind: "renew", target }, rules);
    if (!verdict.ok) return refused(verdict.reason);
    const endDate = safeDefault(titleOf(target.title) as Title, terms, nowMs, target.end_date);
    if (!endDate) return refused(NO_TERMS);
    const after: MemberRow = { ...target, end_date: endDate, status: "active" };
    await writeMemberChange(
      env,
      after,
      actor.email,
      audit(actor, "renew", email, target, after, nowMs),
    );
    return withSync(env, nowMs, `Renewed ${who} until ${endDate}.`, fetchImpl);
  }

  if (intent === "remove") {
    const verdict = check(actor, { kind: "remove", target }, rules);
    if (!verdict.ok) return refused(verdict.reason);
    if (field(form, "confirmed") !== "yes") return { confirm: { email: target.email, name: who } };
    const after: MemberRow = { ...target, status: "removed" };
    await writeMemberChange(
      env,
      after,
      actor.email,
      audit(actor, "remove", email, target, after, nowMs),
    );
    return withSync(env, nowMs, `Removed ${who}.`, fetchImpl);
  }

  return refused(`Unknown action: ${intent || "none"}.`);
}

/** checkChange, with the one throw it can make (no term date entered yet) read as a refusal. */
function check(
  actor: Actor,
  change: Parameters<typeof checkChange>[1],
  rules: Parameters<typeof checkChange>[2],
) {
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
async function review(
  env: Env,
  actor: Actor,
  form: FormData,
  nowMs: number,
  fetchImpl?: Fetch,
): Promise<MembersActionData> {
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
      changes.push({
        after,
        audit: {
          ...auditRow({
            actor,
            action: "renew",
            email: target.email,
            before: target,
            after,
            nowMs,
          }),
          action: "review_keep",
        },
      });
    } else {
      const after: MemberRow = { ...target, status: "removed" };
      changes.push({
        after,
        audit: auditRow({
          actor,
          action: "remove",
          email: target.email,
          before: target,
          after,
          nowMs,
        }),
      });
    }
  }
  if (changes.length === 0)
    return refused(
      notDone.length ? notDone.join(" ") : "Nothing was answered, so nothing changed.",
    );
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
async function setTerms(
  env: Env,
  actor: Actor,
  text: string,
  nowMs: number,
): Promise<MembersActionData> {
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
  return {
    result: {
      ok: true,
      text: dates.length
        ? `Semester end dates: ${dates.join(", ")}.`
        : "Semester end dates cleared.",
    },
  };
}
