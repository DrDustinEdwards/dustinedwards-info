import { useEffect, useState } from "react";
import { Form, Link, data, useNavigation } from "react-router";

import { AdminAlert } from "~/components/admin/alert";
import { PostsConfirmDialogs } from "~/components/admin/posts-confirm-dialogs";
import { PostsFilters } from "~/components/admin/posts-filters";
import { PostsTable } from "~/components/admin/posts-table";
import { PostsToolbar } from "~/components/admin/posts-toolbar";
import { listAllPostsForAdmin, listAllPostTagsForAdmin } from "~/db";
import { adminActorContext } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import { timed, timedLoader } from "~/lib/timing";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import {
  askSyncConfirmCount,
  bulkDeletePosts,
  bulkTagPosts,
  duplicatePost,
  regeneratePosts,
  resetAskBudgetAndReport,
  syncAskIndex,
  unpublishPost,
} from "~/lib/admin/posts-actions.server";
import { deleteLeftBehind } from "~/lib/editor/delete-left.mjs";
import { FILTER_KEYS, postsHref, readFilters } from "~/lib/admin/posts-filters";
import { fetchPostReadership } from "~/lib/admin/traffic.server";
import { askAvailable, askStatusContext } from "~/lib/search/ask.server";
import { readAskBudget } from "~/lib/search/ask-guard.server";
import type { Route } from "./+types/admin.posts._index";
import { errorMessage } from "~/lib/error-message.mjs";

