import { renderBody } from "~/lib/content/pipeline.mjs";
import { getEnv } from "~/lib/context";
import { ContentError } from "~/lib/content/pipeline.mjs";
import { EditorError, makeResolveImage } from "~/lib/editor/publish.server";
import type { Route } from "./+types/admin.preview";

/**
 * The exact preview, per ruling 3.
 *
 * It renders a submitted body through `app/lib/content/pipeline.mjs`, the same
 * module the build script and the Worker import. There is one renderer on this
 * site and this route does not become a second one: it calls `renderBody` and
 * returns what comes back, unmodified. The preview is what publishes rather
 * than an approximation of it, which is the only reason a preview is worth
 * having on a site whose artifact is byte-compared by a gate.
 *
 * READ ONLY, and that is worth being precise about because it is a POST. It
 * takes markdown in and hands HTML back. It touches no database, writes no
 * file, commits nothing, and reaches R2 only to MEASURE images the body already
 * references. The redesign ruling names this case: a read-only render route is
 * not a new write path.
 *
 * It sits under `/admin`, so the layout middleware has already required the
 * single-admin session before this runs. There is no unauthenticated way to
 * make the Worker render arbitrary markdown.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = getEnv(context);
  const form = await request.formData();
  const body = String(form.get("body") ?? "");
  // Only used to label errors, exactly as the save path labels them, so a
  // failing directive reports the same file name it would report on save.
  const slug = String(form.get("slug") ?? "").trim() || "preview";

  try {
    const { html, toc } = await renderBody({
      file: `content/posts/${slug}.md`,
      body,
      resolveImage: makeResolveImage(env),
    });
    return Response.json({ html, headings: toc.length });
  } catch (error) {
    // A preview failure is ordinary: the author is mid-sentence and the
    // directive is half typed. It reports the pipeline's own message and a 200,
    // because the REQUEST succeeded; it is the content that is not ready. A
    // non-2xx here would make the client treat a routine typo as a broken
    // endpoint and stop previewing.
    const message =
      error instanceof ContentError || error instanceof EditorError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return Response.json({ error: message });
  }
}
