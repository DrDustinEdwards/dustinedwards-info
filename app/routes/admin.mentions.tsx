import { Form, Link, data } from "react-router";

import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { RowMenu } from "~/components/admin/row-menu";
import { getEnv } from "~/lib/context";
import { timed, timingsContext } from "~/lib/timing";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import { decideMention } from "~/lib/webmention/decide.server";
import {
  countExpiringWebmentions,
  listWebmentionsForAdmin,
  sweepWebmentions,
} from "~/db";
import {
  FAILED_RETENTION_DAYS,
  REJECTED_RETENTION_DAYS,
} from "~/lib/webmention/retention.mjs";
import type { Webmention } from "~/db/schema";

import type { Route } from "./+types/admin.mentions";

/**
 * /admin/mentions: the webmention moderation queue.
 *
 * THE SMOKE ACTOR IS REFUSED, AND NOT BY ANYTHING IN THIS FILE. `admin.tsx`'s
 * middleware is a METHOD ALLOWLIST that refuses every write before a child action
 * runs, and none of the three actions below is a publish, so a capability read
 * here would be a SECOND enforcement point for a rule that already has one, which
 * is the shape the one-owner rule refuses: two owners of one fact, free to disagree.
 *
 * EVERY VALUE ON IT CAME FROM A STRANGER. They are rendered as React children,
 * which escapes them, and the source URL is shown as TEXT rather than as a link:
 * an admin page is not a place to put a one-click navigation to a URL an
 * unauthenticated POST chose.
 *
 * NO CLIENT JAVASCRIPT, and THE FILTER IS RESOLVED IN THE LOADER, so the component
 * is a pure function of what the server handed it.
 */

export function meta() {
  return [{ title: "Mentions · Admin" }, { name: "robots", content: "noindex" }];
}

/** The four intents this page's forms carry. A fifth is a typecheck failure. */
const INTENTS = ["approve", "reject", "delete", "sweep"] as const;
type Intent = (typeof INTENTS)[number];

function isIntent(value: string): value is Intent {
  return (INTENTS as readonly string[]).includes(value);
}

/**
 * The order is a decision rather than an alphabet: pending first because it is
 * the only one that wants an action, failed second because it is the only one that
 * might mean something is broken.
 *
 * `all` LISTS EVERY ROW INCLUDING `unverified`, which is what makes the counts
 * add up and lets a reader see that nothing is hiding.
 */
const FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

/**
 * KEYED BY THE UNION ITSELF, so it is total by typecheck, which is what rule 13
 * asks for in `app/`: a filter added with no line here is a compile error rather
 * than a lookup that substitutes a different filter's sentence.
 */
const EMPTY_LINE: Record<FilterId, string> = {
  pending: "No pending mentions.",
  failed: "No failed mentions.",
  approved: "No approved mentions.",
  rejected: "No rejected mentions.",
  all: "No mentions yet.",
};

function isFilterId(value: string | null): value is FilterId {
  return FILTERS.some((f) => f.id === value);
}

/**
 * AN ABSENT `?status=` IS NOT `all`, and neither is an unrecognised one. The
 * default lands on the set that wants a decision when there is one, so arriving
 * with nothing pending shows the log rather than a quiet line about an empty
 * queue.
 */
function resolveFilter(requested: string | null, rows: Webmention[]): FilterId {
  if (isFilterId(requested)) return requested;
  return rows.some((m) => m.status === "pending") ? "pending" : "all";
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);
  /*
   * The sweep button is LABELLED with it, and a label is a fact the page states
   * rather than one the action discovers. It is what turns "Sweep expired mentions"
   * into "Remove 3 expired" and lets the control disable itself.
   */
  const [mentions, expiring] = await Promise.all([
    timed(timings, "d1_list_webmentions", () => listWebmentionsForAdmin(env)),
    timed(timings, "d1_count_expiring_webmentions", () => countExpiringWebmentions(env)),
  ]);
  const status = resolveFilter(new URL(request.url).searchParams.get("status"), mentions);
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ mentions, expiring, status });
}

