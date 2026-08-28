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
import { postPath } from "~/lib/content/pipeline.mjs";
import { listCommitsForPath, readFile } from "~/lib/editor/github.server";
import type { Route } from "./+types/admin.posts.$slug.edit";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Edit ${params.slug} · Admin` }, { name: "robots", content: "noindex" }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  /*
   * INSTRUMENTED 2026-08-22, and this loader has the shape the admin layout was
   * already fixed for: FIVE of its awaits sit inside the RETURNED OBJECT
   * LITERAL, which evaluates its properties in order, so they run SERIALLY.
   * Most of them are GitHub API calls. The marks below are deliberately added
   * WITHOUT reordering anything, so the measurement describes what shipped
   * rather than what a fix would produce.
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
    // Derived HERE rather than in the component, for the same reason the posts
    // index derives its pill in its loader: `stateOf` reads the clock, and a
    // component that recomputed it would render one word on the server and
    // hydrate a different one for a post scheduled seconds away.
    state,
    /**
     * Live preview links, and the EMPTY ARRAY IS A DECISION on a post that is
     * not a draft.
     *
     * A published post has none: the publish path revoked them. A scheduled post
     * is `draft: false` too, so it also has none, and this does not ask. What
     * the empty array then does is stop the section rendering at all, which is
     * how "a published post offers NEITHER intent" is held.
     *
     * Non-fatal: a KV outage costs the drawer a list, not the editor. The same
     * stance the revision list takes, and for the same reason.
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
    // The one fact the transition table needs that current state cannot give:
    // a draft is either brand new or previously withdrawn, and only
    // `first_published` in the committed file tells them apart. It is the same
    // fact publish-policy.mjs gates the operator's first publication on.
    everPublished: fields.firstPublished.trim() !== "",
    // Autocomplete for the tag field. Whatever is already in use on the site,
    // so tagging tends toward the existing vocabulary instead of inventing a
    // near-duplicate of a tag that already exists.
    tagOptions: (
      await timed(timings, "d1_tags", () => listBlogTags(env).catch(() => []))
    ).map((tag) => tag.slug),
    // The site's own posts, for the body editor's Cmd+K link search.
    linkTargets: await timed(timings, "d1_link_targets", () => loadLinkTargets(env)),
    // Commits touching this post, for the drawer's revision list. LOADER work,
    // deliberately: reading history is a read, so it belongs in the loader and
    // adds no form and no submission to this page. Diffs and revision contents
    // are fetched on demand from the revisions resource route, which exports no
    // action, so ruling 1's "restore loads, it does not write" holds by the
    // shape of the routes rather than by anything this page promises.
    //
    // Non-fatal: a GitHub outage must not blank the editor. The drawer simply
    // reports no commits, and writing still works because the save path fails
    // loudly on its own.
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
   * THE TWO PREVIEW-LINK INTENTS, handled here rather than in
   * `handleEditorAction`.
   *
   * That module is the SHARED save path behind this route and /admin/posts/new,
   * and both of these are edit-only: a post that does not exist yet cannot be
   * previewed. Putting them there would put two intents on the new-post route
   * that the new-post route can never legally use. Delete is here for the same
   * reason and by the same argument.
   *
   * Neither of them writes to GitHub, D1 or the artifact. They are KV only.
   */
  if (intent === "preview-link" || intent === "revoke-preview-link") {
    const problem = async (message: string) => ({
      kind: "problem" as const,
      fields: parsePost(String(form.get("body") ?? "")),
      // `conflict` is stated rather than omitted so every problem this route can
      // return has one shape. An optional property on one arm of the union is
      // how the component's `actionData.problem.conflict` read stops compiling.
      problem: { message, conflict: false },
      headSha: await currentHead(env).catch(() => ""),
    });

    if (intent === "preview-link") {
      /*
       * THE DRAFT CHECK IS SERVER SIDE, and it is not redundant with the UI.
       *
       * The drawer does not render the control on a published post, so nothing
       * on the page can send this. That is a statement about the page, and this
       * is an action: it is reachable by anyone holding the admin session and a
       * curl command. Minting a capability is exactly the operation that must
       * not trust the absence of a button.
       *
       * The COMMITTED FILE is the authority, re-read here rather than taken from
       * the submitted form, because the form is the author's unsaved draft of
       * what the post should become and this question is about what it IS.
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
     * REVOKE IS NOT DRAFT-GATED, and the asymmetry is deliberate.
     *
     * Creating on a published post is refused because it mints something. Taking
     * one away is a delete: it can only ever reduce what exists, it is
     * idempotent, and refusing it would strand a row in a drawer that a
     * concurrent publish had already emptied. The one operation that must never
     * be blocked by a stale page is the one that removes access.
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
     * **THE CONFIRMATION IS CHECKED HERE, NOT IN THE FORM'S onSubmit.**
     *
     * It was a `confirm()` in an `onSubmit` handler. With scripting off the
     * handler never ran, the form posted, and the file and its rows went with
     * no confirmation at all. `expectedHeadSha` below is CONCURRENCY, not
     * consent: it stops a stale page overwriting a newer one, and says nothing
     * about whether a human meant to delete anything.
     *
     * One post, so the count is 1. Same predicate and same field name as the
     * bulk and empty-trash paths, because three spellings of one ceremony is
     * how one of them ends up unchecked.
     *
     * An unconfirmed delete is the CONFIRMATION STEP, not an error: the route
     * renders a server-rendered second step from this, so a reader without
     * script gets a confirmation rather than a refusal they cannot satisfy.
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
        problem: { message, conflict: error instanceof GitHubError && error.conflict },
        headSha: await currentHead(env).catch(() => ""),
      };
    }
  }

  const result = await handleEditorAction(env, request, context.get(adminActorContext));
  // Back to this page rather than the post list. A save used to land on the
  // list with nothing to say, which is how a first publication completed in
  // silence: the one act reserved to the human looked like nothing had
  // happened at all.
  if (result.kind === "saved") return redirect(savedRedirectPath(result));
  return result;
}

export default function EditPost({ loaderData, actionData }: Route.ComponentProps) {
  /*
   * Narrowed by KIND rather than by `"fields" in actionData`.
   *
   * The `in` form stopped narrowing once this route's action grew arms that
   * carry no fields at all: TypeScript widened the result to `PostFields |
   * undefined` and the editor's required prop went red. Naming the two arms that
   * DO carry them is the same behaviour and says which they are.
   */
  const problemData = actionData?.kind === "problem" ? actionData : null;
  const previewData = actionData?.kind === "preview" ? actionData : null;
  const fields = problemData?.fields ?? previewData?.fields ?? loaderData.fields;
  const headSha = problemData?.headSha ?? previewData?.headSha ?? loaderData.headSha;

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

  /*
   * THE SECTION EXISTS ONLY FOR A DRAFT, and `undefined` is how that is said.
   *
   * The drawer renders the section when it is handed a node and renders nothing
   * when it is not, so on a published post there is no create control and no
   * revoke control anywhere in the markup. That is the ruling held structurally
   * rather than by a disabled button, which sends nothing but still looks like
   * an offer.
   *
   * The state is the LOADER'S, so an unsaved edit toggling the draft checkbox
   * does not conjure the section: what a preview link previews is the committed
   * file, and offering one against unsaved intent would promise the reviewer
   * something they would not see.
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

      {/*
        THE SERVER-RENDERED CONFIRMATION STEP, reached when the action refused
        an unconfirmed delete. That is the no-script path: the onSubmit handler
        never ran, the field arrived empty, and nothing was deleted. An ordinary
        form, so no script participates in satisfying it either.
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
           * EARLIER FEEDBACK, NOT THE GATE. The action checks the same thing
           * server-side, because this handler does not run for a reader without
           * JavaScript and the delete did. On accept it fills the field the
           * server reads, so a scripted operator is asked once rather than
           * twice.
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
        THE PREVIEW-LINK FORMS, outside the editing form for the same reason the
        delete form is: the drawer that holds their buttons is a <dialog> nested
        inside it, and a form inside a form is dropped by the browser.

        They render only for a draft, so a published post has no form to submit
        to either. `previewLinkSlot` is the same condition, so the buttons and
        the forms they point at cannot exist without each other.

        ONE REVOKE FORM PER LINK, each carrying its own token as a hidden field.
        The alternative, one form and a `name="token"` on every button, works
        identically for a browser and worse for the gate: it would put the token
        into the submission tuple, so a post with two links would record a
        different payload set from a post with one, and the fixture would be
        describing the data rather than the request surface.
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
