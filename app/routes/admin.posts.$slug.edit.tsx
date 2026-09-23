import { Form, Link, data, redirect } from "react-router";

import { timed, timingsContext } from "~/lib/timing";

import { PostEditor } from "~/components/admin/post-editor";
import {
  CREATE_FORM_ID,
  PreviewLinks,
  revokeFormId,
  type PreviewLinkView,
} from "~/components/admin/preview-links";
import { listBlogTags } from "~/db";
import { adminActorContext, adminSessionContext } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import { createPreviewLink, listPreviewLinks, revokePreviewLink } from "~/lib/preview-links.server";
import { previewUrl } from "~/lib/preview-token.mjs";
import { loadLinkTargets } from "~/lib/editor/link-targets.server";
import { handleEditorAction } from "~/lib/editor/action.server";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import { feedbackFromSearch, savedRedirectPath } from "~/lib/editor/feedback";
import { parsePost } from "~/lib/editor/frontmatter";
import { stateOf } from "~/lib/editor/publish-transition.mjs";
import { currentHead, deletePost, EditorError, GitHubError } from "~/lib/editor/publish.server";
import { postPath } from "~/lib/content/slug.mjs";
import { listCommitsForPath, readFile } from "~/lib/editor/github.server";
import type { Route } from "./+types/admin.posts.$slug.edit";

/*
 * THE MATH STYLESHEET, ALWAYS. A handle rather than a loader field, because the
 * flag every other reader uses is a property of what has been SAVED and an author
 * is typing something that has not been.
 */
