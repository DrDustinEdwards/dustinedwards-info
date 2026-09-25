import { useEffect, useState } from "react";
import { Form, Link, data, redirect, useNavigation } from "react-router";

import { AdminAlert } from "~/components/admin/alert";
import { BulkTagControls } from "~/components/admin/bulk-tag-controls";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { OverflowMenu } from "~/components/admin/overflow-menu";
import { RowMenu } from "~/components/admin/row-menu";
import { listAllPostsForAdmin, listAllPostTagsForAdmin } from "~/db";
import { adminActorContext } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import { timed, timedLoader } from "~/lib/timing";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import { parsePost, parseTags, serializePost } from "~/lib/editor/frontmatter";
import { readFile } from "~/lib/editor/github.server";
import {
  deletePost,
  regenerateAllFromRepo,
  savePost,
} from "~/lib/editor/publish.server";
import { copySlugCandidates } from "~/lib/editor/duplicate.mjs";
import { deleteLeftBehind } from "~/lib/editor/delete-left.mjs";
import {
  CACHE_SENTENCE,
  READERSHIP_ABSENT,
  postReadershipPath,
} from "~/lib/admin/origin-requests.mjs";
import { fetchPostReadership } from "~/lib/admin/traffic.server";
import { postPath } from "~/lib/content/slug.mjs";
import {
  askAvailable,
  askStatusContext,
  pruneAskCorpus,
  syncAskCorpus,
} from "~/lib/search/ask.server";
import { readAskBudget, resetAskBudget } from "~/lib/search/ask-guard.server";
import type { Route } from "./+types/admin.posts._index";
import { errorMessage } from "~/lib/error-message.mjs";
import { applyBulkTag } from "~/lib/admin/bulk-tag";

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

/** A browser pairs a button with its form by string equality alone, so a mismatch submits the wrong form silently. */
function rowFormId(intent: "duplicate" | "unpublish", slug: string) {
  return `row-${intent}-${slug}`;
}

const FILTER_KEYS = { q: "q", status: "status", tag: "tag" } as const;

/** `status` is validated, so `?status=banana` degrades to no filter rather than an empty-looking corpus. */
function readFilters(params: URLSearchParams) {
  const status = (params.get(FILTER_KEYS.status) ?? "").trim();
  return {
    q: (params.get(FILTER_KEYS.q) ?? "").trim(),
    status: status === "published" || status === "scheduled" || status === "draft" ? status : "",
    tag: (params.get(FILTER_KEYS.tag) ?? "").trim(),
  };
}

