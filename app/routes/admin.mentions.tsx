import { Form, Link, data } from "react-router";

import { Alert, Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { Empty } from "capsomer/react/empty";
import { Panel } from "capsomer/react/panel";
import { Row, RowList } from "capsomer/react/row-list";
import { Pill, Status } from "capsomer/react/status";
import { TabsNav } from "capsomer/react/tabs";

import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { PageHead } from "~/components/admin/page-head";
import { TabLink } from "~/components/admin/tab-link";
import { adminActorContext } from "~/lib/admin-actor.server";
import { getEnv } from "~/lib/context";
import { PolicyError } from "~/lib/editor/publish-policy.mjs";
import { timed, timedLoader } from "~/lib/timing";
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
  return timedLoader(context, async (timings) => {
    const env = getEnv(context);
    const [mentions, expiring] = await Promise.all([
      timed(timings, "d1_list_webmentions", () => listWebmentionsForAdmin(env)),
      timed(timings, "d1_count_expiring_webmentions", () => countExpiringWebmentions(env)),
    ]);
    const status = resolveFilter(new URL(request.url).searchParams.get("status"), mentions);
    return data({ mentions, expiring, status });
  });
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

  /*
   * Shared with the operator API: `decideMention` keeps the write and the purge together, and the
   * actor runs the same policy checks it does. `changed` false means no row moved, which is not success.
   */
  const decide = async (decision: "delete" | "approve" | "reject", done: string, unchanged: string) => {
    try {
      const { changed, purged } = await decideMention(env, id, decision, context.get(adminActorContext));
      if (!changed) return data<ActionResult>({ ok: false, message: unchanged }, { status: 409 });
      // The row moved, so the outcome is ok; a failed purge is said, since the public page keeps the old mentions.
      return data<ActionResult>({
        ok: true,
        message:
          purged === false
            ? `${done} The cache purge failed, so the post's page may show the old mentions until its cache expires.`
            : done,
      });
    } catch (error) {
      if (error instanceof PolicyError) {
        return data<ActionResult>({ ok: false, message: error.message }, { status: 403 });
      }
      throw error;
    }
  };

  if (intent === "delete") {
    if (!confirmationSatisfied(typed, 1)) {
      return data<ActionResult>({ confirmDelete: id });
    }
    return decide("delete", "Mention deleted.", `Nothing changed: mention ${id} no longer exists.`);
  }

  if (intent === "approve") {
    return decide(
      "approve",
      "Mention approved.",
      `Nothing changed: mention ${id} is gone or not verified, so it cannot be approved. Reload to see its state.`,
    );
  }

  if (intent === "reject") {
    // Rejecting removes a rendered mention, so it purges the same tag.
    return decide(
      "reject",
      "Mention rejected.",
      `Nothing changed: mention ${id} is gone or not verified, so it cannot be rejected. Reload to see its state.`,
    );
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

const STATUS_TONE: Record<Webmention["status"], "ok" | "warn" | "crit" | "nodata"> = {
  pending: "warn",
  approved: "ok",
  rejected: "nodata",
  failed: "crit",
  unverified: "nodata",
};

function MentionRow({
  mention,
  confirmDelete,
  cancelHref,
}: {
  mention: Webmention;
  confirmDelete?: number;
  cancelHref: string;
}) {
  const decidable = DECIDABLE.includes(mention.status);
  const from = mention.authorName ?? "an unnamed sender";
  return (
    <>
      <Row
        title={
          <>
            {mention.authorName ?? "An unnamed sender"}
            {mention.authorUrl ? ` (${mention.authorUrl})` : ""} mentioned {mention.targetSlug}
          </>
        }
        href={`/admin/posts/${mention.targetSlug}/edit`}
        renderLink={({ href, children, ...rest }) => (
          <Link to={href} {...rest}>
            {children}
          </Link>
        )}
        status={<Status tone={STATUS_TONE[mention.status]}>{mention.status}</Status>}
        detail={
          <>
            {mention.excerpt ? <>{mention.excerpt}. </> : null}
            {/* Text, not a link: an unauthenticated POST chose this string. */}
            <span data-mention-source="">{mention.sourceUrl}</span>
          </>
        }
        meta={
          <span>
            {`received ${iso(mention.receivedAt)}` +
              (mention.decidedAt ? `, decided ${iso(mention.decidedAt)}` : "") +
              (mention.failureReason ? `, reason ${mention.failureReason}` : "")}
          </span>
        }
        actions={
          <>
            {decidable && mention.status !== "approved" ? (
              <Form method="post">
                <input type="hidden" name="intent" value="approve" />
                <input type="hidden" name="id" value={mention.id} />
                {/* Context in the name: every row has an Approve, and a list of them is otherwise identical. */}
                <Button type="submit" variant="primary" size="sm">
                  Approve<span className="cap-sr-only"> the mention from {from}</span>
                </Button>
              </Form>
            ) : null}
            {decidable && mention.status !== "rejected" ? (
              <Form method="post">
                <input type="hidden" name="intent" value="reject" />
                <input type="hidden" name="id" value={mention.id} />
                <Button type="submit" size="sm">
                  Reject<span className="cap-sr-only"> the mention from {from}</span>
                </Button>
              </Form>
            ) : null}
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={mention.id} />
              <Button type="submit" variant="danger" size="sm">
                Delete<span className="cap-sr-only"> the mention from {from}</span>
              </Button>
            </Form>
          </>
        }
      />
      {confirmDelete === mention.id ? (
        <li>
          <ConfirmDialog
            title="Delete this mention"
            body={<p>This removes the only copy of it. Nothing else has one.</p>}
            requireTyped="1"
            confirmLabel="Delete permanently"
            cancelHref={cancelHref}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={mention.id} />
          </ConfirmDialog>
        </li>
      ) : null}
    </>
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
  // Cancel keeps the filter it was opened from, rather than dropping back to the default one.
  const cancelHref = `/admin/mentions?status=${status}`;

  return (
    <div className="app-page">
      <PageHead
        title="Mentions"
        lead={status === "pending" && rows.length > 0 ? "Approving appears on the post within seconds." : undefined}
      />

      {/* The status region is always in the DOM, so a result is announced; a refusal is an alert. */}
      <div role="status">
        {message && actionData?.ok ? <Banner tone="ok">{message}</Banner> : null}
      </div>
      {message && !actionData?.ok ? <Alert tone="crit">{message}</Alert> : null}

      <TabsNav aria-label="Filter mentions by status" variant="line">
        {FILTERS.map((filter) => (
          <TabLink
            key={filter.id}
            to={`?status=${filter.id}`}
            current={filter.id === status}
            count={countOf(filter.id)}
          >
            {filter.label}
          </TabLink>
        ))}
        {unverified > 0 ? <Pill variant="outline">{unverified} unverified</Pill> : null}
      </TabsNav>

      {rows.length === 0 ? (
        <Empty kind={status === "all" ? "nothing-yet" : "all-clear"}>{EMPTY_LINE[status]}</Empty>
      ) : (
        <Panel title={FILTERS.find((f) => f.id === status)?.label ?? "Mentions"} count={rows.length} flush>
          <RowList label="Mentions">
            {rows.map((mention) => (
              <MentionRow
                key={mention.id}
                mention={mention}
                confirmDelete={confirmDelete}
                cancelHref={cancelHref}
              />
            ))}
          </RowList>
        </Panel>
      )}

      <Panel
        title="Retention"
        description={
          `Failed mentions are removed after ${FAILED_RETENTION_DAYS} days, rejected after ` +
          `${REJECTED_RETENTION_DAYS} days.`
        }
      >
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
            cancelHref={cancelHref}
          >
            <input type="hidden" name="intent" value="sweep" />
          </ConfirmDialog>
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="sweep" />
            <Button
              type="submit"
              disabledReason={expired === 0 ? "Nothing has passed its retention window yet." : undefined}
            >
              {`Remove ${expired} expired`}
            </Button>
          </Form>
        )}
      </Panel>
    </div>
  );
}
