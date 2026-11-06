/**
 * Test-only entry point for `npm run check:conformance`. NEVER DEPLOYED: the
 * deploy target is src/index.ts, set as `main` in wrangler.jsonc, and this file
 * is reached only by passing it positionally to `wrangler dev`.
 *
 * WHY IT EXISTS. The real /mcp sits behind the OAuth 2.1 resource server, and the
 * official conformance suite has no way to complete a consent flow. Pointing the
 * suite at the probe instead would prove nothing, because the probe is not the
 * server. So this entry mounts the REAL protocol layer and the REAL ten tools,
 * with only the client-leg auth and the rate limiter removed (a synthetic
 * administrator caller stands in for the grant), and the SITE binding replaced
 * by a fetch to a local stub. What gets certified is the code that ships.
 *
 * It is NOT a backdoor. It is not `main`, it is not deployed, and it only ever
 * runs inside `wrangler dev` on a loopback port for the duration of the gate.
 * check:wrapper asserts that `main` is src/index.ts, so pointing the deploy at
 * this file would fail a gate.
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
    const site = { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(new Request(stub, new Request(input, init))) };
    const email = env.ADMIN_EMAIL ?? "";
    return handleMcp(request, { ...env, SITE: site as unknown as Fetcher }, ctx, {
      kind: "admin",
      props: { email },
      scopes: ["dei.read", "dei.write"],
    });
  },
} satisfies ExportedHandler<Env>;
