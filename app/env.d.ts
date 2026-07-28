/**
 * Secrets set with `wrangler secret put` are not part of wrangler.jsonc, so they do
 * not appear in the generated Env type. Declare them here. Values never reach the
 * client bundle: they are only read inside .server modules and loaders/actions.
 */
declare global {
  interface Env {
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    ADMIN_EMAIL: string;
    /** Fine-grained PAT, Contents read/write. Used only by the admin editor. */
    GITHUB_TOKEN: string;
  }
}

/**
 * The Cloudflare Vite plugin resolves a `.wasm` import to an already-compiled
 * WebAssembly module. Declared as `unknown` because the Worker tsconfig does not
 * carry DOM's WebAssembly value declarations, and nothing here needs the shape.
 */
declare module "*.wasm" {
  const wasmModule: unknown;
  export default wasmModule;
}

export {};
