import { EditorError, GitHubError, currentHead, savePost, validateAndRender } from "./publish.server";
import { fieldsFromForm, serializePost, type PostFields } from "./frontmatter";
import type { Actor, SaveOutcome } from "./publish-policy.mjs";
import { readIntent } from "./intent.mjs";

/**
 * The shared save/preview handler behind both /admin/posts/new and the edit
 * route. Keeping one implementation means the gates cannot be enforced on one
 * path and skipped on the other.
 */
export type EditorActionResult =
  | { kind: "preview"; fields: PostFields; previewHtml: string; headSha: string }
  | { kind: "problem"; fields: PostFields; problem: { message: string; field?: string; line?: number; conflict?: boolean }; headSha: string }
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
   * which submits with no submitter. It now sends `intent=save` explicitly
   * through a hidden field it enables for one submit, so nothing legitimate
   * reaches this branch. Checked against every submit site before the default
   * was removed: the four save controls, the preview control and the delete
   * control all name their intent already.
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
    });
    return {
      kind: "saved",
      slug: fields.slug,
      outcome: saved.outcome,
      commitSha: saved.commitSha,
      firstPublished: saved.firstPublished,
    };
  } catch (error) {
    if (error instanceof EditorError) {
      return fail(error.message, { field: error.field, line: error.line });
    }
    if (error instanceof GitHubError) {
      return fail(error.message, { conflict: error.conflict });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}
