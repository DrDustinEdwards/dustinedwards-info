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
 * Every value here came from a stranger: rendered as escaped React children, and the source
 * URL as text, never a link. Smoke-actor writes are refused by admin.tsx's middleware, not here.
 */

export function meta() {
  return [{ title: "Mentions · Admin" }, { name: "robots", content: "noindex" }];
}

const INTENTS = ["approve", "reject", "delete", "sweep"] as const;
type Intent = (typeof INTENTS)[number];

function isIntent(value: string): value is Intent {
  return (INTENTS as readonly string[]).includes(value);
}

/** Pending first because it wants an action, failed second because it may mean something broke. */
const FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

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

function resolveFilter(requested: string | null, rows: Webmention[]): FilterId {
  if (isFilterId(requested)) return requested;
  return rows.some((m) => m.status === "pending") ? "pending" : "all";
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);
  const [mentions, expiring] = await Promise.all([
    timed(timings, "d1_list_webmentions", () => listWebmentionsForAdmin(env)),
    timed(timings, "d1_count_expiring_webmentions", () => countExpiringWebmentions(env)),
  ]);
  const status = resolveFilter(new URL(request.url).searchParams.get("status"), mentions);
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ mentions, expiring, status });
}

type ActionResult = {
  ok?: boolean;
  message?: string;
  confirmDelete?: number;
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
   * A guard in a handler does not run with scripting off, so both destructive intents refuse in
   * the action and render a second step.
   */
  const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();

  if (intent === "sweep") {
    /* The count is 1: the operator authorizes the sweep, not a row count that can change underneath. */
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

  /* Checked, not passed through: `Number("")` is 0, a plausible-looking rowid. */
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return data<ActionResult>(
      { ok: false, message: "That mention id is not valid." },
      { status: 400 },
    );
  }

  if (intent === "delete") {
    if (!confirmationSatisfied(typed, 1)) {
      return data<ActionResult>({ confirmDelete: id });
    }
    // Shared with the operator API: `decideMention` keeps the write and the purge together.
    await decideMention(env, id, "delete");
    return data<ActionResult>({ ok: true, message: "Mention deleted." });
  }

  if (intent === "approve") {
    await decideMention(env, id, "approve");
    return data<ActionResult>({ ok: true, message: "Mention approved." });
  }

  if (intent === "reject") {
    // Rejecting removes a rendered mention, so it purges the same tag.
    await decideMention(env, id, "reject");
    return data<ActionResult>({ ok: true, message: "Mention rejected." });
  }

  /*
   * Four separate comparisons, not a ternary: `check:destructive` matches strict equality on the
   * raw source, so an intent in a ternary's else arm is invisible to it.
   */
  return data<ActionResult>({ ok: false, message: "Unknown action." }, { status: 400 });
}

function iso(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}

const DECIDABLE: ReadonlyArray<Webmention["status"]> = ["pending", "approved", "rejected"];

function MentionRow({ mention, confirmDelete }: { mention: Webmention; confirmDelete?: number }) {
  const decidable = DECIDABLE.includes(mention.status);
  return (
    <li className="tool-row mention-row">
      <div className="mention-body">
        {mention.excerpt ? (
          <blockquote className="mention-quote">{mention.excerpt}</blockquote>
        ) : null}
        <p className="mention-who">
          {mention.authorName ? `${mention.authorName} ` : "An unnamed sender "}
          {mention.authorUrl ? `(${mention.authorUrl}) ` : ""}
          mentioned{" "}
          <Link to={`/admin/posts/${mention.targetSlug}/edit`}>{mention.targetSlug}</Link>
        </p>
        {/* Text, not a link: an unauthenticated POST chose this string. */}
        <p className="mention-source">{mention.sourceUrl}</p>
        <p className="muted mention-stamps">
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
        {decidable && mention.status !== "approved" ? (
          <Form method="post" className="mention-approve">
            <input type="hidden" name="intent" value="approve" />
            <input type="hidden" name="id" value={mention.id} />
            <button type="submit" className="btn">
              Approve
            </button>
          </Form>
        ) : null}
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

  const countOf = (id: FilterId) =>
    id === "all" ? mentions.length : mentions.filter((m) => m.status === id).length;
  const rows = status === "all" ? mentions : mentions.filter((m) => m.status === status);

  const unverified = mentions.filter((m) => m.status === "unverified").length;
  const expired = expiring.failed + expiring.rejected;

  return (
    <>
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
            <button type="submit" className="btn-secondary" disabled={expired === 0}>
              {`Remove ${expired} expired`}
            </button>
          </Form>
        )}
      </section>
    </>
  );
}
