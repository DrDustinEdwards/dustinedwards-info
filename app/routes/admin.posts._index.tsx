import { Form, Link } from "react-router";

import { AdminAlert } from "~/components/admin/alert";
import { OverflowMenu } from "~/components/admin/overflow-menu";
import { Panel } from "~/components/admin/panel";
import { listAllPostsForAdmin } from "~/db";
import { getEnv } from "~/lib/context";
import { loadArtifact, regenerateAllFromArtifact } from "~/lib/editor/publish.server";
import {
  askAvailable,
  askIndexStatus,
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

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const rows = await listAllPostsForAdmin(env);
  const now = Date.now();
  const posts = rows.map((post) => ({
    ...post,
    state: statusOf(post.status, post.publishAt, now),
  }));

  // Ask index drift, shown because the editor's Ask sync is allowed to fail
  // without failing the save. This is an ADMIN page, so it may await the AI
  // layer; no public route ever does.
  let ask: Awaited<ReturnType<typeof askIndexStatus>> | null = null;
  let budget: Awaited<ReturnType<typeof readAskBudget>> | null = null;
  if (askAvailable(env)) {
    try {
      ask = await askIndexStatus(env, await loadArtifact(env));
      budget = await readAskBudget(env);
    } catch (error) {
      console.error("ask index status failed", error);
    }
  }

  return { posts, ask, budget };
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

  if (intent === "reset-ask-budget") {
    if (!askAvailable(env)) return { message: "Ask is not enabled." };
    await resetAskBudget(env);
    const after = await readAskBudget(env);
    return { message: `Ask budget reset. ${after.count} of ${after.limit} used today.` };
  }

  return { message: null };
}

export default function AdminPosts({ loaderData, actionData }: Route.ComponentProps) {
  const { posts, ask, budget } = loaderData;
  const askDrifted = ask ? ask.missing.length > 0 || ask.stale.length > 0 : false;

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
        <p className="muted">No posts yet.</p>
      ) : (
        <div className="posts-card">
          <table className="posts-table">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Title</th>
                <th scope="col">Publish date</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.slug}>
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

          {/* Reference, not a demand: the numbers that describe the AI layer's
              condition sit under the thing they describe, quiet, and only the
              drift alert above ever asks for anything. */}
          {ask || budget ? (
            <p className="posts-meta">
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