/** What an action hands back. Every field optional; the page renders what it gets. */
type ActionResult = {
  /**
   * Carried as a boolean because the alternative is classifying by string
   * matching, which is a second owner of a fact the action already knows: a page
   * that inferred failure would render a success in the error box the day somebody
   * rephrased a message.
   */
  ok?: boolean;
  message?: string;
  /** The mention id whose delete is awaiting its typed confirmation. */
  confirmDelete?: number;
  /** How many rows a sweep would remove right now, by window. */
  confirmSweep?: { failed: number; rejected: number };
};

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (!isIntent(intent)) {
    return data<ActionResult>({ ok: false, message: "Unknown action." }, { status: 400 });
  }

  /*
   * A guard that runs in a handler is feedback, not a guard, because with scripting
   * off the handler never runs and the form posts anyway. So both destructive
   * intents refuse in the ACTION and the refusal renders a second step.
   */
  const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();

  if (intent === "sweep") {
    /*
     * THE COUNT IS 1, not the rows at risk: the operator is authorizing the SWEEP,
     * and a typed row count read a moment before the delete would be invented
     * precision about a set that can change underneath it.
     */
    if (!confirmationSatisfied(typed, 1)) {
      return data<ActionResult>({ confirmSweep: await countExpiringWebmentions(env) });
    }
    const removed = await sweepWebmentions(env);
    return data<ActionResult>({
      ok: true,
      message:
        `Removed ${removed.failed} failed and ${removed.rejected} rejected ` +
        `mention(s) past their retention window.`,
    });
  }

  /*
   * PARSED AND CHECKED, never passed through: it arrives in a form body and
   * `Number("")` is 0, which is a plausible-looking rowid. A non-positive integer is
   * a malformed request, not a row that happens not to exist.
   */
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return data<ActionResult>(
      { ok: false, message: "That mention id is not valid." },
      { status: 400 },
    );
  }

  if (intent === "delete") {
    /*
     * ONE ROW, SO THE COUNT IS 1. Deleting a mention removes the only copy of what
     * somebody sent: there is no repository behind this table and no derivation that
     * could produce the row again.
     */
    if (!confirmationSatisfied(typed, 1)) {
      return data<ActionResult>({ confirmDelete: id });
    }
    // ONE DOOR, shared with the operator API. The write and the purge travel together
    // in `decideMention` so a second caller cannot take only half of them.
    await decideMention(env, id, "delete");
    return data<ActionResult>({ ok: true, message: "Mention deleted." });
  }

  if (intent === "approve") {
    // An approval purges the post's tag, so the section appears on the next fetch.
    // That is what the clause beside the Approve button is reporting.
    await decideMention(env, id, "approve");
    return data<ActionResult>({ ok: true, message: "Mention approved." });
  }

  if (intent === "reject") {
    // Rejecting REMOVES a rendered mention, so it changes the page exactly as
    // much as approving did and purges the same tag.
    await decideMention(env, id, "reject");
    return data<ActionResult>({ ok: true, message: "Mention rejected." });
  }

  /*
   * WRITTEN AS FOUR SEPARATE COMPARISONS RATHER THAN A TERNARY. `check:destructive`
   * matches a strict equality against a string literal ON THE RAW SOURCE, so an
   * intent handled as a ternary's else arm is INVISIBLE to it, and an unclassifiable
   * destructive path is the hole that gate exists to close.
   */
  return data<ActionResult>({ ok: false, message: "Unknown action." }, { status: 400 });
}

/**
 * ISO rather than a friendly rendering: this is a moderation log and an
 * unambiguous instant is worth more than "3 days ago".
 *
 * NO NULL BRANCH, which is rule 13 rather than an oversight: `received_at` is
 * `notNull`, so a placeholder would be a substituted value for a case that cannot
 * arrive.
 */