/** The posts list under these filters, the unset ones left out. */
function postsHref(filters: { q: string; status: string; tag: string }) {
  const params = new URLSearchParams();
  if (filters.q) params.set(FILTER_KEYS.q, filters.q);
  if (filters.status) params.set(FILTER_KEYS.status, filters.status);
  if (filters.tag) params.set(FILTER_KEYS.tag, filters.tag);
  const query = params.toString();
  return query ? `/admin/posts?${query}` : "/admin/posts";
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

/** Appended when a write landed but its cache purge did not: the public pages are stale until expiry. */
function unpurgedNote(count: number) {
  return count > 0
    ? ` The cache purge failed for ${count} post(s), so public pages may show the old version until their cache expires.`
    : "";
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const env = getEnv(context);
  const intent = form.get("intent");
  /* Required by `savePost` and `deletePost` rather than defaulting to the most privileged principal. */
  const actor = context.get(adminActorContext);

  if (intent === "regenerate") {
    try {
      const { synced, removed, unpurged } = await regenerateAllFromRepo(env);
      return {
        message:
          `Re-rendered ${synced} posts from the repository` +
          (removed > 0 ? ` and removed ${removed} no longer in it` : "") +
          "." +
          unpurgedNote(unpurged),
      };
    } catch (error) {
      return {
        message: `Regenerate failed. ${errorMessage(error)}`,
      };
    }
  }

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
      const posts = await listAllPostsForAdmin(env);
      return { confirmSyncAsk: posts.length };
    }

    try {
      const { uploaded, keys, failed, cacheDropped } = await syncAskCorpus(env);
      const removed = await pruneAskCorpus(env, keys);
      return {
        message:
          `Uploaded ${uploaded} search records to AI Search` +
          (removed.length > 0 ? `, removed ${removed.length} stale item(s)` : "") +
          `, dropped ${cacheDropped} cached answer(s).` +
          // Named, so a transient that outlived its retries is not read as a finished sync.
          (failed.length > 0
            ? ` FAILED after retries: ${failed.map((f) => f.key).join(", ")}. Run the sync again.`
            : ""),
      };
    } catch (error) {
      return {
        message: `Ask sync failed. ${errorMessage(error)}`,
      };
    }
  }

  /*
   * Not a back door to a first publication: the copy is written with `draft: true`, and
   * `forceFirstPublished` removes the key rather than carrying it across.
   */
  if (intent === "duplicate") {
    const slug = String(form.get("slug") ?? "");
    const file = await readFile(env, postPath(slug));
    if (!file) return { message: `No post file exists for "${slug}", so there is nothing to copy.` };
    const fields = parsePost(file.content);

    /* Probed against the repository, not D1: D1 is derived, and the file is what `savePost` refuses on. */
    let target: string | null = null;
    const candidates = copySlugCandidates(slug);
    for (const candidate of candidates) {
      if (!(await readFile(env, postPath(candidate)))) {
        target = candidate;
        break;
      }
    }
    if (!target) {
      return {
        message:
          `Could not find a free slug for a copy of "${slug}": the first ` +
          `${candidates.length} candidates are all taken. Delete some copies first.`,
      };
    }

    try {
      await savePost(env, {
        slug: target,
        raw: serializePost({ ...fields, slug: target, draft: true, firstPublished: "" }),
        isNew: true,
        actor,
      });
      return redirect(`/admin/posts/${target}/edit`);
    } catch (error) {
      return {
        message: `Duplicate failed. ${errorMessage(error)}`,
      };
    }
  }

  /*
   * No republish here: `first_published` is frontmatter, not a D1 column, so this list cannot tell
   * a never-published draft from a withdrawn one.
   */
  if (intent === "unpublish") {
    const slug = String(form.get("slug") ?? "");
    const file = await readFile(env, postPath(slug));
    if (!file) return { message: `No post file exists for "${slug}".` };
    const fields = parsePost(file.content);
    // The committed file decides, not the rendered row: another tab may already have withdrawn it.
    if (fields.draft) return { message: `"${slug}" is already a draft. Nothing changed.` };

    try {
      const { purged } = await savePost(env, {
        slug,
        raw: serializePost({ ...fields, draft: true }),
        isNew: false,
        actor,
      });
      return {
        message:
          `Unpublished "${slug}". It is a draft now, so it is off the public site, ` +
          `the feeds and the sitemap. Republish it from its editor.` +
          unpurgedNote(purged === false ? 1 : 0),
      };
    } catch (error) {
      return {
        message: `Unpublish failed. ${errorMessage(error)}`,
      };
    }
  }

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

    const failed: string[] = [];
    let done = 0;
    let skipped = 0;
    let unpurged = 0;

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
      const askFailures: string[] = [];
      for (const slug of slugs) {
        try {
          const { purged, askRemoval } = await deletePost(env, { slug, actor });
          done += 1;
          if (purged === false) unpurged += 1;
          if (askRemoval && !askRemoval.ok) askFailures.push(`${slug}: ${askRemoval.message}`);
        } catch (error) {
          failed.push(`${slug}: ${errorMessage(error)}`);
        }
      }
      return {
        message:
          `Deleted ${done} of ${slugs.length}.` +
          (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : "") +
          (askFailures.length > 0 ? ` Ask removal failed on ${askFailures.join("; ")}` : "") +
          unpurgedNote(unpurged),
      };
    }

    const wanted = parseTags(String(form.get("tag") ?? ""))[0];
    if (!wanted) return { message: "Enter a tag first." };
    const adding = intent === "bulk-add-tag";

    // A no-op post is skipped: writing it costs a commit and rewrites frontmatter whose key order is
    // not yet canonical.
    const tally = await applyBulkTag({
      ids: slugs,
      wanted,
      adding,
      missing: "no source file",
      read: async (slug) => {
        const file = await readFile(env, postPath(slug));
        if (!file) return null;
        const fields = parsePost(file.content);
        return { item: fields, tags: fields.tags };
      },
      write: async (slug, fields, tags) => {
        const { purged } = await savePost(env, {
          slug,
          raw: serializePost({ ...fields, tags }),
          isNew: false,
          actor,
        });
        if (purged === false) unpurged += 1;
      },
    });
    done = tally.done;
    skipped = tally.skipped;
    failed.push(...tally.failed);

    const verb = adding ? "Tagged" : "Untagged";
    const why = adding ? "already tagged" : "not tagged";
    return {
      message:
        `${verb} ${done} with "${wanted}"` +
        (skipped > 0 ? `, skipped ${skipped} ${why}` : "") +
        "." +
        (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : "") +
        unpurgedNote(unpurged),
    };
  }

  if (intent === "reset-ask-budget") {
    if (!askAvailable(env)) return { message: "Ask is not enabled." };
    await resetAskBudget(env);
    const after = await readAskBudget(env);
    return { message: `Ask budget reset. ${after.count} of ${after.limit} used today.` };
  }

  return data(
    { message: `Nothing was done: ${String(intent ?? "(none)")} is not an action this page knows.` },
    { status: 400 },
  );
}

