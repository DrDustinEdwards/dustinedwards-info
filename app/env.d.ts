import type { SiteSecrets } from "@dustinedwards/site-runtime/worker";

/**
 * Secrets set with `wrangler secret put` are not in the generated Env type, so they are declared here. The ones every
 * site holds (OPERATOR_TOKEN, CARREL_SITE_KEY, ADMIN_IDLE_SECRET, ADMIN_EMAIL, CO_OWNER_EMAILS, ANTHROPIC_API_KEY and
 * the rest) are site-runtime's SiteSecrets; this file keeps only dustinedwards.info's own. `check:secrets` asserts
 * every secret in app/lib/secrets.mjs is declared here or in SiteSecrets, and that each one declared here is listed.
 */
declare global {
  interface Env extends SiteSecrets {
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
     * The /lab-bench workspace's Primary Owner (capsid docs/design/design-identity-roles.md): Dustin, layer 0, never a row
     * in `members`. A secret so the address stays out of the public repository, and no page can change it. Optional
     * by contract: absent, /lab-bench refuses everyone and says it is not set up.
     */
    PRIMARY_OWNER_EMAIL?: string;
    /**
     * This site's Capsid agent key, holding the write grant on the `dustinedwards` namespace, for POST
     * /ops/access-sync only: Capsid holds the Cloudflare token and writes the lab's Access group. Optional by
     * contract: absent, /lab-bench/members still records every change and says the allow list was not touched.
     */
    CAPSID_ACCESS_SYNC_KEY?: string;
    /**
     * Where the daily publication check mails a new DOI (app/lib/publications/notify.server.ts), through the EMAIL
     * binding. A secret for the same reason as PRIMARY_OWNER_EMAIL; it must be a verified Email Routing destination.
     * Optional by contract: absent, the check-publications job fails and says so.
     */
    ALERT_EMAIL?: string;
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
