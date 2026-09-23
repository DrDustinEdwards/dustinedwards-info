import { loadPipeline } from "./load-pipeline.server";

/**
 * The playground's markdown demo, as one server-only call.
 *
 * **WHY A NAMED EXPORT.** React Router removes server-only code by tracing which route exports USE an
 * import, so this module referenced only inside `loader` goes with the loader. The WASM loader the
 * render needs is installed by `loadPipeline`, on first use.
 *
 * **THE RESOLVER REFUSES, and that is this module's other job.** The playground's snippets cite no
 * media and none may: the alternative is a resolver reaching a bucket from a public page on behalf
 * of committed fixture text. Refusing here rather than in the route means the refusal cannot be
 * forgotten by the next caller, and `check:features` asserts the same thing about the snippets so
 * the failure names the snippet rather than the render.
 *
 * @param slug the snippet's slug, used only to label a refusal
 * @param body the committed snippet source
 */
export async function renderSnippet(slug: string, body: string) {
  const { renderBody } = await loadPipeline();
  return renderBody({
    file: `playground/${slug}.md`,
    body,
    resolveImage: async (src: string) => {
      throw new Error(
        `the playground's markdown demo cites no media, and this snippet cites ${src}`,
      );
    },
  });
}
