import { Form, Link } from "react-router";

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

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const posts = await listAllPostsForAdmin(env);

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
      <div className="posts-toolbar">
        <Link to="/admin/posts/new" className="btn">
          New post
        </Link>
        <Form method="post">
          <button
            type="submit"
            name="intent"
            value="regenerate"
            className="btn-ghost"
            title="Re-sync every post from the committed artifact"
          >
            Regenerate all
          </button>
        </Form>
        <Form method="post">
          <button
            type="submit"
            name="intent"
            value="sync-ask"
            className="btn-ghost"
            title="Upload every search record to the AI Search instance that powers Ask"
          >
            Sync Ask corpus
          </button>
        </Form>
        <Form method="post">
          <button
            type="submit"
            name="intent"
            value="reset-ask-budget"
            className="btn-ghost"
            title="Clear today's Ask answer count"
          >
            Reset Ask budget
          </button>
        </Form>
      </div>

      {actionData?.message ? (
        <p className="editor-notice" role="status">
          {actionData.message}
        </p>
      ) : null}

      {/* Ask index drift. Visible here because a save is allowed to succeed
          when the Ask sync behind it fails, and the save then redirects, so
          there is nowhere else a failure could be reported. */}
      {ask ? (
        <p className={askDrifted ? "editor-notice" : "muted"} role="status">
          {askDrifted
            ? `Ask index drifted: ${ask.missing.length} record(s) missing, ` +
              `${ask.stale.length} stale item(s). Press Sync Ask corpus.`
            : `Ask index in sync: ${ask.present} of ${ask.expected} records.`}
        </p>
      ) : null}

      {budget ? (
        <p className="muted">
          Ask budget: {budget.count} of {budget.limit} answers used on {budget.day} (UTC).
          Cached answers do not count.
        </p>
      ) : null}

      {posts.length === 0 ? (
        <p className="muted">No posts yet.</p>
      ) : (
        <table className="posts-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Status</th>
              <th scope="col">Publish date</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.slug}>
                <td>
                  <span className="posts-title">{post.title}</span>
                  <span className="muted posts-slug">/{post.slug}</span>
                </td>
                <td>
                  <span className={`chip ${post.status === "published" ? "chip-live" : ""}`}>
                    {post.status}
                  </span>
                </td>
                <td>
                  {post.publishAt
                    ? new Date(post.publishAt).toISOString().slice(0, 10)
                    : "not set"}
                </td>
                <td className="posts-actions">
                  <Link to={`/admin/posts/${post.slug}/edit`}>Edit</Link>
                  {post.status === "published" ? (
                    <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
