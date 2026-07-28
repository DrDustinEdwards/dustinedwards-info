import { Form, Link, data, redirect } from "react-router";

import { Panel } from "~/components/admin/panel";
import { PostEditor } from "~/components/admin/post-editor";
import { getEnv } from "~/lib/context";
import { handleEditorAction } from "~/lib/editor/action.server";
import { parsePost } from "~/lib/editor/frontmatter";
import { currentHead, deletePost, EditorError, GitHubError } from "~/lib/editor/publish.server";
import { readFile } from "~/lib/editor/github.server";
import type { Route } from "./+types/admin.posts.$slug.edit";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Edit ${params.slug} · Admin` }, { name: "robots", content: "noindex" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const file = await readFile(env, `content/posts/${params.slug}.md`);
  if (!file) throw data("Not found", { status: 404 });

  return {
    fields: parsePost(file.content),
    headSha: await currentHead(env).catch(() => ""),
    slug: params.slug,
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
  if (result.kind === "saved") return redirect("/admin/posts");
  return result;
}

export default function EditPost({ loaderData, actionData }: Route.ComponentProps) {
  const fields = actionData && "fields" in actionData ? actionData.fields : loaderData.fields;
  const headSha = actionData && "headSha" in actionData ? actionData.headSha : loaderData.headSha;

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
        problem={actionData?.kind === "problem" ? actionData.problem : null}
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