const STATUS_TABS = [
  { key: "all", value: "", label: "All" },
  { key: "published", value: "published", label: "Published" },
  { key: "draft", value: "draft", label: "Drafts" },
  { key: "scheduled", value: "scheduled", label: "Scheduled" },
] as const;

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

  /**
   * Three outcomes: a number, a measured zero, or an absence with a sentence. Never a dash, which
   * reads as zero.
   */
  const readershipFor = (slug: string): { count: number } | { absent: string } => {
    if (readership.status === "error") {
      return { absent: READERSHIP_ABSENT.source + readership.message };
    }
    const count = readership.data.byPath[postReadershipPath(slug)];
    if (typeof count === "number") return { count };
    // Absent from the result: under `complete` that is a measured zero; truncated means the query
    // never asked about this path.
    return readership.data.complete
      ? { count: 0 }
      : { absent: READERSHIP_ABSENT.truncated };
  };

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
      <div className="posts-toolbar">
        <Link to="/admin/posts/new" className="btn">
          New post
        </Link>
        <OverflowMenu label="Maintenance">
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="regenerate"
              className="overflow-menu-item"
              data-menu-item
            >
              Regenerate all
              <span className="overflow-menu-item-hint">
                Re-render every post from the repository
              </span>
            </button>
          </Form>
          {/* Kept here too: the drift alert renders only when the index is dirty, so this runs it pre-emptively. */}
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="sync-ask"
              className="overflow-menu-item"
              data-menu-item
            >
              Sync Ask corpus
              <span className="overflow-menu-item-hint">
                Upload every search record to the AI Search instance that powers Ask
              </span>
            </button>
          </Form>
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="reset-ask-budget"
              className="overflow-menu-item"
              data-menu-item
            >
              Reset Ask budget
              <span className="overflow-menu-item-hint">Clear today&rsquo;s Ask answer count</span>
            </button>
          </Form>
        </OverflowMenu>
      </div>

      {/* The hidden submit keeps the tag facet usable with scripting off. */}
      <Form method="get" action="/admin/posts" className="posts-filters" role="search">
        <label className="sr-only" htmlFor="posts-q">
          Search titles and slugs
        </label>
        <input
          id="posts-q"
          type="search"
          name={FILTER_KEYS.q}
          defaultValue={filters.q}
          placeholder="Search titles and slugs"
          className="posts-filter-input"
        />

        <nav className="posts-tabs" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => {
            const on = filters.status === tab.value;
            return (
              <Link
                key={tab.label}
                to={postsHref({ ...filters, status: tab.value })}
                aria-current={on ? "page" : undefined}
                className="posts-tab"
              >
                {tab.label}
                <span className="posts-tab-count" aria-hidden="true">
                  {statusCounts[tab.key]}
                </span>
                <span className="sr-only">
                  {`, ${statusCounts[tab.key]} post${statusCounts[tab.key] === 1 ? "" : "s"}`}
                </span>
              </Link>
            );
          })}
        </nav>

        <label className="sr-only" htmlFor="posts-tag">
          Tag
        </label>
        <select
          id="posts-tag"
          name={FILTER_KEYS.tag}
          defaultValue={filters.tag}
          className="posts-filter-select"
        >
          <option value="">Any tag</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        {/* Visually hidden, never removed: without it a scriptless reader cannot apply a tag. */}
        <button type="submit" className="sr-only posts-filter-submit">
          Apply the tag filter
        </button>

        {/* A link, not a reset button: `reset` restores the form's defaults, which are the current filters. */}
        {filtered ? (
          <Link to="/admin/posts" className="btn-secondary posts-filter-clear">
            Clear
          </Link>
        ) : null}
      </Form>

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
      {actionData?.message ? (
        <p className="admin-notice" role="status">
          {actionData.message}
        </p>
      ) : null}

      {confirmSyncAsk !== undefined ? (
        <ConfirmDialog
          title="Rebuild the search answer index?"
          body={
            <p>
              Every record not in this run is removed from the index, and saved
              answers are dropped. The site currently has{" "}
              <strong>{confirmSyncAsk}</strong> post(s), so that is
              what the index will hold afterwards.
            </p>
          }
          requireTyped="1"
          confirmLabel="Rebuild the index"
          cancelHref={cancelHref}
        >
          <input type="hidden" name="intent" value="sync-ask" />
        </ConfirmDialog>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${confirmDelete.count} post${
            confirmDelete.count === 1 ? "" : "s"
          }`}
          body={
            <p>
              This removes each markdown file and its rows. Git still has them;
              nothing else does.
            </p>
          }
          stake={confirmDelete.slugs}
          requireTyped={String(confirmDelete.count)}
          confirmLabel="Delete permanently"
          cancelHref={cancelHref}
        >
          {/* The intent is a field: a disabled submitter sends neither its name nor its value. */}
          <input type="hidden" name="intent" value="bulk-delete" />
          {confirmDelete.slugs.map((slug) => (
            <input key={slug} type="hidden" name="slug" value={slug} />
          ))}
        </ConfirmDialog>
      ) : null}

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
        <div className="posts-card">
          {/* One Form around the bar and the table: a form cannot nest inside another. */}
          <Form method="post">
            {/* Always in the document, revealed by CSS `:has()`: client state would leave a scriptless operator ticking boxes with no control. */}
              <div className="posts-bulk" role="group" aria-label="Actions for the selected posts">
                {/* Script-only: "0 selected" above two ticked boxes is worse than no number. */}
                <p className="posts-bulk-count" aria-live="polite">
                  {hydrated ? `${chosen.length} selected` : "With the selected posts"}
                </p>

                <BulkTagControls listId="posts-bulk-tags" options={tagOptions} />
                <button
                  type="submit"
                  name="intent"
                  value="bulk-delete"
                  className="btn-secondary"
                >
                  Delete
                </button>
              </div>

            {/* `tabindex` and the region role make the scroll box reachable by keyboard. */}
            <div className="posts-table-scroll" tabIndex={0} role="region" aria-label="Posts table">
            <table className="posts-table" data-pending={pending || undefined} aria-busy={pending || undefined}>
              {/* `CACHE_SENTENCE` verbatim, as one string: React SSR splices comment nodes between adjacent text. */}
              <thead>
                <tr>
                  <th scope="col" className="posts-check">
                    <label className="posts-check-label">
                      <input
                        type="checkbox"
                        checked={allShown}
                        onChange={() => setSelected(allShown ? [] : visible)}
                      />
                      <span className="sr-only">
                        {filtered
                          ? `Select all ${visible.length} shown`
                          : `Select all ${visible.length}`}
                      </span>
                    </label>
                  </th>
                  <th scope="col" className="posts-title-cell">Title</th>
                  <th scope="col">Published</th>
                  {/* "Reads counted", never "views" or "traffic": a cached read never reaches the Worker. */}
                  <th scope="col" className="posts-readership">Reads counted</th>
                  <th scope="col" className="posts-row-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.slug} data-selected={chosen.includes(post.slug) || undefined}>
                    <td className="posts-check">
                      <label className="posts-check-label">
                        <input
                          type="checkbox"
                          name="slug"
                          value={post.slug}
                          checked={chosen.includes(post.slug)}
                          onChange={() => toggle(post.slug)}
                        />
                        <span className="sr-only">Select {post.title}</span>
                      </label>
                    </td>
                    <td className="posts-title-cell">
                    <span className="posts-title-row">
                      <Link to={`/admin/posts/${post.slug}/edit`} className="posts-title">
                        {post.title}
                      </Link>
                      {/* A word first; color and border-style separate the three again under forced-colors. */}
                      <span className="status-pill" data-state={post.state}>
                        {post.state}
                      </span>
                      {post.featured ? <span className="posts-featured">Featured</span> : null}
                    </span>
                    <span className="posts-slug">/{post.slug}</span>
                  </td>
                  <td className="posts-date">
                    {post.publishAt
                      ? new Date(post.publishAt).toISOString().slice(0, 10)
                      : "not set"}
                    {post.scheduledInDays !== null ? (
                      <span className="posts-date-relative">
                        in {post.scheduledInDays} day{post.scheduledInDays === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </td>
                  <td className="posts-readership">
                    {(() => {
                      const value = readershipFor(post.slug);
                      return "count" in value ? (
                        <span className="posts-readership-count">
                          {value.count.toLocaleString()}
                        </span>
                      ) : (
                        // The reason is content, not a tooltip: a `title` is invisible to touch and to some screen readers.
                        <span className="posts-readership-absent">{value.absent}</span>
                      );
                    })()}
                  </td>
                  <td className="posts-row-actions">
                    {/* Associated by the `form` attribute: this cell is inside the bulk form and forms cannot nest. */}
                    <RowMenu label={`Actions for ${post.title}`}>
                      <Link
                        to={`/admin/posts/${post.slug}/edit`}
                        className="row-menu-item"
                        data-menu-item
                      >
                        Edit
                      </Link>
                      {post.state === "published" ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="row-menu-item"
                          data-menu-item
                        >
                          View on the site
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : null}
                      {post.state === "published" || post.state === "scheduled" ? (
                        <button
                          type="submit"
                          form={rowFormId("unpublish", post.slug)}
                          name="intent"
                          value="unpublish"
                          className="row-menu-item"
                          data-menu-item
                        >
                          Unpublish
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        form={rowFormId("duplicate", post.slug)}
                        name="intent"
                        value="duplicate"
                        className="row-menu-item"
                        data-menu-item
                      >
                        Duplicate
                      </button>
                    </RowMenu>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
            </div>
          </Form>

          {/* Outside the bulk form: forms cannot nest. The slug is a field, not the button's value, or the intents would grow per post. */}
          {posts.map((post) => (
            <Form
              key={`duplicate-${post.slug}`}
              id={rowFormId("duplicate", post.slug)}
              method="post"
              className="posts-row-form"
            >
              <input type="hidden" name="slug" value={post.slug} />
            </Form>
          ))}
          {posts
            .filter((post) => post.state === "published" || post.state === "scheduled")
            .map((post) => (
              <Form
                key={`unpublish-${post.slug}`}
                id={rowFormId("unpublish", post.slug)}
                method="post"
                className="posts-row-form"
              >
                <input type="hidden" name="slug" value={post.slug} />
              </Form>
            ))}

          {/* A disclosure, not a `<caption>`, which screen readers announce before every row. */}
          <details className="posts-explain">
            <summary>What the read count includes, and what it misses</summary>
            <p>
              {readership.status === "live"
                ? `Only reads that reached the server, over the last ${readership.data.windowDays} days, sampling weighted. ` +
                  CACHE_SENTENCE
                : `Read counts could not be loaded: ${readership.message} ` + CACHE_SENTENCE}
            </p>
          </details>

          {filtered || askOn ? (
            <p className="posts-meta">
              {filtered ? `Showing ${posts.length} of ${total} posts. ` : null}
              {ask ? `Search has read ${ask.present} of ${ask.expected} posts.` : null}
              {askUnread ? "The search index status could not be read." : null}
              {askOn ? " " : null}
              {budget
                ? `Budget ${budget.count} of ${budget.limit} answers used on ${budget.day} (UTC); cached answers do not count.`
                : null}
              {budgetError ? `The Ask budget could not be read: ${budgetError}` : null}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
