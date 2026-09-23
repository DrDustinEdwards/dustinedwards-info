/**
 * THE RENDERER, LOADED ON FIRST USE.
 *
 * `pipeline.mjs` imports shiki, katex, Observable Plot and linkedom at its top level. A static import
 * of it from any Worker module put all of that in the chunk every cold isolate evaluates before it
 * can answer, and most isolates only ever serve a page that the platform cache is about to store:
 * none of them renders markdown. Measured 2026-09-23 on production, an edge-cache miss answered in
 * 0.1 to 0.17 s or in 0.46 to 0.78 s even on `/about`, which does no I/O, and the static server
 * chunk was 4.4 MB with the pipeline making up most of it.
 *
 * So every Worker-side caller reaches the pipeline through this function, and the WASM loader is
 * installed on the same path, because it has to be in place before the first highlight and has no
 * other reason to load. The build scripts import `pipeline.mjs` directly and are unaffected.
 *
 * `check:invariants` holds the property: no app or worker module imports the pipeline statically.
 */
let pipeline: Promise<typeof import("./pipeline.mjs")> | undefined;

export function loadPipeline(): Promise<typeof import("./pipeline.mjs")> {
  // A failed load is forgotten rather than cached, so one bad fetch is not every later save's error.
  pipeline ??= Promise.all([import("./wasm.server"), import("./pipeline.mjs")])
    .then(([{ instantiate }, loaded]) => {
      loaded.setWasmLoader(() => instantiate);
      return loaded;
    })
    .catch((error) => {
      pipeline = undefined;
      throw error;
    });
  return pipeline;
}
