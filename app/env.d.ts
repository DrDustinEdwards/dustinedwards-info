/**
 * Secrets set with `wrangler secret put` are not in the generated Env type, so they are declared here.
 * `check:secrets` asserts this list matches its own in both directions: add a secret to both.
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
    /** Optional by contract: `POST /api/operator` returns 503 when it is absent or too short. */
    OPERATOR_TOKEN?: string;
    /** Optional by contract: absent, the origin-requests loader returns its error state. */
    ANALYTICS_READ_TOKEN?: string;
    /** Optional by contract: absent or too short, the middleware refuses a presented token with 503. */
    SMOKE_TOKEN?: string;
    /**
     * Optional by contract but typed required: `.dev.vars` makes `wrangler types` generate it as
     * required, and `?:` would break assignability to `Cloudflare.Env`. `citations.server.ts` checks
     * it at runtime. A clean CI checkout has no `.dev.vars`, so this is its only declaration there.
     * Two holders, the Worker secret and `.dev.vars`: rotate both or neither.
     */
    OPENALEX_API_KEY: string;

  }
}

// No vars here: `wrangler types` already generates plain vars with their values.

declare module "*?url" {
  const url: string;
  export default url;
}

// `unknown`: the Worker tsconfig does not carry DOM's WebAssembly declarations.
declare module "*.wasm" {
  const wasmModule: unknown;
  export default wasmModule;
}

export {};

/**
 * Injected by `define` in vite.config.ts. Inside `declare global` because `export {}` makes this file
 * a module, so a bare `declare const` would be invisible to `workers/app.ts`.
 */
declare global {
  const __BUILD_ID__: string;
}