function iso(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}

/** The statuses a decision may be made from. Mirrors the DB layer's own set. */
const DECIDABLE: ReadonlyArray<Webmention["status"]> = ["pending", "approved", "rejected"];

/**
 * THE EXCERPT LEADS, which is a change of subject rather than a reordering. The
 * reader is judging whether a mention is worth publishing and the quotation is the
 * evidence; the URL is how they would check it, which is a second question.
 */
function MentionRow({ mention, confirmDelete }: { mention: Webmention; confirmDelete?: number }) {
  const decidable = DECIDABLE.includes(mention.status);
  return (
    <li className="tool-row mention-row">
      <div className="mention-body">
        {mention.excerpt ? (
          <blockquote className="mention-quote">{mention.excerpt}</blockquote>
        ) : null}
        {/*
         * THE ABSENCE IS NAMED rather than left as a dangling verb. It is a statement
         * about what the fetch found, not a value substituted for one it did not find.
         */}
        <p className="mention-who">
          {mention.authorName ? `${mention.authorName} ` : "An unnamed sender "}
          {mention.authorUrl ? `(${mention.authorUrl}) ` : ""}
          mentioned{" "}
          <Link to={`/admin/posts/${mention.targetSlug}/edit`}>{mention.targetSlug}</Link>
        </p>
        {/* TEXT, NOT A LINK. An unauthenticated POST chose this string. */}
        <p className="mention-source">{mention.sourceUrl}</p>
        <p className="muted mention-stamps">
          {/*
           * The rows where a verified stamp matters are the ones that DO NOT have one,
           * which is what the unverified chip counts.
           */}
          {`received ${iso(mention.receivedAt)}` +
            (mention.decidedAt ? `, decided ${iso(mention.decidedAt)}` : "") +
            (mention.failureReason ? `, reason ${mention.failureReason}` : "")}
        </p>
        {confirmDelete === mention.id ? (
          <ConfirmDialog
            title="Delete this mention"
            body={<p>This removes the only copy of it. Nothing else has one.</p>}
            requireTyped="1"
            confirmLabel="Delete permanently"
            cancelHref="/admin/mentions"
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={mention.id} />
          </ConfirmDialog>
        ) : null}
      </div>
      <div className="mention-actions">
        {/*
         * APPROVE STAYS ON THE ROW, because it is the decision the operator came to make.
         * Approve and reject are each hidden on the state they would produce, so the pair
         * reads as a decision that can be changed.
         */}
        {decidable && mention.status !== "approved" ? (
          <Form method="post" className="mention-approve">
            <input type="hidden" name="intent" value="approve" />
            <input type="hidden" name="id" value={mention.id} />
            <button type="submit" className="btn">
              Approve
            </button>
          </Form>
        ) : null}
        {/*
         * Three controls on every row compete with the excerpt the reader is actually
         * judging, and a menu is where an irreversible action belongs beside a reversible
         * one.
         */}
        <RowMenu
          label={`Actions for the mention from ${mention.authorName ?? "an unnamed sender"}`}
        >
          {decidable && mention.status !== "rejected" ? (
            <Form method="post">
              <input type="hidden" name="intent" value="reject" />
              <input type="hidden" name="id" value={mention.id} />
              <button type="submit" className="row-menu-item" data-menu-item>
                Reject
              </button>
            </Form>
          ) : null}
          <Form method="post" className="mention-delete">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={mention.id} />
            <button type="submit" className="row-menu-item" data-menu-item>
              Delete
            </button>
          </Form>
        </RowMenu>
      </div>
    </li>
  );
}

