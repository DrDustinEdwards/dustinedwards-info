import { Form, Link, data } from "react-router";

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
 * ## THE SMOKE ACTOR IS REFUSED, AND NOT BY ANYTHING IN THIS FILE
 *
 * That is deliberate and it is the mechanism every other non-publish admin
 * write already uses. `app/routes/admin.tsx`'s middleware is a METHOD
 * ALLOWLIST: GET and HEAD are named, everything else is refused with
 * `SMOKE_READ_ONLY_POLICY` before a single child action runs. Its own comment
 * names the surfaces it covers ("the eleven media intents, the tag writes, the
 * trash, the rebuild, or any action added tomorrow") and says why the inversion
 * matters: a route that starts answering a new method is refused on the day it
 * is written rather than on the day somebody remembers to add it.
 *
 * The `WRITE_CAPABILITIES` table in `publish-policy.mjs` is consulted by
 * `decide()` and `decideDelete()` on the PUBLISH path only, and none of the
 * three actions below is a publish. So a capability read here would be a SECOND
 * enforcement point for a rule that already has one, which is the shape hard
 * rule 17 refuses: two owners of one fact, free to disagree. The refusal is
 * asserted in `test/worker/webmention.test.ts` against the middleware, which is
 * where it actually lives.
 *
 * ## ONE QUEUE, NOT FOUR PANELS, ruling 21 on 2026-09-05
 *
 * The page was four `Panel` groups stacked in a fixed order, each with its own
 * heading, its own description and its own empty box. With one mention in the
 * table that is three headings shouting about nothing, and the operator's own
 * verdict on it was "terrible on screen". A status is a FILTER, not a section:
 * the reader is deciding about one row at a time and wants the set that needs
 * deciding, so the statuses became link chips carrying `?status=` and the rows
 * became one list. The chips are the same server-rendered pattern the media
 * library uses for its lenses, for the same reason: every state is a URL, and
 * nothing about it needs script.
 *
 * ## APPROVING IS IMMEDIATE, AND IT WAS NOT
 *
 * This docblock said "there is no public surface for it in H1" and then, after
 * H2, that an approval reached readers within ten minutes. Both were true when
 * written. Since 2026-09-05 an approval PURGES `post:<slug>` and the section
 * appears on the next fetch, because Workers Cache gained a purge API and
 * ruling 7 was reversed by ruling 10.
 *
 * The one clause beside Approve is all that survives of the paragraph that used
 * to explain this. THE NUMBER WENT WITH IT, deliberately: the old sentence
 * derived a fallback minute count from `SHARED_CACHE_CONTROL` for the case
 * where a purge is rate limited and refused, which is honest and is a sentence
 * for the person who BUILT the page rather than the person deciding. A refused
 * purge degrades to the behaviour the page had for its whole first month, and
 * the operator finds out by looking at the post, which they were going to do
 * anyway.
 *
 * ## EVERY VALUE ON IT CAME FROM A STRANGER
 *
 * The source URL, the author name and the excerpt were read out of a document
 * this site does not control. They are rendered as React children, which
 * escapes them; the source URL is shown as TEXT rather than as a link, because
 * an admin page is not a place to put a one-click navigation to a URL an
 * unauthenticated POST chose. H2's public render is the one that gets an
 * anchor, and it gets `rel="nofollow ugc noopener"` with it.
 *
 * ## NO CLIENT JAVASCRIPT
 *
 * The admin plane is exempt from the progressive enhancement law and nothing
 * here needs the exemption: four plain `<Form method="post">` submissions, a
 * row of links, and a server-rendered list. THE FILTER IS RESOLVED IN THE
 * LOADER rather than by a hook, so the component is a pure function of what the
 * server handed it and the rendered page is the whole answer.
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
 * THE FILTER ROW, and the order is a decision rather than an alphabet.
 *
 * Pending first because it is the only one that wants an action, failed second
 * because it is the only one that might mean something is broken, then the two
 * settled states, then everything. That is the order the four panels were in,
 * and the reasoning survived the panels.
 *
 * `all` LISTS EVERY ROW INCLUDING `unverified`, which is what makes the counts
 * on this row add up: four filter counts plus the unverified chip equals the
 * All count, and a reader can see at a glance that nothing is hiding. The old
 * page could not do that, because `unverified` had no panel and its number was
 * a sentence at the bottom of a different section.
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
 * What an empty filter says, KEYED BY THE UNION ITSELF.
 *
 * A `Record<FilterId, string>` is total by typecheck, which is what rule 13
 * asks for in `app/`: a filter added to the list above with no line here is a
 * compile error rather than a lookup that quietly substitutes a different
 * filter's sentence, or renders nothing at all and leaves an empty page with
 * no explanation on it.
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
 * Which filter a request is asking for.
 *
 * AN ABSENT `?status=` IS NOT `all`, and neither is an unrecognised one. The
 * default lands on the set that wants a decision when there is one, and on
 * everything when there is not, so arriving at the page with nothing pending
 * shows the log rather than a quiet line about an empty queue. `?status=all` is
 * how a reader asks for everything on purpose, which is the media library's own
 * rule for `?role=` and is why an empty parameter is treated as absent.
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
   * THE EXPIRING COUNT IS READ HERE because the sweep button is LABELLED with
   * it, and a label is a fact the page states rather than a fact the action
   * discovers. It was already read on the confirmation step; reading it in the
   * loader too is what turns "Sweep expired mentions" into "Remove 3 expired"
   * and lets the control disable itself when there is nothing to remove.
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
   * WHETHER `message` IS AN OUTCOME OR A REFUSAL, carried as a boolean because
   * the alternative is classifying by string matching and that is a second
   * owner of a fact the action already knows. A page that read "Unknown action."
   * and inferred failure would silently start rendering a success in the error
   * box the day somebody rephrased a message.
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
   * THE TYPED CONFIRMATION, read once for whichever branch below wants it.
   *
   * `app/lib/destructive.mjs` states the rule: a guard that runs in a handler
   * is feedback, not a guard, because with scripting off the handler never runs
   * and the form posts anyway. So both destructive intents here refuse in the
   * ACTION and the refusal renders a second step, which is what makes the
   * ceremony real for a reader without JavaScript.
   */
  const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();

  if (intent === "sweep") {
    /*
     * THE COUNT IS 1, not the number of rows at risk, and the reason is the
     * same one the media rebuild gives: the operator is authorising the SWEEP,
     * and a typed row count read a moment before the delete would be a number
     * invented to look precise about a set that can change underneath it. The
     * confirmation step states the current quantity instead, which is the thing
     * actually at stake.
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
   * THE ID IS PARSED AND CHECKED, never passed through. It arrives in a form
   * body, and `Number("")` is 0, which is a plausible-looking rowid. An id that
   * is not a positive integer is a malformed request rather than a row that
   * happens not to exist.
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
     * ONE ROW, SO THE COUNT IS 1. Deleting a mention removes the only copy of
     * what somebody sent: there is no repository behind this table and no
     * derivation that could produce the row again, which is exactly why this is
     * classified destructive rather than reversible.
     */
    if (!confirmationSatisfied(typed, 1)) {
      return data<ActionResult>({ confirmDelete: id });
    }
    // ONE DOOR, shared with the operator API since 2026-09-05. The write and
    // the purge travel together in `decideMention` so a second caller cannot
    // take only half of them; grounds are on that function.
    await decideMention(env, id, "delete");
    return data<ActionResult>({ ok: true, message: "Mention deleted." });
  }

  if (intent === "approve") {
    // THE REVERSAL OF RULING 7, PROVEN ON THE WIRE 2026-09-05: the page was a
    // cache HIT with no section, and after this call it was a MISS carrying it.
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
   * UNREACHABLE, AND WRITTEN AS FOUR SEPARATE COMPARISONS RATHER THAN A TERNARY
   * TO GET HERE.
   *
   * `check:destructive` builds its vocabulary by matching a strict equality
   * between the word intent and a string literal, ON THE RAW SOURCE, so an
   * intent handled as the else arm of a ternary is INVISIBLE to it, and a
   * comment that spelled the needle out would invent one. Both were true of
   * this file's first draft: it decided approve and reject with a ternary, the
   * gate classified three of the four intents while `reject` was never named,
   * and the comment written to explain that then registered as a fifth.
   *
   * An unclassifiable destructive path is the hole that gate exists to close,
   * so the branch shape is chosen to stay inside its view.
   */
  return data<ActionResult>({ ok: false, message: "Unknown action." }, { status: 400 });
}

/**
 * A timestamp as an ISO instant.
 *
 * ISO rather than a friendly rendering, deliberately: this page is a moderation
 * log, the reader is one person who wrote the schema, and an unambiguous
 * instant is worth more here than "3 days ago".
 *
 * NO NULL BRANCH, which is rule 13 rather than an oversight. `received_at` is
 * `notNull` in the schema, and the only other stamp on the row is rendered
 * behind a check for its own presence, so a placeholder string here would be a
 * substituted value for a case that cannot arrive.
 */
function iso(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}

/** The statuses a decision may be made from. Mirrors the DB layer's own set. */
const DECIDABLE: ReadonlyArray<Webmention["status"]> = ["pending", "approved", "rejected"];

/**
 * The typed-count confirmation, server rendered.
 *
 * A SECOND STEP RATHER THAN A DEAD END: the action refused, said what was at
 * stake, and this carries the same fields back with one field added. That is
 * what gives the no-script path a real ceremony, which is the whole point of
 * the guard living in the action.
 */
function ConfirmStep({
  intent,
  id,
  prompt,
  label,
}: {
  intent: Intent;
  id?: number;
  prompt: string;
  label: string;
}) {
  return (
    <Form method="post" className="mention-confirm">
      <input type="hidden" name="intent" value={intent} />
      {id === undefined ? null : <input type="hidden" name="id" value={id} />}
      <label>
        {prompt}{" "}
        <input
          type="text"
          name={CONFIRM_FIELD}
          inputMode="numeric"
          autoComplete="off"
          size={4}
          required
        />
      </label>
      <button type="submit" className="btn btn-danger">
        {label}
      </button>
    </Form>
  );
}

/**
 * One row.
 *
 * THE EXCERPT LEADS, which is the whole of ruling 21b and is a change of
 * subject rather than a reordering. The row used to open with the source URL,
 * so the first thing on every row was a long unbreakable string a stranger
 * chose, and the sentence a human wrote was third. The reader is judging
 * whether a mention is worth publishing, and the quotation is the evidence for
 * that; the URL is how they would check it, which is a second question.
 */
function MentionRow({ mention, confirmDelete }: { mention: Webmention; confirmDelete?: number }) {
  const decidable = DECIDABLE.includes(mention.status);
  return (
    <li className="tool-row mention-row">
      <div className="mention-body">
        {mention.excerpt ? (
          <blockquote className="mention-quote">{mention.excerpt}</blockquote>
        ) : null}
        {/* THE ABSENCE IS NAMED rather than left as a dangling verb. A source
            page with no h-card gives this row no author at all, and the line
            used to open on the word "mentioned" with nothing in front of it,
            which reads as a rendering fault rather than as a fact about the
            sender. It is a statement about what the fetch found, not a value
            substituted for one it did not find. */}
        <p className="mention-who">
          {mention.authorName ? `${mention.authorName} ` : "An unnamed sender "}
          {mention.authorUrl ? `(${mention.authorUrl}) ` : ""}
          mentioned{" "}
          <Link to={`/admin/posts/${mention.targetSlug}/edit`}>{mention.targetSlug}</Link>
        </p>
        {/* TEXT, NOT A LINK. An unauthenticated POST chose this string. */}
        <p className="mention-source">{mention.sourceUrl}</p>
        <p className="muted mention-stamps">
          {/* THE VERIFIED STAMP IS GONE, and it is the one fact here that was
              never worth a column of the reader's attention: it lands seconds
              after `received` for every row that has one at all, and the rows
              where it matters are the ones that DO NOT have one, which is what
              the unverified chip counts. */}
          {`received ${iso(mention.receivedAt)}` +
            (mention.decidedAt ? `, decided ${iso(mention.decidedAt)}` : "") +
            (mention.failureReason ? `, reason ${mention.failureReason}` : "")}
        </p>
        {confirmDelete === mention.id ? (
          <ConfirmStep
            intent="delete"
            id={mention.id}
            prompt="Deleting removes the only copy of this mention. Type 1 to confirm:"
            label="Delete permanently"
          />
        ) : null}
      </div>
      <div className="mention-actions">
        {/* Approve and reject are each hidden on the state they would produce,
            so the pair reads as a decision that can be changed rather than as
            two buttons one of which does nothing. */}
        {decidable && mention.status !== "approved" ? (
          <Form method="post" className="mention-approve">
            <input type="hidden" name="intent" value="approve" />
            <input type="hidden" name="id" value={mention.id} />
            <button type="submit" className="btn">
              Approve
            </button>
          </Form>
        ) : null}
        {decidable && mention.status !== "rejected" ? (
          <Form method="post">
            <input type="hidden" name="intent" value="reject" />
            <input type="hidden" name="id" value={mention.id} />
            <button type="submit" className="btn-ghost">
              Reject
            </button>
          </Form>
        ) : null}
        {/* LAST, AND THE LIGHTEST THING ON THE ROW. It was a filled red button
            competing with the decision the operator actually came here to make,
            on every row including the ones with nothing wrong with them. */}
        <Form method="post" className="mention-delete">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={mention.id} />
          <button type="submit" className="btn-text">
            Delete
          </button>
        </Form>
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
   * ONE ARRAY FEEDS THE CHIPS AND THE LIST, which is the media library's own
   * lesson written down: its Unused chip counted with one predicate and
   * filtered with another, and the chip and the grid disagreed. A count derived
   * from the same rows the list is about cannot do that.
   */
  const countOf = (id: FilterId) =>
    id === "all" ? mentions.length : mentions.filter((m) => m.status === id).length;
  const rows = status === "all" ? mentions : mentions.filter((m) => m.status === status);

  /*
   * `unverified` rows are COUNTED on the filter row rather than given a filter
   * of their own. They are a state that lasts seconds: the endpoint writes one
   * and hands verification to `waitUntil` in the same request. A row that STAYS
   * unverified means verification never completed, which is worth a number
   * where the numbers are and is not a decision anybody can make. Shown only
   * when it is above zero, because a chip reading 0 is an alarm about nothing.
   */
  const unverified = mentions.filter((m) => m.status === "unverified").length;
  const expired = expiring.failed + expiring.rejected;

  return (
    <>
      {/* THE BOX MATCHES THE OUTCOME. A success in an error box was the first
          thing the operator named about this page, and `ok` is a field on the
          action's result rather than a guess made from the message text. */}
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
            className={`mention-chip${filter.id === status ? " is-active" : ""}`}
            aria-current={filter.id === status ? "page" : undefined}
          >
            {filter.label} <span className="mention-chip-count">{countOf(filter.id)}</span>
          </Link>
        ))}
        {unverified > 0 ? (
          <span className="chip mention-unverified">
            {unverified} unverified
          </span>
        ) : null}
      </nav>

      {/* THE PURGE CLAUSE, ONCE. Ruling 21e asked for it beside Approve, and it
          was rendered per pending row: on a queue of twelve it said the same
          sentence twelve times, which is how a page stops being read. It states
          a property of the whole pending filter, not of any one mention, so it
          belongs where the filter is chosen. Amended 2026-09-06.

          Shown only on the pending filter and only when there is something to
          approve: on an empty queue it would be advice about an action nobody
          can take. */}
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
        RETENTION, AND IT IS A BUTTON RATHER THAN A CRON. The reason is written
        here because the alternative was considered and refused.

        This site's only scheduled work is the watchdog Worker's cron, which
        polls /api/health and repairs DRIFT: a derived store that has fallen
        out of step with the repository, under hard rule 18. A webmention is
        neither derived nor repo-sourced, so there is no derivation to run and
        nothing for a health check to find; wiring an expiry into that door
        would put a permanently-healthy check into a mechanism whose whole job
        is to notice unhealthy ones. `sync:content` is the same objection in the
        other direction: it converges D1 toward the repository, and these rows
        have no repository side to converge to.

        So there is no honest existing home, and rather than adding a second
        cron for two DELETE statements the sweep is a control on the page whose
        rows it removes. It is idempotent, it reports what it removed, and the
        admin who is already here to moderate is the person who runs it.

        THE ESSAY THAT USED TO BE ON THE PAGE IS NOW ENTIRELY IN THIS COMMENT,
        which is ruling 21e. Three of its four sentences explained a DESIGN to a
        reader who did not ask: why two windows, why open rows are never swept,
        why the cap would move if they were. The person deciding needs the two
        windows and the number at stake, and the button now carries the number
        rather than a verb with no object. `unverified` lost its sentence here
        and gained a chip on the filter row, where a count belongs.

        THE TWO WINDOWS ARE IMPORTED, never typed, which is hard rule 17: a
        button labelled with one number beside a sweep that uses another is the
        drift the rule exists to prevent.
      */}
      <section className="mention-retention" aria-label="Retention">
        <p className="muted">
          {`Failed mentions are removed after ${FAILED_RETENTION_DAYS} days, rejected after ` +
            `${REJECTED_RETENTION_DAYS} days.`}
        </p>
        {confirmSweep ? (
          <ConfirmStep
            intent="sweep"
            prompt={
              `The sweep would remove ${confirmSweep.failed} failed and ` +
              `${confirmSweep.rejected} rejected mention(s), permanently. Type 1 to confirm:`
            }
            label="Sweep permanently"
          />
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="sweep" />
            {/* DISABLED AT ZERO, WITH THE SAME LABEL. A control that changes its
                words when it has nothing to do makes the reader read it twice to
                learn there is nothing to do; a greyed "Remove 0 expired" says it
                once, and the count is the same fact in both states. */}
            <button type="submit" className="btn-ghost" disabled={expired === 0}>
              {`Remove ${expired} expired`}
            </button>
          </Form>
        )}
      </section>
    </>
  );
}
