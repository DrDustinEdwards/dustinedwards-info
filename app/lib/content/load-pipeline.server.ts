// Never import pipeline.mjs statically from app or worker code: it drags shiki, katex, Plot and
// linkedom into every cold isolate (4.4 MB chunk, measured), and nothing checks for it.
let pipeline: Promise<typeof import("./pipeline.mjs")> | undefined;

export function loadPipeline(): Promise<typeof import("./pipeline.mjs")> {
  // A failed load is not cached, so one bad fetch is not every later save's error.
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
