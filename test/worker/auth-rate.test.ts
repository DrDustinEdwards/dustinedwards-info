import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuth } from "~/lib/auth.server";
import { loader } from "~/routes/api.auth.$";

import { freezeAtWindowStart, routeContext, untilRefused } from "./route-helpers";

const authRequest = (ip: string) =>
  new Request("https://example.com/api/auth/ok", { headers: { "cf-connecting-ip": ip } });

afterEach(() => {
  vi.useRealTimers();
});

describe("/api/auth rate limit", () => {
  it("lets a sign-in with retries through, then refuses with a 429 and Retry-After", async () => {
    freezeAtWindowStart();
    const ip = "203.0.113.77";

    /* Fifteen is five three-request sign-ins; thirty is the ceiling a limit
     * meant for one person a few times a month must stay under. */
    const { refusal, results } = await untilRefused(
      async () => {
        const ctx = createExecutionContext();
        const response = await loader({
          request: authRequest(ip),
          context: routeContext(ctx),
          params: {},
        } as never);
        await waitOnExecutionContext(ctx);
        return response;
      },
      (response) => response.status === 429,
      31,
    );

    expect(results.slice(0, 15).map((response) => response.status)).not.toContain(429);
    expect(refusal).not.toBeNull();
    /* The window has to span a slow OAuth round trip, or one sign-in reads as two bursts. */
    expect(Number(refusal?.headers.get("retry-after"))).toBeGreaterThanOrEqual(300);
  });
});

describe("createAuth", () => {
  it("REFUSES to run without the session secret or the auth URL, naming what is missing", () => {
    for (const name of ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const) {
      expect(() => createAuth({ ...env, [name]: "" } as never)).toThrow(name);
    }
  });
});
