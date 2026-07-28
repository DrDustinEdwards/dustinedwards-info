import { Form, Link } from "react-router";

import { Panel } from "~/components/admin/panel";
import { listAllPostsForAdmin } from "~/db";
import { getEnv } from "~/lib/context";
import { regenerateAllFromArtifact } from "~/lib/editor/publish.server";
import type { Route } from "./+types/admin.posts._index";

export function meta() {
  return [{ title: "Posts · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return { posts: await listAllPostsForAdmin(getEnv(context)) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") !== "regenerate") return { message: null };
  try {
    const { synced } = await regenerateAllFromArtifact(getEnv(context));
    return { message: `Re-synced ${synced} posts from the committed artifact.` };
  } catch (error) {
    return {
      message: `Regenerate failed. ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export default function AdminPosts({ loaderData, actionData }: Route.ComponentProps) {
  const { posts } = loaderData;

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
      </div>

      {actionData?.message ? (
        <p className="editor-notice" role="status">
          {actionData.message}
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
