// Resolved by the ambient `declare module "*.wasm"` in app/env.d.ts, which is
// part of the Worker project only. The Cloudflare Vite plugin emits this into
// the server build as an already-compiled WebAssembly module.
import onigModule from "shiki/onig.wasm";

/**
 * How the shared pipeline loads oniguruma inside a Worker. `loadPipeline()` hands it to the
 * pipeline before anything renders. It does not import the pipeline itself, so the pipeline has
 * exactly one importer on the Worker side and the dynamic import there actually splits.
 *
 * Workers refuse `WebAssembly.instantiate()` on raw bytes, which is what `import("shiki/wasm")` ends
 * up doing, so the Node default cannot be used here. A module imported STATICALLY is already
 * compiled, and instantiating one of those is allowed.
 *
 * Typed loosely on purpose: the Worker tsconfig does not carry DOM's WebAssembly value
 * declarations.
 */
const wasm = (globalThis as typeof globalThis & {
  WebAssembly: { instantiate: (m: unknown, i: unknown) => Promise<unknown> };
}).WebAssembly;

export const instantiate = (imports: unknown) => wasm.instantiate(onigModule, imports);

