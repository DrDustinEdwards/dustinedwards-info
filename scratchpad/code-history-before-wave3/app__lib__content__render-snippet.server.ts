import { renderBody } from "./pipeline.mjs";
/*
 * IMPORTED FOR ITS SIDE EFFECT, and it has to run before anything renders.
 * Workers refuse `WebAssembly.instantiate()` on raw bytes, which is what the
 * pipeline's Node default ends up doing, so the Worker installs an
 * instantiator closing over a statically imported module instead.
 */
import "./wasm.server";

/**
 * The playground's markdown demo, as one server-only call.
 *
 * ## WHY THIS MODULE EXISTS AT ALL, measured rather than designed
 *
 * The route did the obvious thing first: `import "~/lib/content/wasm.server"`
 * at the top of `app/routes/playground.tsx`, beside the pipeline import. The
 * build REFUSED it, in as many words:
 *
 *   Server-only module referenced by client. '~/lib/content/wasm.server'
 *   imported by route 'app/routes/playground.tsx'.
 *
 * The reason is worth writing down, because the same file imports
 * `search.server` at the top and has for months. React Router removes
 * server-only code by tracing which route exports USE an import: `search` is
 * referenced only inside `loader`, so the import goes with the loader. A BARE
 * SIDE-EFFECT IMPORT BINDS NO NAME, so there is nothing to trace, nothing to
 * attribute to `loader`, and the only safe conclusion the bundler can draw is
 * that the client needs it.
 *
 * So the side effect moves behind a named export, which is the same mechanism
 * that already worked, applied to the thing that could not use it. The route
 * imports `renderSnippet`, uses it only in its loader, and the whole chain
 * leaves the client build together.
 *
 * ## THE RESOLVER REFUSES, and that is this module's other job
 *
 * `renderBody` takes an image resolver. The playground's snippets cite no
 * media and none may: the alternative is a resolver reaching a bucket from a
 * public page on behalf of committed fixture text, which is a door this demo
 * has no reason to open. Refusing here rather than in the route means the
 * refusal cannot be forgotten by the next caller, and `check:features`
 * asserts the same thing about the snippets themselves so the failure names
 * the snippet rather than the render.
 *
 * @param slug the snippet's slug, used only to label a refusal
 * @param body the committed snippet source
 */
export async function renderSnippet(slug: string, body: string) {
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
