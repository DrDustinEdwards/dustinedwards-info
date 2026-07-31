import { Form, Link, data, redirect } from "react-router";

import { PostEditor } from "~/components/admin/post-editor";
import { listBlogTags } from "~/db";
import { getEnv } from "~/lib/context";
import { handleEditorAction } from "~/lib/editor/action.server";
import { feedbackFromSearch, savedRedirectPath } from "~/lib/editor/feedback";
import { parsePost } from "~/lib/editor/frontmatter";
import { stateOf } from "~/lib/editor/publish-transition.mjs";
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

  const fields = parsePost(file.content);

  return {
    fields,
    headSha: await currentHead(env).catch(() => ""),
    slug: params.slug,
    // A save redirects back here carrying what it did. Read on the server, so
    // the message is in the first byte of HTML and needs no script to appear.
    saved: feedbackFromSearch(new URL(request.url).searchParams, params.slug),
    // Derived HERE rather than in the component, for the same reason the posts
    // index derives its pill in its loader: `stateOf` reads the clock, and a
    // component that recomputed it would render one word on the server and
    // hydrate a different one for a post scheduled seconds away.
    state: stateOf(fields, Date.now()),
    // The one fact the transition table needs that current state cannot give:
    // a draft is either brand new or previously withdrawn, and only
    // `first_published` in the committed file tells them apart. It is the same
    // fact publish-policy.mjs gates the operator's first publication on.
    everPublished: fields.firstPublished.trim() !== "",
    // Autocomplete for the tag field. Whatever is already in use on the site,
    // so tagging tends toward the existing vocabulary instead of inventing a
    // near-duplicate of a tag that already exists.
    tagOptions: (await listBlogTags(env).catch(() => [])).map((tag) => tag.slug),
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

  // The state the editor renders against comes from the loader, but a failed
  // save hands back the fields the author submitted, and those can disagree.
  // The transition must describe what is COMMITTED, so it stays the loader's.
  const state = loaderData.state;

  return (
    <>
      <PostEditor
        fields={fields}
        isNew={false}
        headSha={headSha}
        previewHtml={actionData?.kind === "preview" ? actionData.previewHtml : null}
        feedback={feedback}
        state={state}
        everPublished={loaderData.everPublished}
        tagOptions={loaderData.tagOptions}
        historySlot={
          <>
            <p className="muted">
              Every save is a commit. Nothing is ever rewritten, and a restore
              lands as a new commit on top.
            </p>
            <Link to={`/admin/posts/${loaderData.slug}/history`} className="row-action">
              Open version history
            </Link>
          </>
        }
        dangerSlot={
          <>
            <p className="muted">
              Removes content/posts/{loaderData.slug}.md, its entry in the
              generated artifact, and its rows, in one commit.
            </p>
            {/*
              Associated by the `form` attribute rather than by containment.
              The delete form cannot be nested inside the editing form, because
              nested forms are not valid HTML and the browser drops the inner
              one, so the button lives in the drawer and points at a form that
              sits outside it. Same request as before: POST here, intent=delete,
              carrying headSha.
            */}
            <button
              type="submit"
              form="delete-post"
              name="intent"
              value="delete"
              className="btn-danger"
            >
              Delete post
            </button>
          </>
        }
      />

      <Form
        id="delete-post"
        method="post"
        className="editor-delete-form"
        onSubmit={(event) => {
          if (!confirm(`Delete "${loaderData.slug}"? This removes the file and its rows.`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="headSha" value={headSha} />
      </Form>
    </>
  );
}
