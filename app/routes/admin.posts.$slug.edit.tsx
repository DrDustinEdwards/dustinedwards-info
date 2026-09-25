import { Form, Link, data, redirect } from "react-router";

import { timed, timingsContext } from "~/lib/timing";

import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { PostEditor } from "~/components/admin/post-editor";
import {
  CREATE_FORM_ID,
  PreviewLinks,
  revokeFormId,
  type PreviewLinkView,
} from "~/components/admin/preview-links";
import { adminActorContext, adminSessionContext } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import { listPreviewLinks } from "~/lib/preview-links.server";
import { previewUrl } from "~/lib/preview-token.mjs";
import { loadEditorOptions } from "~/lib/editor/link-targets.server";
import { handleEditorAction } from "~/lib/editor/action.server";
import { previewLinkAction } from "~/lib/editor/preview-link-action.server";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import { feedbackFromSearch, savedRedirectPath } from "~/lib/editor/feedback";
import { parsePost } from "~/lib/editor/frontmatter";
import { stateOf } from "~/lib/editor/publish-transition.mjs";
import { currentHead, deletePost, EditorError, GitHubError } from "~/lib/editor/publish.server";
import { readHead } from "~/lib/editor/head.server";
import { postPath } from "~/lib/content/slug.mjs";
import { DELETE_LEFT_PARAM } from "~/lib/editor/delete-left.mjs";
import { listCommitsForPath, readFile } from "~/lib/editor/github.server";
import type { Route } from "./+types/admin.posts.$slug.edit";
import { errorMessage } from "~/lib/error-message.mjs";

/*
 * A handle, not a loader field: the flag other readers use reflects what is saved, and the
 * author is typing something that has not been.
 */