export const handle = { math: true };

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Edit ${params.slug} · Admin` }, { name: "robots", content: "noindex" }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  /*
   * FIVE of this loader's awaits sit inside the RETURNED OBJECT LITERAL, which
   * evaluates its properties in order, so they run SERIALLY. The marks are added
   * WITHOUT reordering anything, so the measurement describes what shipped rather
   * than what a fix would produce.
   */
  const timings = context.get(timingsContext).timings;
  const env = getEnv(context);
  const file = await timed(timings, "gh_read_file", () => readFile(env, postPath(params.slug)));
  if (!file) throw data("Not found", { status: 404 });

  const fields = parsePost(file.content);
  // Hoisted out of the returned object because two properties now depend on it:
  // the transition table's state, and whether this post has preview links at all.
  const state = stateOf(fields, Date.now());
  const origin = new URL(request.url).origin;

  return {
    fields,
    headSha: await timed(timings, "gh_head", () => currentHead(env).catch(() => "")),
    slug: params.slug,
    // A save redirects back here carrying what it did. Read on the server, so
    // the message is in the first byte of HTML and needs no script to appear.
    saved: feedbackFromSearch(new URL(request.url).searchParams, params.slug),
    // Derived HERE because `stateOf` reads the clock, and a component that
    // recomputed it would render one word on the server and hydrate a different one for
    // a post scheduled seconds away.
    state,
    /**
     * THE EMPTY ARRAY IS A DECISION on a post that is not a draft: it stops the
     * section rendering at all, which is how "a published post offers NEITHER intent"
     * is held. Non-fatal: a KV outage costs the drawer a list, not the editor.
     */
    previewLinks:
      state === "draft"
        ? (
            await timed(timings, "kv_preview_links", () =>
              listPreviewLinks(env, params.slug).catch(() => []),
            )
          ).map((link) => ({
            ...link,
            // Built HERE because only a request knows the origin, and a link
            // that a reviewer cannot paste into a browser is not a link.
            url: previewUrl(origin, link.token),
          }))
        : [],
    // The one fact the transition table needs that current state cannot give: a draft
    // is either brand new or previously withdrawn, and only `first_published` in the
    // committed file tells them apart.
    everPublished: fields.firstPublished.trim() !== "",
    // Whatever is already in use on the site, so tagging tends toward the existing
    // vocabulary instead of inventing a near-duplicate.
    tagOptions: (
      await timed(timings, "d1_tags", () => listBlogTags(env).catch(() => []))
    ).map((tag) => tag.slug),
    // The site's own posts, for the body editor's Cmd+K link search.
    linkTargets: await timed(timings, "d1_link_targets", () => loadLinkTargets(env)),
    // LOADER work, deliberately: reading history is a read, so it adds no form and no
    // submission. Ruling 1's "restore loads, it does not write" holds by the SHAPE of
    // the routes rather than by anything this page promises. Non-fatal: a GitHub outage
    // must not blank the editor.
    revisions: await timed(timings, "gh_commits", () =>
      listCommitsForPath(env, postPath(params.slug)),
    ).catch(
      () => [],
    ),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const clone = request.clone();
  const form = await clone.formData();

  const intent = form.get("intent");

  /*
   * Handled here rather than in `handleEditorAction`, the SHARED save path: both
   * are edit-only, so putting them there would put two intents on the new-post route
   * that it can never legally use. Neither writes to GitHub, D1 or the artifact.
   */
  if (intent === "preview-link" || intent === "revoke-preview-link") {
    const problem = async (message: string) => ({
      kind: "problem" as const,
      fields: parsePost(String(form.get("body") ?? "")),
      // Stated rather than omitted so every problem this route can return has one
      // shape: an optional property on one arm is how the component's read stops
      // compiling.
      problem: { message, conflict: false, field: undefined, line: undefined },
      headSha: await currentHead(env).catch(() => ""),
    });

    if (intent === "preview-link") {
      /*
       * THE DRAFT CHECK IS SERVER SIDE, and it is not redundant with the UI: this is
       * reachable by anyone holding the admin session and a curl command, and minting a
       * capability must not trust the absence of a button. The COMMITTED FILE is the
       * authority, because the form is the author's unsaved draft.
       */
      const committed = await readFile(env, postPath(params.slug));
      if (!committed) return problem(`No post file exists for "${params.slug}".`);
      if (parsePost(committed.content).draft !== true) {
        return problem(
          "Preview links are only for drafts. This post is already public, so " +
            "its URL is the link.",
        );
      }

      try {
        const link = await createPreviewLink(env, {
          slug: params.slug,
          createdBy: context.get(adminSessionContext).user.email,
        });
        return {
          kind: "preview-link" as const,
          url: previewUrl(new URL(request.url).origin, link.token),
          expiresAt: link.expiresAt,
        };
      } catch (error) {
        return problem(
          `The preview link could not be created: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    /*
     * REVOKE IS NOT DRAFT-GATED. Creating mints something; taking one away is a
     * delete, idempotent, and refusing it would strand a row a concurrent publish had
     * already emptied. The one operation that must never be blocked by a stale page is
     * the one that removes access.
     */
    try {
      await revokePreviewLink(env, {
        slug: params.slug,
        token: String(form.get("token") ?? ""),
      });
      return { kind: "preview-link-revoked" as const };
    } catch (error) {
      return problem(
        `The preview link could not be revoked: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (intent === "delete") {
    /*
     * **THE CONFIRMATION IS CHECKED HERE, NOT IN THE FORM'S onSubmit.** With
     * scripting off the handler never ran and the file went with no confirmation at
     * all. `expectedHeadSha` is CONCURRENCY, NOT CONSENT: it stops a stale page
     * overwriting a newer one and says nothing about whether a human meant to delete.
     * One post, so the count is 1, and the predicate and field name are the bulk and
     * empty-trash paths' own: three spellings of one ceremony is how one of them ends
     * up unchecked. An unconfirmed delete renders a server-rendered second step.
     */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, 1)) {
      return { kind: "confirm-delete" as const, slug: params.slug };
    }
    try {
      await deletePost(env, {
        slug: params.slug,
        expectedHeadSha: String(form.get("headSha") ?? "") || null,
        actor: context.get(adminActorContext),
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
        problem: {
          message,
          conflict: error instanceof GitHubError && error.conflict,
          // Same one shape as the arm above. A delete is refused as a whole, so
          // neither of these is ever known here.
          field: undefined,
          line: undefined,
        },
        headSha: await currentHead(env).catch(() => ""),
      };
    }
  }

  const result = await handleEditorAction(env, request, context.get(adminActorContext));
  // Back to this page rather than the post list: a save that landed on the list had
  // nothing to say, which is how a first publication completed in silence.
  if (result.kind === "saved") return redirect(savedRedirectPath(result));
  return result;
}

export default function EditPost({ loaderData, actionData }: Route.ComponentProps) {
  /*
   * Narrowed by KIND rather than by `"fields" in actionData`: the `in` form
   * stopped narrowing once the action grew arms that carry no fields at all.
   */
  const problemData = actionData?.kind === "problem" ? actionData : null;
  const previewData = actionData?.kind === "preview" ? actionData : null;
  /*
   * An unconfirmed first publication is not a failure, but it re-renders the editor
   * around the author's submitted body: the confirming submit is this same form
   * posting again, so what it posts has to be what they typed.
   */
  const confirmPublishData = actionData?.kind === "confirm-publish" ? actionData : null;
  const fields =
    problemData?.fields ?? previewData?.fields ?? confirmPublishData?.fields ?? loaderData.fields;
  const headSha =
    problemData?.headSha ??
    previewData?.headSha ??
    confirmPublishData?.headSha ??
    loaderData.headSha;

  // Persistent until the NEXT action: a failure replaces the message and a preview
  // clears it, because by then the URL is describing a save two steps ago.
  const feedback =
    actionData?.kind === "problem"
      ? {
          state: "failed" as const,
          message: actionData.problem.message,
          conflict: Boolean(actionData.problem.conflict),
          // The two the action has always carried and this route used to drop.
          field: actionData.problem.field,
          line: actionData.problem.line,
        }
      : actionData
        ? null
        : loaderData.saved;

  // A failed save hands back the fields the author submitted, and those can
  // disagree with the loader's. The transition must describe what is COMMITTED, so it
  // stays the loader's.
  const state = loaderData.state;

  /*
   * THE SECTION EXISTS ONLY FOR A DRAFT, and `undefined` is how that is said: the
   * ruling held structurally rather than by a disabled button, which sends nothing
   * but still looks like an offer. The state is the LOADER'S, so an unsaved edit
   * cannot conjure the section.
   */
  const previewLinkSlot =
    state === "draft" ? (
      <PreviewLinks
        links={loaderData.previewLinks as PreviewLinkView[]}
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
             * Associated by the `form` attribute rather than by containment: nested forms
             * are not valid HTML and the browser drops the inner one.
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

      {/*
       * THE SERVER-RENDERED CONFIRMATION STEP, reached when the action refused an
       * unconfirmed delete. That is the no-script path, and it is an ordinary form so no
       * script participates in satisfying it either.
       */}
      {actionData?.kind === "confirm-delete" ? (
        <form method="post" className="editor-confirm-delete">
          <h2>Delete "{actionData.slug}"?</h2>
          <p>
            This removes the file and its rows. It is recoverable only through
            git.
          </p>
          <input type="hidden" name="headSha" value={headSha} />
          <label>
            <span>
              Type <strong>1</strong> to confirm
            </span>
            <input name={CONFIRM_FIELD} autoComplete="off" inputMode="numeric" />
          </label>
          <div className="editor-confirm-actions">
            <Link to={`/admin/posts/${actionData.slug}/edit`} className="btn-ghost">
              Cancel
            </Link>
            <button type="submit" name="intent" value="delete" className="btn-danger">
              Delete permanently
            </button>
          </div>
        </form>
      ) : null}

      <Form
        id="delete-post"
        method="post"
        className="editor-delete-form"
        onSubmit={(event) => {
          /*
           * EARLIER FEEDBACK, NOT THE GATE. The action checks the same thing server-side,
           * because this handler does not run for a reader without JavaScript and the delete
           * did.
           */
          if (!confirm(`Delete "${loaderData.slug}"? This removes the file and its rows.`)) {
            event.preventDefault();
            return;
          }
          const field = event.currentTarget.elements.namedItem(CONFIRM_FIELD);
          if (field instanceof HTMLInputElement) field.value = "1";
        }}
      >
        <input type="hidden" name="headSha" value={headSha} />
        {/* Empty with scripting off, which is what makes the action refuse and
            render the confirmation step instead of deleting. */}
        <input type="hidden" name={CONFIRM_FIELD} defaultValue="" />
      </Form>

      {/*
       * Outside the editing form because the drawer is a `<dialog>` nested inside it
       * and a form inside a form is dropped.
       *
       * ONE REVOKE FORM PER LINK, each carrying its own token as a hidden field: a
       * `name="token"` on every button would put the token into the submission tuple, so
       * the fixture would describe the data rather than the request surface.
       */}
      {state === "draft" ? (
        <>
          {/* No fields at all: the button carries the intent, and the slug is
              already in the URL this posts to. */}
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