export default function AdminMentions({ loaderData, actionData }: Route.ComponentProps) {
  const { mentions, expiring, status } = loaderData;
  const message = actionData?.message;
  const confirmDelete = actionData?.confirmDelete;
  const confirmSweep = actionData?.confirmSweep;

  /*
   * ONE ARRAY FEEDS THE CHIPS AND THE LIST. A count derived from the same rows the
   * list is about cannot disagree with it.
   */
  const countOf = (id: FilterId) =>
    id === "all" ? mentions.length : mentions.filter((m) => m.status === id).length;
  const rows = status === "all" ? mentions : mentions.filter((m) => m.status === status);

  /*
   * COUNTED on the filter row rather than given a filter of its own: it is a state
   * that lasts seconds, and a row that STAYS unverified is worth a number rather
   * than a decision. Shown only above zero, because a chip reading 0 is an alarm
   * about nothing.
   */
  const unverified = mentions.filter((m) => m.status === "unverified").length;
  const expired = expiring.failed + expiring.rejected;

  return (
    <>
      {/*
       * `ok` is a field on the action's result rather than a guess made from the
       * message text, so a success cannot render in the error box.
       */}
      {message ? (
        <p
          className={`${actionData?.ok ? "editor-notice" : "panel-error"} mention-feedback`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <nav className="mention-filters" aria-label="Filter mentions by status">
        {FILTERS.map((filter) => (
          <Link
            key={filter.id}
            to={`?status=${filter.id}`}
            className={`admin-chip${filter.id === status ? " is-active" : ""}`}
            aria-current={filter.id === status ? "page" : undefined}
          >
            {filter.label} <span className="admin-chip-count">{countOf(filter.id)}</span>
          </Link>
        ))}
        {unverified > 0 ? (
          <span className="chip mention-unverified">
            {unverified} unverified
          </span>
        ) : null}
      </nav>

      {/*
       * THE PURGE CLAUSE, ONCE. It states a property of the whole pending filter, not
       * of any one mention, so it belongs where the filter is chosen. Rendered per row it
       * said the same sentence twelve times, which is how a page stops being read.
       */}
      {status === "pending" && rows.length > 0 ? (
        <p className="muted mention-hint mention-purge-note">
          Approving appears on the post within seconds.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="muted mention-empty">{EMPTY_LINE[status]}</p>
      ) : (
        <ul className="tool-list mention-queue">
          {rows.map((mention) => (
            <MentionRow key={mention.id} mention={mention} confirmDelete={confirmDelete} />
          ))}
        </ul>
      )}

      {/*
       * A BUTTON RATHER THAN A CRON. The watchdog's cron repairs DRIFT, a derived
       * store out of step with the repository, under hard rule 18; a webmention is
       * neither derived nor repo-sourced, so there is nothing for it to find.
       *
       * THE TWO WINDOWS ARE IMPORTED, never typed, which is the one-owner rule: a button
       * labeled with one number beside a sweep that uses another is the drift the rule
       * exists to prevent.
       */}
      <section className="mention-retention" aria-label="Retention">
        <p className="muted">
          {`Failed mentions are removed after ${FAILED_RETENTION_DAYS} days, rejected after ` +
            `${REJECTED_RETENTION_DAYS} days.`}
        </p>
        {confirmSweep ? (
          <ConfirmDialog
            title="Remove the expired mentions"
            body={
              <p>
                {`This permanently removes ${confirmSweep.failed} failed and ` +
                  `${confirmSweep.rejected} rejected mention(s). Nothing that is ` +
                  `still waiting on a decision is touched.`}
              </p>
            }
            requireTyped="1"
            confirmLabel="Remove them"
            cancelHref="/admin/mentions"
          >
            <input type="hidden" name="intent" value="sweep" />
          </ConfirmDialog>
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="sweep" />
            {/*
             * DISABLED AT ZERO, WITH THE SAME LABEL: a control that changes its words when it
             * has nothing to do makes the reader read it twice to learn there is nothing to
             * do.
             */}
            <button type="submit" className="btn-secondary" disabled={expired === 0}>
              {`Remove ${expired} expired`}
            </button>
          </Form>
        )}
      </section>
    </>
  );
}
