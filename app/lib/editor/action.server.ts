import {
  EditorError,
  FirstPublishConfirmationRequired,
  GitHubError,
  currentHead,
  savePost,
  validateAndRender,
} from "./publish.server";
import { FrontmatterError, fieldsFromForm, serializePost, type PostFields } from "./frontmatter";
import type { Actor, SaveOutcome } from "./publish-policy.mjs";
import { readIntent } from "./intent.mjs";
import { DRAFT_BY_INTENT, PUBLISH_CONFIRMED_INTENT } from "./publish-transition.mjs";

type EditorActionResult =
  | { kind: "preview"; fields: PostFields; previewHtml: string; headSha: string }
  | { kind: "problem"; fields: PostFields; problem: { message: string; field?: string; line?: number; conflict?: boolean }; headSha: string }
  /** Carries the fields back so the author's unsaved body survives the confirmation round trip. */
  | { kind: "confirm-publish"; fields: PostFields; headSha: string }
  | {
      kind: "saved";
      slug: string;
      outcome: SaveOutcome;
      commitSha: string;
      firstPublished: string | null;
    };

export async function handleEditorAction(
  env: Env & { GITHUB_TOKEN?: string },
  request: Request,
  actor: Actor,
): Promise<EditorActionResult> {
  const form = await request.formData();
  const fields = fieldsFromForm(form);
  // An absent or unknown intent is refused, never defaulted: a default here would be a write.
  const rawIntent = readIntent(form);
  const isNew = form.get("isNew") === "1";
  const submittedHead = String(form.get("headSha") ?? "");

  const fail = async (message: string, extra: { field?: string; line?: number; conflict?: boolean } = {}) => {
    // Re-read head so a retry after a conflict is against current state. A failed re-read keeps the
    // submitted head and says so, because a retry against it may then report a conflict.
    let headSha = submittedHead;
    let note = "";
    try {
      headSha = await currentHead(env);
    } catch (error) {
      console.error("editor could not re-read the head after a failure", error);
      note =
        ` (The repository head could not be re-read: ` +
        `${error instanceof Error ? error.message : String(error)}. A retry may report a conflict.)`;
    }
    return { kind: "problem" as const, fields, problem: { message: message + note, ...extra }, headSha };
  };

  if (rawIntent === null) {
    return fail(
      "This form submitted no intent, so nothing was saved. Every control names " +
        "what it does; a request without one is malformed and is refused rather " +
        "than assumed to be a save.",
    );
  }
  const intent = rawIntent;

  if (intent !== "preview" && !(intent in DRAFT_BY_INTENT)) {
    return fail(
      `This form submitted an intent this editor does not recognize ("${intent}"), ` +
        "so nothing was saved. The intent names the transition, including whether " +
        "the post ends up public, and a request naming one that does not exist is " +
        "refused rather than run with a guess.",
    );
  }

  try {
    // Inside the try: a field that would reshape the frontmatter is refused as a problem on that field.
    const raw = serializePost(fields);
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
      // Only the confirmed intent answers yes, so a plain publish lands on the confirmation step.
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
    // submittedHead, not a re-read head: a commit that landed underneath is then reported as a
    // conflict instead of being silently rebased by the act of confirming.
    if (error instanceof FirstPublishConfirmationRequired) {
      return { kind: "confirm-publish", fields, headSha: submittedHead };
    }
    if (error instanceof EditorError) {
      return fail(error.message, { field: error.field, line: error.line });
    }
    if (error instanceof FrontmatterError) {
      return fail(error.message, { field: error.field });
    }
    if (error instanceof GitHubError) {
      return fail(error.message, { conflict: error.conflict });
    }
    // Not a recognized failure: logged with its stack, since the editor shows only the message.
    console.error("editor action failed with an unrecognized error", error);
    return fail(error instanceof Error ? error.message : String(error));
  }
}
