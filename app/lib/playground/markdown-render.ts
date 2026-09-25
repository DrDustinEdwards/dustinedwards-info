import playgroundData from "../../../content/playground.json";
/*
 * Behind a named server export: React Router's server-code removal traces names, so a bare
 * side-effect import failed the build.
 */
import { renderSnippet } from "~/lib/content/render-snippet.server";
import { errorMessage } from "~/lib/error-message.mjs";

const SNIPPETS = playgroundData.markdownSnippets;

/**
 * An enum, not a text box: the highlighter runs a WebAssembly regex engine that needs its own threat
 * model before it takes public input.
 */
const SNIPPET_SLUGS = SNIPPETS.map((s) => s.slug);

/** The markdown demo's share of the playground loader: a committed snippet through the article renderer. */
export async function markdownRenderDemo(params: URLSearchParams) {
  const mdParam = params.get("md");
  const snippetSlug =
    mdParam && SNIPPET_SLUGS.includes(mdParam) ? mdParam : SNIPPET_SLUGS[0];
  const snippetError =
    mdParam && mdParam !== snippetSlug
      ? `Unknown snippet "${mdParam}", showing ${snippetSlug}.`
      : "";

  const snippet = SNIPPETS.find((s) => s.slug === snippetSlug);
  let markdown = null;
  let markdownRefusal: string | null = null;
  if (snippet) {
    try {
      const rendered = await renderSnippet(snippet.slug, snippet.source);
      markdown = {
        slug: snippet.slug,
        source: snippet.source,
        html: rendered.html,
        toc: rendered.toc,
        blockedUrls: rendered.blockedUrls,
      };
    } catch (error) {
      markdownRefusal = errorMessage(error);
    }
  }

  return {
    markdown,
    markdownRefusal,
    snippetError,
    snippetSlug,
    snippetNote: snippet?.note ?? "",
  };
}
