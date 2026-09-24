import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { cloudflareContext } from "~/lib/context";
import { loader } from "~/routes/api.auth.$";

/**
 * The `/api/auth/*` rate limit, through the route's own loader and the real
 * Durable Object limiter.
 */

const authRequest = (ip: string) =>
  new Request("https://example.com/api/auth/ok", { headers: { "cf-connecting-ip": ip } });

describe("/api/auth rate limit", () => {
  it("lets a sign-in with retries through, then refuses with a 429 and Retry-After", async () => {
    const ip = "203.0.113.77";
    const statuses: number[] = [];
    let refusal: Response | null = null;

    /* Fifteen is five three-request sign-ins; thirty is the ceiling a limit
     * meant for one person a few times a month must stay under. */
    for (let i = 0; i < 31 && !refusal; i += 1) {
      const ctx = createExecutionContext();
      const context = new RouterContextProvider();
      context.set(cloudflareContext, { env: env as never, ctx });
      const response = await loader({ request: authRequest(ip), context, params: {} } as never);
      await waitOnExecutionContext(ctx);
      statuses.push(response.status);
      if (response.status === 429) refusal = response;
    }

    expect(statuses.slice(0, 15)).not.toContain(429);
    expect(refusal).not.toBeNull();
    /* The window has to span a slow OAuth round trip, or one sign-in reads as two bursts. */
    expect(Number(refusal?.headers.get("retry-after"))).toBeGreaterThanOrEqual(300);
  });
});
