import {
  EditorError,
  FirstPublishConfirmationRequired,
  GitHubError,
  currentHead,
  savePost,
  validateAndRender,
} from "./publish.server";
import { fieldsFromForm, serializePost, type PostFields } from "./frontmatter";
import type { Actor, SaveOutcome } from "./publish-policy.mjs";
import { readIntent } from "./intent.mjs";
import { DRAFT_BY_INTENT, PUBLISH_CONFIRMED_INTENT } from "./publish-transition.mjs";

/**
 * The shared save/preview handler behind both /admin/posts/new and the edit
 * route. Keeping one implementation means the gates cannot be enforced on one
 * path and skipped on the other.
 */
export type EditorActionResult =
  | { kind: "preview"; fields: PostFields; previewHtml: string; headSha: string }
  | { kind: "problem"; fields: PostFields; problem: { message: string; field?: string; line?: number; conflict?: boolean }; headSha: string }
  /**
   * A first publication, stopped one step short so a human can answer for it.
   *
   * Carries the fields BACK because the second step re-renders the editor
   * around them: the author's unsaved body has to survive the round trip, and
   * the confirming submit is the same form posting the same payload again with
   * the confirmed intent. Nothing has been written when this is returned.
   */
  | { kind: "confirm-publish"; fields: PostFields; headSha: string }
  | {
      kind: "saved";
      slug: string;
      /** What the save did to the post's public status. */
      outcome: SaveOutcome;
      commitSha: string;
      /** The date the post first went public, present once it ever has. */
      firstPublished: string | null;
    };

export async function handleEditorAction(
  env: Env & { GITHUB_TOKEN?: string },
  request: Request,
  /*
   * WHO IS SAVING. Threaded through rather than defaulted, since `savePost`
   * stopped defaulting it: the two callers are admin routes that already hold
   * the actor on their request context, so passing it is one argument and
   * inventing it here would be this module guessing at an identity it was
   * handed.
   */
  actor: Actor,
): Promise<EditorActionResult> {
  const form = await request.formData();
  const fields = fieldsFromForm(form);
  /**
   * NO DEFAULT. An absent intent is REFUSED, not treated as a save.
   *
   * This was `String(form.get("intent") ?? "save")`, so a malformed POST that
   * carried no intent PERFORMED A WRITE: a commit to GitHub and a D1 sync,
   * from a request that never said what it wanted. Hard rule 13, on the worst
   * possible surface for it, since the substituted value was an action rather
   * than a label.
   *
   * The only caller that ever relied on the default was the editor's Cmd+S,
   * which submits with no submitter. It sends its intent explicitly through a
   * hidden field it enables for one submit, so nothing legitimate reaches this
   * branch. Checked against every submit site before the default was removed:
   * the four save controls, the preview control and the delete control all name
   * their intent already.
   *
   * SINCE 2026-09-03 THE INTENT ALSO CARRIES THE DRAFT FLAG, so an intent this
   * module does not recognise is refused below rather than run as a save. It
   * used to fall through to one, which was survivable while `draft` was its own
   * field and is not now: an unknown intent would be a write whose publication
   * state came from a fallback.
   *
   * The read lives in `intent.mjs` so the rule is testable; this file cannot be
   * imported by `node:test`. Covered in `test/editor-intent.test.mjs`.
   */
  const rawIntent = readIntent(form);
  const isNew = form.get("isNew") === "1";
  const submittedHead = String(form.get("headSha") ?? "");
  const raw = serializePost(fields);

  const fail = async (message: string, extra: { field?: string; line?: number; conflict?: boolean } = {}) => ({
    kind: "problem" as const,
    fields,
    problem: { message, ...extra },
    // Re-read head so a retry after a conflict is against current state.
    headSha: await currentHead(env).catch(() => submittedHead),
  });

  // Refused BEFORE the try, so it cannot be mistaken for a save that failed.
  // `fail()` returns a problem result rather than throwing: it writes nothing,
  // names the reason, and keeps the body the author typed.
  if (rawIntent === null) {
    return fail(
      "This form submitted no intent, so nothing was saved. Every control names " +
        "what it does; a request without one is malformed and is refused rather " +
        "than assumed to be a save.",
    );
  }
  const intent = rawIntent;

  /*
   * THE ALLOWLIST, and it is derived rather than written out.
   *
   * `DRAFT_BY_INTENT` is built from the transition table itself, so the set of
   * intents that may write is exactly the set of transitions the buttons can
   * send, and a transition added to the table is permitted here without anybody
   * remembering to widen a literal. `preview` is the one write-free intent and
   * is named separately because it is not a transition.
   *
   * Refused BEFORE the try for the same reason the absent intent is: an
   * unrecognised intent is a malformed request, not a save that failed.
   */
  if (intent !== "preview" && !(intent in DRAFT_BY_INTENT)) {
    return fail(
      `This form submitted an intent this editor does not recognise ("${intent}"), ` +
        "so nothing was saved. The intent names the transition, including whether " +
        "the post ends up public, and a request naming one that does not exist is " +
        "refused rather than run with a guess.",
    );
  }

  try {
    if (intent === "preview") {
      const record = await validateAndRender(env, fields.slug, raw);
      return { kind: "preview", fields, previewHtml: record.html, headSha: submittedHead };
    }

    const saved = await savePost(env, {
      slug: fields.slug,
      raw,
      expectedHeadSha: submittedHead || null,
      isNew,
      actor,
      /*
       * THE EDITOR OPTS INTO THE CEREMONY, always, with a real boolean.
       *
       * Every save from this module answers the question, so a first
       * publication reached from the editor can never skip it. The confirmed
       * intent is the ONLY thing that answers yes: it is sent by the ceremony's
       * own submits and by the server-rendered second step, and by nothing
       * else, which is what makes a plain `publish` land on the confirmation
       * rather than on the commit.
       */
      firstPublishConfirmed: intent === PUBLISH_CONFIRMED_INTENT,
    });
    return {
      kind: "saved",
      slug: fields.slug,
      outcome: saved.outcome,
      commitSha: saved.commitSha,
      firstPublished: saved.firstPublished,
    };
  } catch (error) {
    /*
     * NOT A FAILURE, so it is caught before the failure arms and returns its
     * own kind. `submittedHead` is kept rather than re-read: the confirming
     * submit must be against the base the author started from, so a commit that
     * landed underneath them is reported as the conflict it is instead of being
     * silently rebased by the act of confirming.
     */
    if (error instanceof FirstPublishConfirmationRequired) {
      return { kind: "confirm-publish", fields, headSha: submittedHead };
    }
    if (error instanceof EditorError) {
      return fail(error.message, { field: error.field, line: error.line });
    }
    if (error instanceof GitHubError) {
      return fail(error.message, { conflict: error.conflict });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}
