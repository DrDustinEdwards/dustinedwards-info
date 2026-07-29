import { Form, Link, data, redirect } from "react-router";

import { Panel } from "~/components/admin/panel";
import { PostEditor } from "~/components/admin/post-editor";
import { getEnv } from "~/lib/context";
import { handleEditorAction } from "~/lib/editor/action.server";
import { feedbackFromSearch, savedRedirectPath } from "~/lib/editor/feedback";
import { parsePost } from "~/lib/editor/frontmatter";
import { currentHead, deletePost, EditorError, GitHubError } from "~/lib/editor/publish.server";
import { readFile } from "~/lib/editor/github.server";
import type { Route } from "./+types/admin.posts.$slug.edit";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Edit ${params.slug} · Admin` }, { name: "robots", content: "noindex" }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const file = await readFile(env, `content/posts/${params.slug}.md`);
  if (!file) throw data("Not found", { status: 404 });

  return {
    fields: parsePost(file.content),
    headSha: await currentHead(env).catch(() => ""),
    slug: params.slug,
    // A save redirects back here carrying what it did. Read on the server, so
    // the message is in the first byte of HTML and needs no script to appear.
    saved: feedbackFromSearch(new URL(request.url).searchParams, params.slug),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const clone = request.clone();
  const form = await clone.formData();

  if (form.get("intent") === "delete") {
    try {
      await deletePost(env, {
        slug: params.slug,
        expectedHeadSha: String(form.get("headSha") ?? "") || null,
      });
      return redirect("/admin/posts");
    } catch (error) {
      const message =
        error instanceof EditorError || error instanceof GitHubError
          ? error.message
          : String(error);
      return {
        kind: "problem" as const,
        fields: parsePost(String(form.get("body") ?? "")),
        problem: { message, conflict: error instanceof GitHubError && error.conflict },
        headSha: await currentHead(env).catch(() => ""),
      };
    }
  }

  const result = await handleEditorAction(env, request);
  // Back to this page rather than the post list. A save used to land on the
  // list with nothing to say, which is how a first publication completed in
  // silence: the one act reserved to the human looked like nothing had
  // happened at all.
  if (result.kind === "saved") return redirect(savedRedirectPath(result));
  return result;
}

export default function EditPost({ loaderData, actionData }: Route.ComponentProps) {
  const fields = actionData && "fields" in actionData ? actionData.fields : loaderData.fields;
  const headSha = actionData && "headSha" in actionData ? actionData.headSha : loaderData.headSha;

  // Persistent until the NEXT action, and the next action is whatever produced
  // an actionData: a failure replaces the message, and a preview clears it,
  // because by then the URL is describing a save two steps ago.
  const feedback =
    actionData?.kind === "problem"
      ? {
          state: "failed" as const,
          message: actionData.problem.message,
          conflict: Boolean(actionData.problem.conflict),
        }
      : actionData
        ? null
        : loaderData.saved;

  return (
    <Panel
      title={`Edit: ${loaderData.slug}`}
      description="Saving commits the markdown and the regenerated artifact in one commit, then syncs D1."
    >
      <PostEditor
        fields={fields}
        isNew={false}
        headSha={headSha}
        previewHtml={actionData?.kind === "preview" ? actionData.previewHtml : null}
        feedback={feedback}
      />

      <p className="posts-toolbar">
        <Link to={`/admin/posts/${loaderData.slug}/history`} className="btn-ghost">
          Version history
        </Link>
      </p>

      <Form
        method="post"
        className="editor-danger"
        onSubmit={(event) => {
          if (!confirm(`Delete "${loaderData.slug}"? This removes the file and its rows.`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="headSha" value={headSha} />
        <h2>Delete</h2>
        <p className="muted">
          Removes content/posts/{loaderData.slug}.md, its entry in the generated
          artifact, and its rows, in one commit.
        </p>
        <button type="submit" name="intent" value="delete" className="btn-danger">
          Delete post
        </button>
      </Form>
    </Panel>
  );
}
