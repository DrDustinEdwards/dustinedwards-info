/**
 * Secrets set with `wrangler secret put` are not part of wrangler.jsonc, so they do not appear in
 * the generated Env type. Declare them here. Values never reach the client bundle: they are read
 * only inside `.server` modules and loaders.
 *
 * THIS BLOCK IS GATED. `check:secrets` asserts in both directions that every ratified secret is
 * declared here and that everything here is ratified, so adding one means editing this block, the
 * gate's list and `dustinedwards/core.md` in one commit.
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
     * Bearer token for the operator API. OPTIONAL, and that is the contract rather than an oversight:
     * `POST /api/operator` returns 503 when it is absent or too short, because not configured means not
     * open.
     */
    OPERATOR_TOKEN?: string;
    /**
     * Cloudflare API token for READING Analytics Engine over the SQL API, scoped to Account Analytics
     * Read. The cockpit's origin-requests panel is its only reader.
     *
     * OPTIONAL BY CONTRACT, on the `OPERATOR_TOKEN` precedent. A development machine will never have it,
     * so absence is an ordinary state: the loader returns its error state and the rest of the cockpit
     * renders untouched. Not configured means not readable, never a thrown loader.
     *
     * The WRITE path needs nothing here: `writeDataPoint` is a binding and carries its own
     * authorization.
     */
    ANALYTICS_READ_TOKEN?: string;
    /**
     * Bearer token for the READ-ONLY smoke credential that lets `check:browser` drive the real admin
     * plane without the single admin's session cookie.
     *
     * OPTIONAL BY CONTRACT, the third on the `OPERATOR_TOKEN` precedent. Absent or too short means NOT
     * CONFIGURED, and the middleware refuses a presented token with 503 rather than serving. Read in
     * exactly one place, `app/lib/smoke.server.ts`, where the least-privilege argument lives.
     */
    SMOKE_TOKEN?: string;
    /**
     * API key for OpenAlex, which is where the per-paper citation counts come from.
     *
     * OPTIONAL BY CONTRACT, and the gentlest of the four degradations: `citations.server.ts` serves
     * whatever APP_KV already holds and does not schedule a refresh, so an unset key means counts stop
     * aging forward rather than disappearing. Nothing 503s and nothing renders a zero.
     *
     * TWO HOLDERS, ONE CREDENTIAL: the Worker secret, and the gitignored `.dev.vars` the build reads
     * through `scripts/lib/dev-vars.mjs`. Rotate both or neither.
     *
     * WHY THIS ONE IS NOT MARKED OPTIONAL, WHEN ITS CONTRACT IS. Because `.dev.vars` is also where the
     * build reads it, `wrangler types` SEES IT and generates it as required. Declaring it `?: string`
     * here widens the merged `Env` so it stops being assignable to `Cloudflare.Env`. THE OPTIONALITY IS
     * ENFORCED IN CODE INSTEAD: `citations.server.ts` checks the value before spending a request,
     * because an unset secret is `undefined` at runtime whatever the type says. The type is not the
     * contract here; this comment is.
     *
     * WHY THE DECLARATION EXISTS AT ALL: on a clean CI checkout there is no `.dev.vars`, wrangler
     * generates nothing, and this line is the only declaration. Removing it compiles locally and fails
     * on a fresh clone.
     */
    OPENALEX_API_KEY: string;

  }
}

/*
 * WHY THERE IS NO VARS BLOCK HERE, and why adding one would be a defect. A plain var in
 * wrangler.jsonc is already generated into the base Env by `wrangler types`, carrying its value, so
 * declaring it again would put that value in a second place.
 *
 * The rule this file enforces is about SECRETS, which wrangler cannot see because they are set with
 * `wrangler secret put`. Vars are the opposite case: wrangler owns them.
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

/**
 * A value that differs for every build, injected by `define` in vite.config.ts. It namespaces the
 * Worker's own HTML cache and has no other reader; the grounds are on `BUILD_ID` in that file.
 *
 * Inside `declare global` because this file carries `export {}` and is therefore a module: a bare
 * `declare const` here would be scoped to the module and invisible to `workers/app.ts`.
 */
declare global {
  const __BUILD_ID__: string;
}
