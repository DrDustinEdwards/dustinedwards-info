import { useState } from "react";
import { Form, Link } from "react-router";

import { AdminAlert } from "~/components/admin/alert";
import { OverflowMenu } from "~/components/admin/overflow-menu";
import { Panel } from "~/components/admin/panel";
import { listAllPostsForAdmin, listAllPostTagsForAdmin } from "~/db";
import { getEnv } from "~/lib/context";
import { parsePost, parseTags, serializePost } from "~/lib/editor/frontmatter";
import { readFile } from "~/lib/editor/github.server";
import {
  deletePost,
  loadArtifact,
  postPath,
  regenerateAllFromArtifact,
  savePost,
} from "~/lib/editor/publish.server";
import {
  askAvailable,
  askStatusContext,
  pruneAskCorpus,
  syncAskCorpus,
} from "~/lib/search/ask.server";
import { readAskBudget, resetAskBudget } from "~/lib/search/ask-guard.server";
import type { Route } from "./+types/admin.posts._index";

export function meta() {
  return [{ title: "Posts · Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * The pill's three states out of the two the database stores.
 *
 * "scheduled" is derived, not a column: `status` is only ever draft or
 * published, and a published row whose `publish_at` is still ahead of now is
 * live to the admin and invisible to the public. The test is deliberately the
 * same one `publiclyVisible()` runs, so the pill cannot claim a post is on the
 * site when the public query would hide it.
 *
 * Derived in the LOADER rather than in the component, because it reads the
 * clock. Computed during render it would be evaluated once on the server and
 * again on the client, and a post scheduled for the next few seconds would
 * hydrate into a different word than it rendered with.
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

/** The three filter keys, named once so the form, the loader and the clear link agree. */
const FILTER_KEYS = { q: "q", status: "status", tag: "tag" } as const;

/**
 * The filter state, read from the URL and normalized.
 *
 * URL-driven rather than component state, which is what makes it work with
 * scripting off and makes a filtered list a LINK. `status` is validated against
 * the three states the pill can show, so a hand-typed `?status=banana` degrades
 * to "no status filter" rather than silently matching nothing and looking like
 * an empty corpus.
 */
function readFilters(params: URLSearchParams) {
  const status = (params.get(FILTER_KEYS.status) ?? "").trim();
  return {
    q: (params.get(FILTER_KEYS.q) ?? "").trim(),
    status: status === "published" || status === "scheduled" || status === "draft" ? status : "",
    tag: (params.get(FILTER_KEYS.tag) ?? "").trim(),
  };
}

/**
 * Days from now until a scheduled post goes live, rounded UP.
 *
 * Ceiling rather than round, because a post going live in 30 hours is "in 2
 * days" and never "in 1 day": the author must not read a number that has
 * already passed. Computed in the LOADER for the same reason `statusOf` is;
 * see the note there.
 */
function daysUntil(publishAt: Date, now: number) {
  return Math.max(1, Math.ceil((publishAt.getTime() - now) / 86_400_000));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const filters = readFilters(new URL(request.url).searchParams);

  const [rows, tagRows] = await Promise.all([
    listAllPostsForAdmin(env),
    listAllPostTagsForAdmin(env),
  ]);

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
      // Only a scheduled post has one, and it is a NUMBER by the time the
      // component sees it. Rendering "in N days" from a date in the component
      // would read the clock during render, which is the trap `statusOf`
      // already documents: the server and the hydration would disagree for any
      // post near a day boundary.
      scheduledInDays:
        state === "scheduled" && post.publishAt ? daysUntil(post.publishAt, now) : null,
    };
  });

  // Searching title AND slug, because the slug is what the author types when
  // they remember the URL and not the wording of the headline.
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

  // Ask index drift, shown because the editor's Ask sync is allowed to fail
  // without failing the save. This is an ADMIN page, so it may await the AI
  // layer; no public route ever does.
  //
  // The status now comes from the reader the admin layout's middleware put on
  // the context, because the Posts nav badge wants the same fact and a listing
  // per consumer would be two. It still arrives in THIS route's loader data:
  // the alert owns the repair, and check:admin-ui fabricates `ask` here.
  const ask = await context.get(askStatusContext)();

  let budget: Awaited<ReturnType<typeof readAskBudget>> | null = null;
  if (askAvailable(env)) {
    try {
      budget = await readAskBudget(env);
    } catch (error) {
      console.error("ask budget read failed", error);
    }
  }

  return {
    posts,
    ask,
    budget,
    filters,
    filtered,
    /** The unfiltered total, so the list can say "12 of 31" honestly. */
    total: all.length,
    /**
     * The scheduled queue's headline number, counted over the WHOLE corpus and
     * not the filtered view. What is scheduled is a fact about the site, and it
     * must not disappear because the author happened to be searching.
     */
    scheduledTotal: all.filter((post) => post.state === "scheduled").length,
    /** Every tag in use, drafts included, for the filter's options. */
    tagOptions: [...new Set(tagRows.map((row) => row.tag))].sort(),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const env = getEnv(context);
  const intent = form.get("intent");

  if (intent === "regenerate") {
    try {
      const { synced } = await regenerateAllFromArtifact(env);
      return { message: `Re-synced ${synced} posts from the committed artifact.` };
    } catch (error) {
      return {
        message: `Regenerate failed. ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Ask mode's corpus. Separate from Regenerate because they fail
  // independently: D1 is the site's search and must not be held hostage to the
  // AI index, and the AI index must never be repaired by touching D1.
  if (intent === "sync-ask") {
    if (!askAvailable(env)) {
      return { message: "Ask is not enabled: no AI Search binding." };
    }
    try {
      const posts = await loadArtifact(env);
      const { uploaded, keys, cacheDropped } = await syncAskCorpus(env, posts);
      const removed = await pruneAskCorpus(env, keys);
      return {
        message:
          `Uploaded ${uploaded} search records to AI Search` +
          (removed.length > 0 ? `, removed ${removed.length} stale item(s)` : "") +
          `, dropped ${cacheDropped} cached answer(s).`,
      };
    } catch (error) {
      return {
        message: `Ask sync failed. ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /*
   * BULK OPERATIONS.
   *
   * Each one ITERATES the existing per-post write function, serially, one
   * commit per post. There is no bulk commit variant and no second write path:
   * `deletePost` and `savePost` stay the only mutators, so every gate, policy
   * and side effect that guards a single post guards each of these too.
   *
   * expectedHeadSha is OMITTED, which `commitFiles` documents as the
   * no-optimistic-check path (`github.server.ts:190` treats a falsy value as
   * "do not compare"). That is correct here rather than lax: each successful
   * commit ADVANCES head, so one captured sha would refuse on iteration two by
   * construction, and `commitFiles` re-reads head itself on every call
   * (`:188`), so each iteration already builds on the current tree. Re-reading
   * `currentHead` per iteration would add a round trip and protect against
   * nothing a single-admin bulk action can hit.
   *
   * PARTIAL FAILURE IS THE DESIGN CENTRE. There is no transaction across
   * posts, so the loop continues past a failure and reports per slug. That is
   * safe because each post is an independent commit and `deletePost` throws
   * before `commitFiles` when the file is missing, so a refused post leaves
   * nothing half-written.
   */
  if (
    intent === "bulk-delete" ||
    intent === "bulk-add-tag" ||
    intent === "bulk-remove-tag"
  ) {
    const slugs = form.getAll("slug").map(String).filter(Boolean);
    if (slugs.length === 0) return { message: "Nothing selected." };

    /** Per-slug failures, so one bad post cannot hide behind a total. */
    const failed: string[] = [];
    let done = 0;
    let skipped = 0;

    if (intent === "bulk-delete") {
      for (const slug of slugs) {
        try {
          await deletePost(env, { slug });
          done += 1;
        } catch (error) {
          failed.push(`${slug}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return {
        message:
          `Deleted ${done} of ${slugs.length}.` +
          (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : ""),
      };
    }

    // Retag ADDS or REMOVES one tag. It never replaces the set, so a post's
    // other tags are untouched and a mistake costs one tag rather than all.
    const wanted = parseTags(String(form.get("tag") ?? ""))[0];
    if (!wanted) return { message: "Enter a tag first." };
    const adding = intent === "bulk-add-tag";

    for (const slug of slugs) {
      try {
        const file = await readFile(env, postPath(slug));
        if (!file) {
          failed.push(`${slug}: no source file`);
          continue;
        }
        const fields = parsePost(file.content);
        const has = fields.tags.includes(wanted);
        // A no-op post is SKIPPED rather than committed. Writing it anyway
        // would cost a commit that changes nothing, and would rewrite the
        // frontmatter of the two posts whose key order is not yet canonical.
        if (adding === has) {
          skipped += 1;
          continue;
        }
        const tags = adding
          ? [...fields.tags, wanted]
          : fields.tags.filter((t) => t !== wanted);
        await savePost(env, {
          slug,
          raw: serializePost({ ...fields, tags }),
          isNew: false,
        });
        done += 1;
      } catch (error) {
        failed.push(`${slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const verb = adding ? "Tagged" : "Untagged";
    const why = adding ? "already tagged" : "not tagged";
    return {
      message:
        `${verb} ${done} with "${wanted}"` +
        (skipped > 0 ? `, skipped ${skipped} ${why}` : "") +
        "." +
        (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : ""),
    };
  }

  if (intent === "reset-ask-budget") {
    if (!askAvailable(env)) return { message: "Ask is not enabled." };
    await resetAskBudget(env);
    const after = await readAskBudget(env);
    return { message: `Ask budget reset. ${after.count} of ${after.limit} used today.` };
  }

  return { message: null };
}

export default function AdminPosts({ loaderData, actionData }: Route.ComponentProps) {
  const { posts, ask, budget, filters, filtered, total, scheduledTotal, tagOptions } =
    loaderData;
  const askDrifted = ask ? ask.missing.length > 0 || ask.stale.length > 0 : false;

  /*
   * Selection lives in the client, which the admin plane is allowed (hard rule
   * 9 exempts it, and /login with it). The public plane's law is untouched.
   *
   * Keyed by slug rather than by row index so a re-render, a sort or a filter
   * change cannot silently re-point a selection at a different post. The
   * selection is deliberately NOT persisted across a filter change either: the
   * bulk bar can only ever act on what the author can currently see.
   */
  const [selected, setSelected] = useState<string[]>([]);
  const visible = posts.map((post) => post.slug);
  const chosen = selected.filter((slug) => visible.includes(slug));
  const allShown = chosen.length > 0 && chosen.length === visible.length;

  const toggle = (slug: string) =>
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  /**
   * The confirm text names the COUNT and the slugs, matching the single-delete
   * discipline in the editor. Long selections name the first few and then the
   * remainder, because a dialog nobody can read is a dialog nobody reads.
   */
  const confirmDelete = () => {
    const shown = chosen.slice(0, 5);
    const rest = chosen.length - shown.length;
    const list = shown.join(", ") + (rest > 0 ? `, and ${rest} more` : "");
    return confirm(
      `Delete ${chosen.length} post${chosen.length === 1 ? "" : "s"}? ` +
        `This removes each file and its rows.\n\n${list}`,
    );
  };

  /** What the author actually asked for, in words, for the empty state. */
  const askedFor = [
    filters.q ? `"${filters.q}"` : null,
    filters.status ? `status ${filters.status}` : null,
    filters.tag ? `tag ${filters.tag}` : null,
  ].filter(Boolean);

  return (
    <Panel
      title="Posts"
      description="Every post, drafts included. Saving commits a markdown file to main and then syncs D1."
    >
      {/* New post is the only thing in this row that CREATES. The other three
          intents repair, so they sit behind the overflow on the far side
          rather than beside the primary action wearing the same weight. Every
          one of them submits the identical form it did before: same method,
          same intent value, same action. */}
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
                Re-sync every post from the committed artifact
              </span>
            </button>
          </Form>
          {/* Kept here as well as in the drift alert. The alert owns the repair
              when there is something to repair, but it does not render when the
              index is clean, and an intent that exists only while it is needed
              cannot be run pre-emptively. */}
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

      {/*
        SEARCH AND FILTER, as a GET form.

        A GET form is the whole design: the filter state lives in the URL, so it
        survives a reload, is linkable, is what the back button restores, and
        works with scripting off with no enhancement at all. That is also why
        this is a plain <form> rather than react-router's <Form>: the browser's
        own submission already produces exactly the navigation wanted.

        It is a NEW SUBMISSION on this page and therefore a real change to
        check:admin-ui's fixture. Regenerated deliberately, with the before and
        after triples reported, per the queue's standing rule.
      */}
      <form method="get" className="posts-filters" role="search">
        <div className="posts-filter-field">
          <label htmlFor="posts-q">Search</label>
          <input
            id="posts-q"
            type="search"
            name={FILTER_KEYS.q}
            defaultValue={filters.q}
            placeholder="Title or slug"
            className="posts-filter-input"
          />
        </div>

        <div className="posts-filter-field">
          <label htmlFor="posts-status">Status</label>
          <select
            id="posts-status"
            name={FILTER_KEYS.status}
            defaultValue={filters.status}
            className="posts-filter-select"
          >
            <option value="">Any status</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="posts-filter-field">
          <label htmlFor="posts-tag">Tag</label>
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
        </div>

        <button type="submit" className="btn-ghost posts-filter-submit">
          Filter
        </button>
        {/* A LINK, not a reset button: clearing means going to the unfiltered
            URL, and a link says that and is bookmarkable. `reset` would restore
            the form's defaults, which are the CURRENT filters, so it would
            appear to do nothing. */}
        {/* `.btn-ghost`, matching the empty state's Clear, and that settles the
            fourth appearance of the a:visited specificity rule at the DESIGN
            level rather than with another `:visited` selector. A bare text link
            to an already-visited URL correctly turns claret, so the two Clears
            did not match. A ghost button carries a border, which is a
            non-colour affordance, so rule 2 exempts it from the underline and
            from visited styling and the two controls now agree. */}
        {filtered ? (
          <Link to="/admin/posts" className="btn-ghost posts-filter-clear">
            Clear
          </Link>
        ) : null}
      </form>

      {/*
        THE SCHEDULED QUEUE, stated whenever anything is scheduled.

        It is counted over the whole corpus rather than the filtered view, and
        it links to the filtered list rather than duplicating it: what is
        scheduled is a fact about the site, and a second table would be a second
        thing to keep true. Neutral, not tinted: this is information, and rule 4
        spends the one tint per view on the drift alert.
      */}
      {scheduledTotal > 0 ? (
        <p className="posts-scheduled-note">
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

      {/* This one IS a live announcement, and correctly so: it reports what the
          submit the operator just pressed did. Unlike the drift region below,
          it is news. */}
      {actionData?.message ? (
        <p className="editor-notice" role="status">
          {actionData.message}
        </p>
      ) : null}

      {/* Ask index drift. Surfaced here because a save is allowed to succeed
          when the Ask sync behind it fails, and the save then redirects, so
          there is nowhere else a failure could be reported. Nothing renders
          when the index is clean; the count still reaches the meta line under
          the table, where it is reference rather than a demand. */}
      {askDrifted && ask ? (
        <AdminAlert
          title="Ask index drifted"
          headingId="ask-drift"
          action={
            <Form method="post">
              <button type="submit" name="intent" value="sync-ask" className="btn">
                Sync Ask corpus
              </button>
            </Form>
          }
        >
          <p>
            {ask.missing.length} record(s) missing from the index, {ask.stale.length} stale
            item(s) left in it. Ask is answering from a corpus that no longer matches the
            site.
          </p>
        </AdminAlert>
      ) : null}

      {posts.length === 0 ? (
        /* Two different nothings, and they must not read the same. An empty
           corpus is a state of the site; an empty RESULT is a state of the
           question just asked, so it repeats the question and offers the way
           back out. Reporting "no posts yet" to someone who mistyped a slug
           would be the system lying about itself. */
        filtered ? (
          <div className="posts-empty">
            <p>
              No posts match {askedFor.join(", ")}. Searched {total} post
              {total === 1 ? "" : "s"} by title and slug.
            </p>
            <Link to="/admin/posts" className="btn-ghost">
              Clear filters
            </Link>
          </div>
        ) : (
          <p className="muted">No posts yet.</p>
        )
      ) : (
        <div className="posts-card">
          {/* One Form around the bar AND the table, so the checkboxes are its
              own controls. Nesting a form inside another is invalid, which is
              why this sits here rather than wrapping the toolbar above. */}
          <Form method="post">
            {chosen.length > 0 ? (
              <div className="posts-bulk" role="group" aria-label="Bulk actions">
                <p className="posts-bulk-count" aria-live="polite">
                  {chosen.length} selected
                </p>

                <label className="posts-bulk-tag">
                  <span>Tag</span>
                  <input
                    type="text"
                    name="tag"
                    list="posts-bulk-tags"
                    autoComplete="off"
                    placeholder="tag name"
                  />
                </label>
                {/* The vocabulary the loader already ships, offered rather than
                    enforced: a new tag is legitimate. */}
                <datalist id="posts-bulk-tags">
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>

                <button type="submit" name="intent" value="bulk-add-tag" className="btn">
                  Add tag
                </button>
                <button type="submit" name="intent" value="bulk-remove-tag" className="btn">
                  Remove tag
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="bulk-delete"
                  className="btn-danger"
                  onClick={(event) => {
                    if (!confirmDelete()) event.preventDefault();
                  }}
                >
                  Delete
                </button>
              </div>
            ) : null}

            <table className="posts-table">
              <thead>
                <tr>
                  <th scope="col" className="posts-check">
                    <label className="posts-check-label">
                      <input
                        type="checkbox"
                        checked={allShown}
                        onChange={() => setSelected(allShown ? [] : visible)}
                      />
                      {/* Never the bare word "all" while a filter is active:
                          this only ever selects what is on screen. */}
                      <span className="sr-only">
                        {filtered
                          ? `Select all ${visible.length} shown`
                          : `Select all ${visible.length}`}
                      </span>
                    </label>
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Title</th>
                  <th scope="col">Publish date</th>
                  <th scope="col">Actions</th>
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
                    <td>
                    {/* Rule 1: the state is a WORD first. Colour separates the
                        three at a glance and border-style separates them again,
                        so the pill still says three different things once
                        forced-colors has taken the fill and the tint away. */}
                    <span className="status-pill" data-state={post.state}>
                      {post.state}
                    </span>
                  </td>
                  <td>
                    <Link to={`/admin/posts/${post.slug}/edit`} className="posts-title">
                      {post.title}
                    </Link>
                    <span className="posts-slug">/{post.slug}</span>
                  </td>
                  <td className="posts-date">
                    {post.publishAt
                      ? new Date(post.publishAt).toISOString().slice(0, 10)
                      : "not set"}
                    {/* The queue, per post: a scheduled row says WHEN in
                        readable terms as well as in ISO. The number arrived
                        from the loader already computed, so nothing here reads
                        the clock. */}
                    {post.scheduledInDays !== null ? (
                      <span className="posts-date-relative">
                        in {post.scheduledInDays} day{post.scheduledInDays === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <div className="posts-actions">
                      <Link to={`/admin/posts/${post.slug}/edit`} className="row-action">
                        Edit
                      </Link>
                      {/* Only a post the public query would actually return.
                          A scheduled post is published in the database and 404s
                          on the site, so offering View for it sends the author
                          to a dead page. */}
                      {post.state === "published" ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="row-action"
                        >
                          View
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M15 3h6v6" />
                            <path d="M10 14 21 3" />
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          </svg>
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </Form>

          {/* Reference, not a demand: the numbers that describe the AI layer's
              condition sit under the thing they describe, quiet, and only the
              drift alert above ever asks for anything. */}
          {filtered || ask || budget ? (
            <p className="posts-meta">
              {/* Only when filtered. Unfiltered, "31 of 31" is noise. */}
              {filtered ? `Showing ${posts.length} of ${total} posts. ` : null}
              {ask ? `Ask index: ${ask.present} of ${ask.expected} records indexed.` : null}
              {ask && budget ? " " : null}
              {budget
                ? `Budget ${budget.count} of ${budget.limit} answers used on ${budget.day} (UTC); cached answers do not count.`
                : null}
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
