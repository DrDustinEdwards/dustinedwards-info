import { Form, Link, data } from "react-router";

import { EmptyState, Panel } from "~/components/admin/panel";
import { getEnv } from "~/lib/context";
import { timed, timingsContext } from "~/lib/timing";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import {
  countExpiringWebmentions,
  decideWebmention,
  deleteWebmention,
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
 * ## NOTHING HERE RENDERS TO A READER
 *
 * Approving a mention sets a column. There is no public surface for it in H1:
 * the render under the post, the cache invalidation on approve and the
 * advertising of the endpoint are all H2. So this page is the only place a
 * received mention is visible to anybody, which is why it shows the failures
 * too rather than only the queue.
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
 * here needs the exemption: four plain `<Form method="post">` submissions and a
 * server-rendered list.
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

export async function loader({ context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const mentions = await timed(timings, "d1_list_webmentions", () =>
    listWebmentionsForAdmin(getEnv(context)),
  );
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ mentions });
}

/** What an action hands back. Every field optional; the page renders what it gets. */
type ActionResult = {
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
    return data<ActionResult>({ message: "Unknown action." }, { status: 400 });
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
    return data<ActionResult>({ message: "That mention id is not valid." }, { status: 400 });
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
    await deleteWebmention(env, id);
    return data<ActionResult>({ message: "Mention deleted." });
  }

  if (intent === "approve") {
    await decideWebmention(env, id, "approved");
    return data<ActionResult>({ message: "Mention approved." });
  }

  if (intent === "reject") {
    await decideWebmention(env, id, "rejected");
    return data<ActionResult>({ message: "Mention rejected." });
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
  return data<ActionResult>({ message: "Unknown action." }, { status: 400 });
}

/**
 * THE ORDER THE GROUPS ARE SHOWN IN, and it is a decision rather than an
 * alphabet: pending first because it is the only one that wants an action,
 * failed second because it is the only one that might mean something is broken,
 * then the two settled states.
 */
const GROUPS: ReadonlyArray<{
  status: Webmention["status"];
  title: string;
  description: string;
}> = [
  {
    status: "pending",
    title: "Pending",
    description: "Verified: the source page really links here. Nothing renders until approved.",
  },
  {
    status: "failed",
    title: "Failed verification",
    description: "The source could not be fetched, or was fetched and did not link here.",
  },
  {
    status: "approved",
    title: "Approved",
    description: "Kept. Approved mentions have no public effect yet; rendering is a later step.",
  },
  {
    status: "rejected",
    title: "Rejected",
    description: "Turned down. Kept so that a re-sent mention is recognisable rather than new.",
  },
];

/**
 * A timestamp as an ISO instant, or an em-dash-free placeholder.
 *
 * ISO rather than a friendly rendering, deliberately: this page is a moderation
 * log, the reader is one person who wrote the schema, and an unambiguous
 * instant is worth more here than "3 days ago".
 */
function stamp(value: Date | null): string {
  return value ? value.toISOString().replace(".000Z", "Z") : "not yet";
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

function MentionRow({ mention, confirmDelete }: { mention: Webmention; confirmDelete?: number }) {
  const decidable = DECIDABLE.includes(mention.status);
  return (
    <li className="tool-row mention-row">
      <div className="mention-body">
        {/* TEXT, NOT A LINK. An unauthenticated POST chose this string. */}
        <p className="tool-row-label mention-source">{mention.sourceUrl}</p>
        <p className="muted">
          {mention.authorName ? `${mention.authorName} ` : ""}
          {mention.authorUrl ? `(${mention.authorUrl}) ` : ""}
          mentioned{" "}
          <Link to={`/admin/posts/${mention.targetSlug}/edit`}>{mention.targetSlug}</Link>
        </p>
        {mention.excerpt ? <p className="mention-excerpt">{mention.excerpt}</p> : null}
        <p className="muted mention-stamps">
          {`received ${stamp(mention.receivedAt)}, verified ${stamp(mention.verifiedAt)}, ` +
            `decided ${stamp(mention.decidedAt)}` +
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
          <Form method="post">
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
            <button type="submit" className="btn">
              Reject
            </button>
          </Form>
        ) : null}
        <Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={mention.id} />
          <button type="submit" className="btn btn-danger">
            Delete
          </button>
        </Form>
      </div>
    </li>
  );
}

export default function AdminMentions({ loaderData, actionData }: Route.ComponentProps) {
  const { mentions } = loaderData;
  const message = actionData?.message;
  const confirmDelete = actionData?.confirmDelete;
  const confirmSweep = actionData?.confirmSweep;

  /*
   * `unverified` rows are counted rather than listed. They are a state that
   * lasts seconds: the endpoint writes one and hands verification to
   * `waitUntil` in the same request. A row that STAYS unverified means
   * verification never completed, which is worth a number on the page and is
   * not worth a fifth panel of rows nobody can act on.
   */
  const unverified = mentions.filter((m) => m.status === "unverified").length;

  return (
    <>
      {message ? (
        <p className="panel-error" role="status">
          {message}
        </p>
      ) : null}

      {GROUPS.map((group) => {
        const rows = mentions.filter((m) => m.status === group.status);
        return (
          <Panel
            key={group.status}
            title={group.title}
            description={group.description}
            actions={<span className="chip">{rows.length}</span>}
          >
            {rows.length === 0 ? (
              <EmptyState title={`No ${group.title.toLowerCase()} mentions.`} />
            ) : (
              <ul className="tool-list">
                {rows.map((mention) => (
                  <MentionRow key={mention.id} mention={mention} confirmDelete={confirmDelete} />
                ))}
              </ul>
            )}
          </Panel>
        );
      })}

      <Panel
        title="Retention"
        description="Mentions that will never render are removed on this button and nowhere else."
      >
        {/*
          A BUTTON RATHER THAN A CRON, and the reason is written here because
          the alternative was considered and refused.

          This site's only scheduled work is the watchdog Worker's cron, which
          polls /api/health and repairs DRIFT: a derived store that has fallen
          out of step with the repository, under hard rule 18. A webmention is
          neither derived nor repo-sourced, so there is no derivation to run and
          nothing for a health check to find; wiring an expiry into that door
          would put a permanently-healthy check into a mechanism whose whole
          job is to notice unhealthy ones. `sync:content` is the same objection
          in the other direction: it converges D1 toward the repository, and
          these rows have no repository side to converge to.

          So there is no honest existing home, and rather than adding a second
          cron for two DELETE statements the sweep is a control on the page
          whose rows it removes. It is idempotent, it reports what it removed,
          and the admin who is already here to moderate is the person who runs
          it.
        */}
        <p className="muted">
          {`Failed mentions are removed after ${FAILED_RETENTION_DAYS} days and rejected ` +
            `mentions after ${REJECTED_RETENTION_DAYS} days. Unverified and pending mentions ` +
            `are never swept: they are what the endpoint's open-queue cap counts, so expiring ` +
            `them would quietly raise the cap. ` +
            `${unverified} mention(s) are currently unverified.`}
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
            <button type="submit" className="btn">
              Sweep expired mentions
            </button>
          </Form>
        )}
      </Panel>
    </>
  );
}
