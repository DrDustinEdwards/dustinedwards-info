import { loadPipeline } from "./load-pipeline.server";

/**
 * Refuses every image on purpose: a resolver here would let committed fixture text reach the bucket
 * from a public page. Keep this a named export so React Router strips it with the loader.
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
