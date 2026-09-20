import { renderBody } from "~/lib/content/pipeline.mjs";
import { getEnv } from "~/lib/context";
import { ContentError } from "~/lib/content/pipeline.mjs";
import { normalizeBody } from "~/lib/editor/frontmatter";
import { EditorError, makeResolveImage } from "~/lib/editor/publish.server";
import { postPath } from "~/lib/content/pipeline.mjs";
import type { Route } from "./+types/admin.preview";

/**
 * The exact preview.
 *
 * It renders a submitted body through `app/lib/content/pipeline.mjs`, the same module the build
 * script and the Worker import. There is ONE renderer on this site and this route does not become a
 * second one: it returns what `renderBody` gives back, unmodified, so the preview IS what publishes.
 *
 * READ ONLY, worth being precise about because it is a POST: it touches no database, writes no file,
 * commits nothing, and reaches R2 only to MEASURE images the body already references.
 *
 * It sits under `/admin`, so the layout middleware has already required the single-admin session.
 * There is no unauthenticated way to make the Worker render arbitrary markdown.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = getEnv(context);
  const form = await request.formData();
  // THE SAME transform the save path applies, from the same module, so the two cannot drift again. A
  // multipart body arrives with every newline normalized to CRLF, and rendering that raw is what made
  // the preview differ from the published artifact.
  const body = normalizeBody(String(form.get("body") ?? ""));
  // Only used to label errors, exactly as the save path labels them, so a
  // failing directive reports the same file name it would report on save.
  const slug = String(form.get("slug") ?? "").trim() || "preview";

  try {
    const { html, toc } = await renderBody({
      file: postPath(slug),
      body,
      resolveImage: makeResolveImage(env),
    });
    return Response.json({ html, headings: toc.length });
  } catch (error) {
    // A preview failure is ordinary: the author is mid-sentence and the directive is half typed. It
    // reports the pipeline's own message and a 200, because the REQUEST succeeded and it is the content
    // that is not ready. A non-2xx would make the client treat a routine typo as a broken endpoint and
    // stop previewing.
    const message =
      error instanceof ContentError || error instanceof EditorError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return Response.json({ error: message });
  }
}
