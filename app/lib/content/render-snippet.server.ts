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
 * **WHY A NAMED EXPORT.** React Router removes server-only code by tracing which route exports USE an
 * import, so `search.server` referenced only inside `loader` goes with the loader. A BARE
 * SIDE-EFFECT IMPORT BINDS NO NAME: there is nothing to trace, nothing to attribute to `loader`, and
 * the only safe conclusion the bundler can draw is that the client needs it. The build refuses it in
 * as many words. So the side effect moves behind a named export the route uses only in its loader.
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
