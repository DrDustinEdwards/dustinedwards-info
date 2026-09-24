import onigModule from "shiki/onig.wasm";

/**
 * Workers refuse WebAssembly.instantiate() on raw bytes, which is what import("shiki/wasm") does;
 * a statically imported .wasm is already compiled and may be instantiated. Must not import the
 * pipeline itself, or the dynamic import in loadPipeline stops splitting.
 */
const wasm = (globalThis as typeof globalThis & {
  WebAssembly: { instantiate: (m: unknown, i: unknown) => Promise<unknown> };
}).WebAssembly;

export const instantiate = (imports: unknown) => wasm.instantiate(onigModule, imports);