export function meta() {
  return [{ title: "Posts · Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * `scheduled` is derived, not a column: a published row whose `publish_at` is still ahead.
 * Derived in the loader because it reads the clock.
 */
function statusOf(
  status: string,
  publishAt: Date | null,
  now: number,
): "published" | "scheduled" | "draft" {
  if (status !== "published") return "draft";
  if (publishAt && publishAt.getTime() > now) return "scheduled";
  return "published";
}

/** Rounded up: a post live in 30 hours is "in 2 days", never a number that has already passed. */
function daysUntil(publishAt: Date, now: number) {
  return Math.max(1, Math.ceil((publishAt.getTime() - now) / 86_400_000));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return timedLoader(context, async (timings) => {
    const env = getEnv(context);
    const filters = readFilters(new URL(request.url).searchParams);
    const deleteLeft = deleteLeftBehind(new URL(request.url).searchParams);

    const askPromise = timed(timings, "ask_status_uncached", () =>
      context.get(askStatusContext)(),
    );
    const askOn = askAvailable(env);
    /*
     * The catch is attached at creation: a promise that rejects before it is awaited is an unhandled
     * rejection. A failing budget read must not take the page down, and it renders as a failure.
     */
    const budgetPromise: Promise<
      | { budget: Awaited<ReturnType<typeof readAskBudget>>; budgetError: null }
      | { budget: null; budgetError: string | null }
    > = askOn
      ? timed(timings, "ask_budget_do", () => readAskBudget(env)).then(
          (budget) => ({ budget, budgetError: null }),
          (error: unknown) => {
            console.error("ask budget read failed", error);
            return {
              budget: null,
              budgetError: errorMessage(error),
            };
          },
        )
      : Promise.resolve({ budget: null, budgetError: null });

    const readershipPromise = timed(timings, "ae_post_readership", () =>
      fetchPostReadership(env),
    );

    const [rows, tagRows] = await timed(timings, "d1_admin_posts", () =>
      Promise.all([listAllPostsForAdmin(env), listAllPostTagsForAdmin(env)]),
    );

    const tagsBySlug = new Map<string, string[]>();
    for (const row of tagRows) {
      const list = tagsBySlug.get(row.slug);
      if (list) list.push(row.tag);
      else tagsBySlug.set(row.slug, [row.tag]);
    }

    const now = Date.now();
    const all = rows.map((post) => {
      const state = statusOf(post.status, post.publishAt, now);
      return {
        ...post,
        state,
        tags: tagsBySlug.get(post.slug) ?? [],
        // A number by the time the component sees it: rendering from a date reads the clock, and server
        // and hydration would disagree near a day boundary.
        scheduledInDays:
          state === "scheduled" && post.publishAt ? daysUntil(post.publishAt, now) : null,
      };
    });

    const needle = filters.q.toLowerCase();
    const posts = all.filter((post) => {
      if (filters.status && post.state !== filters.status) return false;
      if (filters.tag && !post.tags.includes(filters.tag)) return false;
      if (!needle) return true;
      return (
        post.title.toLowerCase().includes(needle) || post.slug.toLowerCase().includes(needle)
      );
    });

    const filtered = Boolean(filters.q || filters.status || filters.tag);

    // An admin page may await the AI layer; no public route ever does.
    const ask = await askPromise;

    const { budget, budgetError } = await budgetPromise;

    const readership = await readershipPromise;

    const payload = {
      posts,
      /* With Ask on, a null `ask` is a failed status read, never "up to date". */
      askOn,
      /** What a delete from the editor left behind, when it redirected here. */
      deleteLeft,
      ask,
      budget,
      budgetError,
      filters,
      filtered,
      total: all.length,
      statusCounts: {
        all: all.length,
        published: all.filter((post) => post.state === "published").length,
        draft: all.filter((post) => post.state === "draft").length,
        scheduled: all.filter((post) => post.state === "scheduled").length,
      },
      tagOptions: [...new Set(tagRows.map((row) => row.tag))].sort(),
      /** The whole report: only `complete` and the error arm tell a measured zero from an unasked question. */
      readership,
    };

    return data(payload);
  });
}

/*
 * The dispatch stays here and each intent's work is in lib/admin/posts-actions.server.ts. The two
 * destructive intents check the typed confirmation in their own branch, where check:destructive
 * reads it, before the handler runs.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const env = getEnv(context);
  const intent = form.get("intent");
  /* Required by `savePost` and `deletePost` rather than defaulting to the most privileged principal. */
  const actor = context.get(adminActorContext);

  if (intent === "regenerate") return regeneratePosts(env);

  // Separate from Regenerate: D1 search must not be held hostage to the AI index, and the AI index
  // must never be repaired by touching D1.
  if (intent === "sync-ask") {
    if (!askAvailable(env)) {
      return { message: "Ask is not enabled: no AI Search binding." };
    }
    /*
     * Checked here. "Sync" reads as additive and is not: `pruneAskCorpus` deletes every record this
     * run did not upload. The count is 1 because how many it removes cannot be known first.
     */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();

    if (!confirmationSatisfied(typed, 1)) {
      return { confirmSyncAsk: await askSyncConfirmCount(env) };
    }

    return syncAskIndex(env);
  }

  if (intent === "duplicate") return duplicatePost(env, form, actor);

  if (intent === "unpublish") return unpublishPost(env, form, actor);

  /*
   * Each iterates the per-post writer, so every gate on one post guards all. `expectedHeadSha` is
   * omitted because each commit advances head.
   */
  if (
    intent === "bulk-delete" ||
    intent === "bulk-add-tag" ||
    intent === "bulk-remove-tag"
  ) {
    const slugs = form.getAll("slug").map(String).filter(Boolean);
    if (slugs.length === 0) return { message: "Nothing selected." };

    if (intent === "bulk-delete") {
      /*
       * Enforced here, not only in the UI: with scripting off an `onClick` never runs. The count comes
       * from this request's slugs, never the form, so a stale page cannot authorize a different-size delete.
       */
      const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
      if (!confirmationSatisfied(typed, slugs.length)) {
        return {
          confirmDelete: { slugs, count: slugs.length, typed },
          message:
            `Nothing was deleted. ${slugs.length} post(s) are selected and the ` +
            `confirmation read ${typed || "(blank)"}. Type the count exactly to confirm.`,
        };
      }
      return bulkDeletePosts(env, slugs, actor);
    }

    return bulkTagPosts(env, form, slugs, intent, actor);
  }

  if (intent === "reset-ask-budget") return resetAskBudgetAndReport(env);

  return data(
    { message: `Nothing was done: ${String(intent ?? "(none)")} is not an action this page knows.` },
    { status: 400 },
  );
}

export default function AdminPosts({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    posts,
    askOn,
    ask,
    budget,
    budgetError,
    filters,
    filtered,
    total,
    statusCounts,
    tagOptions,
    readership,
  } = loaderData;
  const scheduledTotal = statusCounts.scheduled;
  const askUnread = askOn && !ask;
  /* Narrowed by key: the 400 answer carries only `message`, so the union no longer has these on every arm. */
  const confirmSyncAsk =
    actionData && "confirmSyncAsk" in actionData ? actionData.confirmSyncAsk : undefined;
  const confirmDelete =
    actionData && "confirmDelete" in actionData ? actionData.confirmDelete : undefined;
  const message = actionData && "message" in actionData ? actionData.message : undefined;

  const navigation = useNavigation();
  const pending = navigation.state === "loading" && navigation.location != null;
  const askDrifted = ask ? ask.missing.length > 0 || ask.stale.length > 0 : false;

  /* Keyed by slug, not row index, so a re-render or filter change cannot re-point it at another post. */
  const [selected, setSelected] = useState<string[]>([]);
  const visible = posts.map((post) => post.slug);
  const chosen = selected.filter((slug) => visible.includes(slug));
  const allShown = chosen.length > 0 && chosen.length === visible.length;

  const toggle = (slug: string) =>
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const cancelHref = postsHref(filters);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const askedFor = [
    filters.q ? `"${filters.q}"` : null,
    filters.status ? `status ${filters.status}` : null,
    filters.tag ? `tag ${filters.tag}` : null,
  ].filter(Boolean);

  return (
    <>
      <div className="admin-page-head">
        <h1>Posts</h1>
        <p className="admin-page-status">
          {`${statusCounts.all} post${statusCounts.all === 1 ? "" : "s"}, ` +
            `${statusCounts.published} published and ${statusCounts.draft} draft(s).` +
            (askDrifted && ask
              ? ` ${ask.missing.length + ask.stale.length} of them have changed since search last read them.`
              : askUnread
                ? " The search index status could not be read, so whether search is up to date is unknown."
                : ask
                  ? " Search is up to date with all of them."
                  : "")}
        </p>
      </div>
      <PostsToolbar />

      <PostsFilters
        filters={filters}
        filtered={filtered}
        statusCounts={statusCounts}
        tagOptions={tagOptions}
      />

      {scheduledTotal > 0 ? (
        <p className="admin-notice posts-scheduled-note">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {scheduledTotal} post{scheduledTotal === 1 ? " is" : "s are"} scheduled and not yet
          public.{" "}
          <Link to={`/admin/posts?${FILTER_KEYS.status}=scheduled`}>Show the queue</Link>
        </p>
      ) : null}

      {loaderData.deleteLeft ? (
        <p className="admin-notice" role="status">
          {`Deleted "${loaderData.deleteLeft.slug}". ${loaderData.deleteLeft.problems.join(" ")}`}
        </p>
      ) : null}

      {/* A live announcement, unlike the drift region: it reports what the submit just did. */}
      {message ? (
        <p className="admin-notice" role="status">
          {message}
        </p>
      ) : null}

      <PostsConfirmDialogs
        confirmSyncAsk={confirmSyncAsk}
        confirmDelete={confirmDelete}
        cancelHref={cancelHref}
      />

      {/* Surfaced here: a save can succeed while its Ask sync fails, and then it redirects. */}
      {askDrifted && ask ? (
        /* A standing condition, so a named region and never a live one. */
        <AdminAlert
          tone="warning"
          title="Search is answering from older text"
          headingId="ask-drift"
          action={
            <Form method="post">
              <button type="submit" name="intent" value="sync-ask" className="btn">
                Rebuild the answer index
              </button>
            </Form>
          }
        >
          <p>
            {`${ask.missing.length} post(s) are missing from the answer index and ` +
              `${ask.stale.length} record(s) in it no longer match the site, so an ` +
              `answer may quote text that has changed.`}
          </p>
        </AdminAlert>
      ) : null}

      {posts.length === 0 ? (
        filtered ? (
          <div className="posts-empty">
            <p>
              No posts match {askedFor.join(", ")}. Searched {total} post
              {total === 1 ? "" : "s"} by title and slug.
            </p>
            <Link to="/admin/posts" className="btn-secondary">
              Clear filters
            </Link>
          </div>
        ) : (
          <p className="muted">No posts yet.</p>
        )
      ) : (
        <PostsTable
          posts={posts}
          visible={visible}
          chosen={chosen}
          allShown={allShown}
          setSelected={setSelected}
          toggle={toggle}
          hydrated={hydrated}
          pending={pending}
          filtered={filtered}
          total={total}
          tagOptions={tagOptions}
          readership={readership}
          askOn={askOn}
          ask={ask}
          askUnread={askUnread}
          budget={budget}
          budgetError={budgetError}
        />
      )}
    </>
  );
}
