import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authenticateOperator, meterOperator } from "~/lib/operator/auth.server";

import { WINDOW_START, freezeAtWindowStart, untilRefused } from "./route-helpers";
import { testEnv } from "./test-env";

/* The token fixture is long enough to clear the 32-character minimum, so these cases exercise
 * authentication rather than the not-configured branch. */

const operatorEnv = () => env as unknown as Parameters<typeof authenticateOperator>[0];

const bearer = (token: string) =>
  new Request("https://example.com/api/operator", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });

afterEach(() => {
  /* Restored here, not per case: a case that fails mid-assertion never reaches its own cleanup,
   * and a frozen clock would leak into the next case. */
  vi.useRealTimers();
});

describe("operator authentication", () => {
  it("accepts the configured token and labels the caller", async () => {
    const result = await authenticateOperator(operatorEnv(), bearer(testEnv.OPERATOR_TOKEN));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBeTruthy();
  });

  it("REFUSES a wrong token of plausible length, through the constant-time compare", async () => {
    /* Same length as the real one: a wrong token inside the length bound reaches
     * `safeEqual`, while a very long one is refused earlier and proves nothing. */
    const wrong = "x".repeat(testEnv.OPERATOR_TOKEN.length);
    expect(wrong).not.toBe(testEnv.OPERATOR_TOKEN);
    const result = await authenticateOperator(operatorEnv(), bearer(wrong));
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("REFUSES an over-length token before hashing it", async () => {
    /* The bound, twice the configured length, stops an unauthenticated caller asking for a
     * megabyte of SHA-256 per request. */
    const insideBound = "y".repeat(testEnv.OPERATOR_TOKEN.length * 2);
    const outsideBound = "y".repeat(testEnv.OPERATOR_TOKEN.length * 2 + 1);

    /* Both refuse, and that is the point: the refusal is indistinguishable to
     * the caller, so the bound is not an oracle for the token's length. */
    await expect(authenticateOperator(operatorEnv(), bearer(insideBound))).resolves.toMatchObject({
      ok: false,
      status: 401,
      error: "Invalid or missing bearer token.",
    });
    await expect(authenticateOperator(operatorEnv(), bearer(outsideBound))).resolves.toMatchObject({
      ok: false,
      status: 401,
      error: "Invalid or missing bearer token.",
    });
  });

  it("REFUSES a missing header on the same path as a wrong token", async () => {
    const result = await authenticateOperator(
      operatorEnv(),
      new Request("https://example.com/api/operator", { method: "POST" }),
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
  });
});

describe("operator metering", () => {
  it("spends budget only when it is asked to, and DESCRIBE never asks", async () => {
    /* Authenticating must not spend the limiter, or the describe call halves a client's
     * allowance. Frozen, or a window roll would hand the loop a fresh allowance and hide it. */
    freezeAtWindowStart();

    for (let i = 0; i < 40; i += 1) {
      const auth = await authenticateOperator(operatorEnv(), bearer(testEnv.OPERATOR_TOKEN));
      expect(auth.ok).toBe(true);
    }

    const metered = await meterOperator(operatorEnv(), "describe-budget-case");
    expect(metered.ok).toBe(true);
  });

  it("REFUSES past the per-operator rate limit, with a Retry-After to hand back", async () => {
    /* Frozen: `AskBudget.hit` keys on a FIXED wall-clock window, so a boundary inside the loop
     * drops the count and the refusal arrives late or never. */
    freezeAtWindowStart();

    const id = "rate-limit-case";
    const { refusal } = await untilRefused(() => meterOperator(operatorEnv(), id), (r) => !r.ok, 40);
    expect(refusal).toMatchObject({ ok: false, status: 429 });
    if (refusal && !refusal.ok) expect(refusal.retryAfter).toBeGreaterThan(0);
  });

  it("SERVES AGAIN once the Retry-After it handed back has passed", async () => {
    freezeAtWindowStart();

    const id = "retry-after-case";
    const { refusal } = await untilRefused(() => meterOperator(operatorEnv(), id), (r) => !r.ok, 40);
    expect(refusal).toMatchObject({ ok: false, status: 429 });
    const retryAfter = refusal && !refusal.ok ? (refusal.retryAfter ?? 0) : 0;
    expect(retryAfter).toBeGreaterThan(0);

    vi.setSystemTime(WINDOW_START + retryAfter * 1000);
    expect(await meterOperator(operatorEnv(), id)).toMatchObject({ ok: true });
  });

  it("does NOT serve when the limiter is missing", async () => {
    /* A metered or privileged endpoint without its limiter does not serve unprotected; it does not serve. */
    const { ASK_BUDGET: _removed, ...withoutLimiter } = env as unknown as Record<string, unknown>;
    const result = await meterOperator(
      withoutLimiter as unknown as Parameters<typeof meterOperator>[0],
      "no-limiter",
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });
});
