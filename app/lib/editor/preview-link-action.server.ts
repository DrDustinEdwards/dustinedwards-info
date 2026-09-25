import { postPath } from "~/lib/content/slug.mjs";
import { parsePost } from "~/lib/editor/frontmatter";
import { readFile } from "~/lib/editor/github.server";
import { errorMessage } from "~/lib/error-message.mjs";
import { createPreviewLink, revokePreviewLink } from "~/lib/preview-links.server";
import { previewUrl } from "~/lib/preview-token.mjs";

/**
 * The editor's preview-link sub-router: mint a link for a draft, or revoke one.
 *
 * `createdBy` is a thunk because the admin session is read only in the route's action (check:policy
 * holds it there), and only when a link is minted: a revoke never reads it.
 */
export async function previewLinkAction(
  env: Env,
  {
    intent,
    slug,
    origin,
    form,
    createdBy,
    headAfterProblem,
  }: {
    intent: "preview-link" | "revoke-preview-link";
    slug: string;
    origin: string;
    form: FormData;
    createdBy: () => string;
    headAfterProblem: () => Promise<string>;
  },
) {
  const problem = async (message: string) => ({
    kind: "problem" as const,
    /* These forms carry no body, so the editor keeps the loaded fields rather than an empty post. */
    fields: undefined,
    problem: { message, conflict: false, field: undefined, line: undefined },
    headSha: await headAfterProblem(),
  });

  if (intent === "preview-link") {
    /*
     * Server side, not just the UI: minting a capability must not trust the absence of a button.
     * The committed file is the authority, because the form is the author's unsaved draft.
     */
    const committed = await readFile(env, postPath(slug));
    if (!committed) return problem(`No post file exists for "${slug}".`);
    if (parsePost(committed.content).draft !== true) {
      return problem(
        "Preview links are only for drafts. This post is already public, so " +
          "its URL is the link.",
      );
    }

    try {
      const link = await createPreviewLink(env, {
        slug,
        createdBy: createdBy(),
      });
      return {
        kind: "preview-link" as const,
        url: previewUrl(origin, link.token),
        expiresAt: link.expiresAt,
      };
    } catch (error) {
      return problem(
        `The preview link could not be created: ${errorMessage(error)}`,
      );
    }
  }

  /* Revoke is not draft-gated: removing access must never be blocked by a stale page. */
  try {
    await revokePreviewLink(env, {
      slug,
      token: String(form.get("token") ?? ""),
    });
    return { kind: "preview-link-revoked" as const };
  } catch (error) {
    return problem(
      `The preview link could not be revoked: ${errorMessage(error)}`,
    );
  }
}
