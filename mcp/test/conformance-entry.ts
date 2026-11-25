/**
 * Test-only entry point for `npm run check:conformance`. NEVER DEPLOYED: `main` in wrangler.jsonc is
 * src/index.ts (check:wrapper asserts it), and this file is reached only positionally via `wrangler dev`.
 * The real /mcp sits behind OAuth 2.1, which the conformance suite cannot complete, and the probe is not the
 * server. So this mounts the REAL protocol layer and REAL tools with only the client-leg auth and rate limiter
 * removed (a synthetic administrator stands in) and the SITE binding replaced by a local stub: what is certified
 * is the code that ships.
 */

import { handleMcp } from "../src/mcp-handler";
import type { ToolEnv } from "../src/tools";

// wrangler.jsonc declares the Durable Object bindings, so any entry it runs has
// to export the classes or the dev server refuses to start.
export { RateLimiter as OperatorRateLimit } from "@dustinedwards/site-runtime/rate-limit/durable-object";
export { ToolCallLog } from "@dustinedwards/site-runtime/audit-log";

type Env = ToolEnv & { STUB_URL?: string };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const stub = env.STUB_URL ?? "";
    const site = {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(new Request(stub, new Request(input, init))),
    };
    const email = env.ADMIN_EMAIL ?? "";
    return handleMcp(request, { ...env, SITE: site as unknown as Fetcher }, ctx, {
      kind: "admin",
      props: { email },
      scopes: ["dei.read", "dei.write"],
    });
  },
} satisfies ExportedHandler<Env>;
