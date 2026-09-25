import { getEnv } from "~/lib/context";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { normalizeBody } from "~/lib/editor/frontmatter";
import { EditorError, makeResolveImage } from "~/lib/editor/publish.server";
import { postPath } from "~/lib/content/slug.mjs";
import type { Route } from "./+types/admin.preview";

/**
 * Returns what `renderBody` gives back, unmodified, so the preview is what publishes. Read only
 * although it is a POST: no database, no file, no commit, and R2 only to measure referenced images.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = getEnv(context);
  const form = await request.formData();
  // The same transform the save path applies: a multipart body arrives with every newline as CRLF.
  const body = normalizeBody(String(form.get("body") ?? ""));
  const slug = String(form.get("slug") ?? "").trim() || "preview";
  const { ContentError, renderBody } = await loadPipeline();

  try {
    const { html, toc } = await renderBody({
      file: postPath(slug),
      body,
      resolveImage: makeResolveImage(env),
    });
    return Response.json({ html, headings: toc.length });
  } catch (error) {
    // A 200 carrying the pipeline's message: a half-typed directive is ordinary, and a non-2xx would
    // make the client treat a typo as a broken endpoint and stop previewing.
    if (error instanceof ContentError || error instanceof EditorError) {
      return Response.json({ error: error.message });
    }
    // Anything else is this endpoint failing, not the author's markdown: logged, and a 500.
    console.error("admin preview render failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `The preview failed: ${message}` }, { status: 500 });
  }
}
