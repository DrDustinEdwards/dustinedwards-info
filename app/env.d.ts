/**
 * Secrets set with `wrangler secret put` are not part of wrangler.jsonc, so they do
 * not appear in the generated Env type. Declare them here. Values never reach the
 * client bundle: they are only read inside .server modules and loaders/actions.
 *
 * **THIS BLOCK IS NOW GATED.** `check:secrets` asserts, in both directions, that
 * every secret the ruling names is declared here and that everything declared
 * here is ratified. Adding a secret means editing this block, the SECRETS list
 * in `scripts/check-secrets.mjs`, and `dustinedwards/core.md`, in one commit.
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
    /**
     * Bearer token for the operator API. OPTIONAL, and that is the contract
     * rather than an oversight: `POST /api/operator` returns 503 when it is
     * absent or under 32 characters, because not configured means not open.
     *
     * Added 2026-08-09. It was the ONLY one of the seven missing from this
     * block, read by `operator/auth.server.ts` through a local widening, so the
     * shared type never carried it and nothing showed the set in one place.
     * That omission is the defect `check:secrets` was written for, and the gate
     * found it on its first run, before any plant.
     */
    OPERATOR_TOKEN?: string;
  }
}

/**
 * The Cloudflare Vite plugin resolves a `.wasm` import to an already-compiled
 * WebAssembly module. Declared as `unknown` because the Worker tsconfig does not
 * carry DOM's WebAssembly value declarations, and nothing here needs the shape.
 */
/** Vite resolves a `?url` import to the built asset's public path. */
declare module "*?url" {
  const url: string;
  export default url;
}

declare module "*.wasm" {
  const wasmModule: unknown;
  export default wasmModule;
}

export {};
