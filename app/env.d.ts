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
    /**
     * Cloudflare API token for READING Analytics Engine over the SQL API, scoped
     * to Account, Account Analytics, Read. The cockpit's origin-requests panel is
     * its only reader.
     *
     * OPTIONAL BY CONTRACT, on the OPERATOR_TOKEN precedent above rather than as
     * an oversight. It is deliberately not provisioned yet, and a local dev
     * machine will never have it, so the panel must treat absence as an ordinary
     * state: the loader returns its error state and the rest of the cockpit
     * renders untouched. Not configured means not readable, never a thrown
     * loader.
     *
     * The WRITE path needs nothing here. `env.ANALYTICS.writeDataPoint` is a
     * binding and carries its own authorization; only the read path is HTTPS to
     * api.cloudflare.com and only the read path needs a credential.
     */
    ANALYTICS_READ_TOKEN?: string;
    /**
     * Bearer token for the READ-ONLY smoke credential that lets `check:browser`
     * drive the real admin plane without the single admin's session cookie.
     *
     * OPTIONAL BY CONTRACT, the third on the `OPERATOR_TOKEN` precedent. Absent
     * or under 32 characters means NOT CONFIGURED, and the middleware refuses a
     * presented token with 503 rather than serving. A deployment without it is
     * an ordinary deployment: the admin plane still answers Dustin's session and
     * nothing else changes.
     *
     * Read in exactly one place, `app/lib/smoke.server.ts`. The full contract,
     * the least-privilege argument and the stated residue are there and on the
     * `smoke` row of `WRITE_CAPABILITIES`.
     */
    SMOKE_TOKEN?: string;

  }
}

/*
 * WHY THERE IS NO VARS BLOCK HERE, and why adding one would be a defect.
 *
 * `CLOUDFLARE_ACCOUNT_ID` is a plain var in wrangler.jsonc, not a secret, so
 * `wrangler types` already generates it into `__BaseEnv_Env` in
 * worker-configuration.d.ts, AS A STRING LITERAL carrying the id itself.
 * Declaring it again in this file would put the value in a second place and
 * hand a future edit two copies to keep in step, which is the drift the
 * config gate exists to prevent.
 *
 * Measured 2026-08-14 rather than assumed: the generated interface was read
 * back after `wrangler types` and it carries the binding.
 *
 * The rule this file enforces is about SECRETS, which wrangler cannot see
 * because they are set with `wrangler secret put` and are absent from the
 * config. Vars are the opposite case: wrangler owns them, so this file stays
 * out of the way.
 */

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
