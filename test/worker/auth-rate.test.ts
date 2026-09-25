import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuth } from "~/lib/auth.server";
import { cloudflareContext } from "~/lib/context";
import { loader } from "~/routes/api.auth.$";

const authRequest = (ip: string) =>
  new Request("https://example.com/api/auth/ok", { headers: { "cf-connecting-ip": ip } });

/* On a ten-minute boundary: the limiter counts on a FIXED wall-clock window, so a real clock that
 * crossed one mid-loop would reset the count and the refusal would arrive late or never. */
const WINDOW_START = Date.UTC(2026, 8, 4, 12, 0, 0);

afterEach(() => {
  vi.useRealTimers();
});

describe("/api/auth rate limit", () => {
  it("lets a sign-in with retries through, then refuses with a 429 and Retry-After", async () => {
    /* Only `Date` is faked; the Durable Object call underneath is real RPC. */
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WINDOW_START);
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

describe("createAuth", () => {
  it("REFUSES to run without the session secret or the auth URL, naming what is missing", () => {
    for (const name of ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const) {
      expect(() => createAuth({ ...env, [name]: "" } as never)).toThrow(name);
    }
  });
});