export const handle = { math: true };

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Edit ${params.slug} · Admin` }, { name: "robots", content: "noindex" }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const env = getEnv(context);
  const file = await timed(timings, "gh_read_file", () => readFile(env, postPath(params.slug)));
  if (!file) throw data("Not found", { status: 404 });

  const fields = parsePost(file.content);
  const state = stateOf(fields, Date.now());
  const origin = new URL(request.url).origin;

  /* Each read below is non-fatal, so an outage cannot blank the editor, but its failure is shown, never an empty list. */
  const settled = <T,>(what: string, read: Promise<T[]>) =>
    read.then(
      (value) => ({ value, error: null as string | null }),
      (error: unknown) => {
        console.error(`editor ${what} read failed`, error);
        return { value: [] as T[], error: errorMessage(error) };
      },
    );

  const { headSha, headError } = await timed(timings, "gh_head", () => readHead(env));

  const links =
    state === "draft"
      ? await timed(timings, "kv_preview_links", () =>
          settled("preview links", listPreviewLinks(env, params.slug)),
        )
      : { value: [], error: null };

  const options = await loadEditorOptions(env, timings);

  const revisions = await timed(timings, "gh_commits", () =>
    settled("revisions", listCommitsForPath(env, postPath(params.slug))),
  );

  return {
    fields,
    headSha,
    headError,
    slug: params.slug,
    saved: feedbackFromSearch(new URL(request.url).searchParams, params.slug),
    // Derived here because `stateOf` reads the clock: recomputed in the component, a post scheduled
    // seconds away would render one word on the server and hydrate another.
    state,
    previewLinks: links.value.map((link) => ({ ...link, url: previewUrl(origin, link.token) })),
    previewLinksError: links.error,
    // Only `first_published` in the committed file tells a brand-new draft from a withdrawn one.
    everPublished: fields.firstPublished.trim() !== "",
    tagOptions: options.tagOptions,
    loadProblems: options.problems,
    linkTargets: options.linkTargets,
    revisions: revisions.value,
    revisionsError: revisions.error,
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const clone = request.clone();
  const form = await clone.formData();

  const intent = form.get("intent");

  /* After a failed action the page keeps the head it was loaded with; a failed re-read is logged, not shown as a missing token. */
  const headAfterProblem = () =>
    currentHead(env).catch((error: unknown) => {
      console.error("editor head re-read failed", error);
      return String(form.get("headSha") ?? "");
    });

  if (intent === "preview-link" || intent === "revoke-preview-link") {
    return previewLinkAction(env, {
      intent,
      slug: params.slug,
      origin: new URL(request.url).origin,
      form,
      createdBy: () => context.get(adminSessionContext).user.email,
      headAfterProblem,
    });
  }

  if (intent === "delete") {
    /*
     * The confirmation is checked here, not in onSubmit: with scripting off the handler never runs.
     * `expectedHeadSha` is concurrency, not consent.
     */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, 1)) {
      return { kind: "confirm-delete" as const, slug: params.slug };
    }
    /* Without the head the page was loaded at, a change made since could not be detected, so no delete. */
    const expectedHeadSha = String(form.get("headSha") ?? "");
    if (!expectedHeadSha) {
      return {
        kind: "problem" as const,
        fields: undefined,
        problem: {
          message:
            "Delete refused: this page has no repository head, so a change made since it loaded could not be detected. Reload and try again.",
          conflict: false,
          field: undefined,
          line: undefined,
        },
        headSha: await headAfterProblem(),
      };
    }
    try {
      const { purged, askRemoval } = await deletePost(env, {
        slug: params.slug,
        expectedHeadSha,
        actor: context.get(adminActorContext),
      });
      /* The delete landed, so it redirects; what it left behind travels to the list page to be said there. */
      const left = new URLSearchParams();
      if (askRemoval && !askRemoval.ok) left.append(DELETE_LEFT_PARAM, "ask");
      if (purged === false) left.append(DELETE_LEFT_PARAM, "purge");
      if (!left.has(DELETE_LEFT_PARAM)) return redirect("/admin/posts");
      left.set("deleted", params.slug);
      return redirect(`/admin/posts?${left}`);
    } catch (error) {
      const message =
        error instanceof EditorError || error instanceof GitHubError
          ? error.message
          : String(error);
      return {
        kind: "problem" as const,
        fields: undefined,
        problem: {
          message,
          conflict: error instanceof GitHubError && error.conflict,
          field: undefined,
          line: undefined,
        },
        headSha: await headAfterProblem(),
      };
    }
  }

  const result = await handleEditorAction(env, request, context.get(adminActorContext));
  if (result.kind === "saved") return redirect(savedRedirectPath(result));
  return result;
}

export default function EditPost({ loaderData, actionData }: Route.ComponentProps) {
  const problemData = actionData?.kind === "problem" ? actionData : null;
  const previewData = actionData?.kind === "preview" ? actionData : null;
  /*
   * An unconfirmed first publication re-renders around the submitted body: the confirming submit
   * posts this same form again, so it must carry what the author typed.
   */
  const confirmPublishData = actionData?.kind === "confirm-publish" ? actionData : null;
  const fields =
    problemData?.fields ?? previewData?.fields ?? confirmPublishData?.fields ?? loaderData.fields;
  const headSha =
    problemData?.headSha ??
    previewData?.headSha ??
    confirmPublishData?.headSha ??
    loaderData.headSha;

  const feedback =
    actionData?.kind === "problem"
      ? {
          state: "failed" as const,
          message: actionData.problem.message,
          conflict: Boolean(actionData.problem.conflict),
          field: actionData.problem.field,
          line: actionData.problem.line,
        }
      : actionData
        ? null
        : loaderData.saved;

  // A failed save's fields can disagree with the loader's; the transition must describe what is
  // committed, so it stays the loader's.
  const state = loaderData.state;

  const previewLinkSlot =
    state === "draft" ? (
      <PreviewLinks
        links={loaderData.previewLinks as PreviewLinkView[]}
        error={loaderData.previewLinksError}
        created={
          actionData?.kind === "preview-link"
            ? { url: actionData.url, expiresAt: actionData.expiresAt }
            : null
        }
      />
    ) : undefined;

  return (
    <>
      <PostEditor
        fields={fields}
        isNew={false}
        headSha={headSha}
        headError={headSha ? null : loaderData.headError}
        loadProblems={loaderData.loadProblems}
        previewHtml={actionData?.kind === "preview" ? actionData.previewHtml : null}
        feedback={feedback}
        state={state}
        everPublished={loaderData.everPublished}
        tagOptions={loaderData.tagOptions}
        linkTargets={loaderData.linkTargets}
        revisions={loaderData.revisions}
        awaitingPublishConfirmation={confirmPublishData !== null}
        previewLinkSlot={previewLinkSlot}
        historySlot={
          <>
            <p className="muted">
              Every save is a commit. Nothing is ever rewritten, and a restore
              lands as a new commit on top.
            </p>
            {loaderData.revisionsError ? (
              <p className="field-alarm">
                The version list could not be read, so no revisions are shown: {loaderData.revisionsError}
              </p>
            ) : null}
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
            {/* Associated by the `form` attribute: nested forms are invalid and the browser drops the inner one. */}
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

      {actionData?.kind === "confirm-delete" ? (
        <ConfirmDialog
          title={`Delete "${actionData.slug}"?`}
          body={
            <p>
              This removes the file and its rows. It is recoverable only through
              git.
            </p>
          }
          requireTyped="1"
          confirmLabel="Delete permanently"
          cancelHref={`/admin/posts/${actionData.slug}/edit`}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="headSha" value={headSha} />
        </ConfirmDialog>
      ) : null}

      {/* Submits no confirmation, so the action answers with the typed one above, script or not. */}
      <Form id="delete-post" method="post" className="editor-delete-form">
        <input type="hidden" name="headSha" value={headSha} />
      </Form>

      {/* Outside the editing form: the drawer is a `<dialog>` inside it, and a form inside a form is dropped. */}
      {state === "draft" ? (
        <>
          <Form id={CREATE_FORM_ID} method="post" className="editor-delete-form" />
          {loaderData.previewLinks.map((link) => (
            <Form
              key={link.token}
              id={revokeFormId(link.token)}
              method="post"
              className="editor-delete-form"
            >
              <input type="hidden" name="token" value={link.token} />
            </Form>
          ))}
        </>
      ) : null}
    </>
  );
}
