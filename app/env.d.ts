/**
 * Secrets set with `wrangler secret put` are not in the generated Env type, so they are declared here.
 * `check:secrets` asserts this list matches its own in both directions: add a secret to both.
 */
declare global {
  interface Env {
    /** Optional by contract: `POST /api/operator` returns 503 when it is absent or too short. */
    OPERATOR_TOKEN?: string;
    /**
     * Carrel's key, reaching only /api/carrel/v1. Optional by contract: absent or under 32 characters,
     * the site-api package refuses every request. Two holders, this Worker and Carrel: rotate both.
     */
    CARREL_SITE_KEY?: string;
    /** Optional by contract: absent or too short, the middleware refuses a presented token with 503. */
    SMOKE_TOKEN?: string;
    /**
     * Optional by contract but typed required: `.dev.vars` makes `wrangler types` generate it as
     * required, and `?:` would break assignability to `Cloudflare.Env`. `citations.server.ts` checks
     * it at runtime. A clean CI checkout has no `.dev.vars`, so this is its only declaration there.
     * Two holders, the Worker secret and `.dev.vars`: rotate both or neither.
     */
    OPENALEX_API_KEY: string;
    /**
     * The /lab workspace's Primary Owner (capsid docs/design/design-identity-roles.md): Dustin, layer 0, never a row
     * in `members`. A secret so the address stays out of the public repository, and no page can change it. Optional
     * by contract: absent, /lab refuses everyone and says it is not set up.
     */
    PRIMARY_OWNER_EMAIL?: string;
    /**
     * Who may administer /admin, comma-separated (site-runtime's `adminEmails`), checked in code behind the Access
     * policy `dustinedwards-admin`. A secret for the same reason as PRIMARY_OWNER_EMAIL. Optional by contract: absent,
     * nobody is an administrator and /admin refuses every person (the read-only smoke bearer still renders).
     */
    ADMIN_EMAILS?: string;
    /**
     * This site's Capsid agent key, holding the write grant on the `dustinedwards` namespace, for POST
     * /ops/access-sync only: Capsid holds the Cloudflare token and writes the lab's Access group. Optional by
     * contract: absent, /lab/members still records every change and says the allow list was not touched.
     */
    CAPSID_ACCESS_SYNC_KEY?: string;
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
