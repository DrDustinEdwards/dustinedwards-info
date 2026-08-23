// Resolved by the ambient `declare module "*.wasm"` in app/env.d.ts, which is
// part of the Worker project only. The Cloudflare Vite plugin emits this into
// the server build as an already-compiled WebAssembly module.
import onigModule from "shiki/onig.wasm";

import { setWasmLoader } from "./pipeline.mjs";

/**
 * Teaches the shared pipeline how to load oniguruma inside a Worker.
 *
 * Workers refuse `WebAssembly.instantiate()` on raw bytes ("Wasm code
 * generation disallowed by embedder"), which is what `import("shiki/wasm")`
 * ends up doing, so the Node default cannot be used here. A module imported
 * statically is already compiled, and instantiating one of those is allowed.
 *
 * Import this module for its side effect, before anything renders.
 *
 * Typed loosely on purpose: the Cloudflare Vite plugin resolves the `.wasm`
 * import to a `WebAssembly.Module` at build time, and the Worker tsconfig does
 * not carry DOM's WebAssembly value declarations.
 */
const wasm = (globalThis as unknown as {
  WebAssembly: { instantiate: (m: unknown, i: unknown) => Promise<unknown> };
}).WebAssembly;

const instantiate = (imports: unknown) => wasm.instantiate(onigModule, imports);

setWasmLoader(() => instantiate);

