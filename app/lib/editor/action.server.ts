import { EditorError, GitHubError, currentHead, savePost, validateAndRender } from "./publish.server";
import { fieldsFromForm, serializePost, type PostFields } from "./frontmatter";
import type { SaveOutcome } from "./publish-policy.mjs";

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
): Promise<EditorActionResult> {
  const form = await request.formData();
  const fields = fieldsFromForm(form);
  const intent = String(form.get("intent") ?? "save");
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
