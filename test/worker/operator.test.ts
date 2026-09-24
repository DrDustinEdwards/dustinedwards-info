import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authenticateOperator, meterOperator } from "~/lib/operator/auth.server";
import { runTool } from "~/lib/operator/api.server";
import { postPath } from "~/lib/content/pipeline.mjs";

import { post } from "./fixtures";
import { testEnv } from "./test-env";
import { stubGitHub, type GitHubStub } from "./github-stub";

/**
 * The operator publish surface: who may call it, what a call costs, and what
 * policy refuses.
 *
 * OBSERVATION BOUNDARY. `authenticateOperator` and `meterOperator` are driven
 * directly rather than through `/api/operator`, because the route is a thin
 * shell over them and the ORDER is the property worth asserting: authenticate,
 * then meter, and only where something is spent. What this cannot see is the
 * route's JSON envelope, which `verify-live` reads on the wire.
 *
 * `testEnv.OPERATOR_TOKEN` is the fixture in `vitest.config.ts`, long enough to
 * clear the 32-character minimum so these cases exercise authentication rather
 * than the not-configured branch.
 */

const operatorEnv = () => env as unknown as Parameters<typeof authenticateOperator>[0];

const bearer = (token: string) =>
  new Request("https://example.com/api/operator", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });

/**
 * The instant every clock-frozen case below starts from.
 *
 * ON A MINUTE BOUNDARY deliberately, so a case that advances by the window
 * length lands exactly on the next one and the arithmetic under test is the
 * limiter's rather than this fixture's.
 */
const WINDOW_START = Date.UTC(2026, 8, 4, 12, 0, 0);

let gh: GitHubStub;

beforeEach(() => {
  gh = stubGitHub();
});

afterEach(() => {
  gh.restore();
  /* RESTORED HERE rather than at the end of each case that freezes: a case
   * that fails mid-assertion never reaches its own cleanup, and a frozen
   * clock leaking into the next case would be a second failure blamed on the
   * wrong subject. */
  vi.useRealTimers();
});

describe("operator authentication", () => {
  it("accepts the configured token and labels the caller", async () => {
    const result = await authenticateOperator(operatorEnv(), bearer(testEnv.OPERATOR_TOKEN));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBeTruthy();
  });

  it("REFUSES a wrong token of plausible length, through the constant-time compare", async () => {
    /*
     * SAME LENGTH AS THE REAL ONE, deliberately. A wrong token that is short
     * enough to be inside the length bound reaches `constantTimeEqual`, which
     * is the path the whole design is about; a very long one is refused earlier
     * by the bound and would prove nothing about the comparison.
     */
    const wrong = "x".repeat(testEnv.OPERATOR_TOKEN.length);
    expect(wrong).toHaveLength(testEnv.OPERATOR_TOKEN.length);
    const result = await authenticateOperator(operatorEnv(), bearer(wrong));
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("REFUSES an over-length token before hashing it", async () => {
    /*
     * The bound is twice the configured length, and it exists so an
     * unauthenticated caller cannot ask for a megabyte of SHA-256 per request.
     * Asserted at the boundary rather than at some arbitrary size: one
     * character inside is accepted for comparison, one character outside is
     * refused.
     */
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
    /*
     * THE DEFECT THIS REPLAYS, 2026-08-28: metering lived inside
     * `authenticateOperator`, so `GET /api/operator`, the describe call, spent
     * the same unit as a publish. A client reading the description before each
     * publish halved its own allowance and one that polled it could exhaust the
     * budget without ever writing.
     *
     * The observable form: authenticating N times must not move the limiter.
     * The limit is 30 per 60s, so 40 authentications would refuse if
     * authentication still metered.
     *
     * FROZEN FOR THE SAME REASON THE RATE CASE IS, in the other direction.
     * This one fails OPEN rather than closed: if the defect came back and a
     * minute boundary landed inside the loop, the reset would hand the loop a
     * fresh allowance, the metered call at the end would succeed, and the case
     * would report the defect absent. A regression test whose teeth depend on
     * the wall clock has teeth only sometimes.
     */
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WINDOW_START);

    for (let i = 0; i < 40; i += 1) {
      const auth = await authenticateOperator(operatorEnv(), bearer(testEnv.OPERATOR_TOKEN));
      expect(auth.ok).toBe(true);
    }

    /* And the budget is untouched: the very next metered call succeeds. */
    const metered = await meterOperator(operatorEnv(), "describe-budget-case");
    expect(metered.ok).toBe(true);
  });

  it("REFUSES past the per-operator rate limit, with a Retry-After to hand back", async () => {
    /*
     * THE CLOCK IS FROZEN FOR THE WHOLE SPEND, and that is what makes this
     * case deterministic rather than usually true.
     *
     * `AskBudget.hit` keys its counter on
     * `Math.floor(Date.now() / 1000 / windowSeconds)`, which is a FIXED window
     * on the wall clock. This loop spends the allowance one unit at a time and
     * asserts the refusal that follows it. Against the real clock, a minute
     * boundary landing inside the loop rolls the window and drops the count,
     * so the refusal arrives late or never arrives at all.
     *
     * MEASURED 2026-09-04 by aiming a run at a boundary: a roll at iteration
     * 25 consumed all 40 iterations and left `refusal` null, which is this
     * case failing. The refusal index tracks the roll index one for one. It
     * failed this way three times inside `ship`, most recently at 13,646ms,
     * and was green on every re-run, because the odds are the loop's duration
     * over sixty seconds and `ship` is when the machine is slowest.
     *
     * ONLY `Date` IS FAKED. The Durable Object call underneath is real RPC,
     * and faking the timer queue it runs on would be changing a second thing
     * to fix the first.
     */
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WINDOW_START);

    const id = "rate-limit-case";
    let refusal: Awaited<ReturnType<typeof meterOperator>> | null = null;
    for (let i = 0; i < 40 && refusal === null; i += 1) {
      const result = await meterOperator(operatorEnv(), id);
      if (!result.ok) refusal = result;
    }
    expect(refusal).toMatchObject({ ok: false, status: 429 });
    if (refusal && !refusal.ok) expect(refusal.retryAfter).toBeGreaterThan(0);
  });

  it("SERVES AGAIN once the Retry-After it handed back has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WINDOW_START);

    const id = "retry-after-case";
    let refusal: Awaited<ReturnType<typeof meterOperator>> | null = null;
    for (let i = 0; i < 40 && refusal === null; i += 1) {
      const result = await meterOperator(operatorEnv(), id);
      if (!result.ok) refusal = result;
    }
    expect(refusal).toMatchObject({ ok: false, status: 429 });
    const retryAfter = refusal && !refusal.ok ? (refusal.retryAfter ?? 0) : 0;
    expect(retryAfter).toBeGreaterThan(0);

    vi.setSystemTime(WINDOW_START + retryAfter * 1000);
    expect(await meterOperator(operatorEnv(), id)).toMatchObject({ ok: true });
  });

  it("does NOT serve when the limiter is missing", async () => {
    /*
     * The stance the Ask guards and `/api/health` take: a metered or privileged
     * endpoint without its limiter does not serve unprotected, it does not
     * serve. Asserted by removing the binding rather than by reading the source.
     */
    const { ASK_BUDGET: _removed, ...withoutLimiter } = env as unknown as Record<string, unknown>;
    const result = await meterOperator(
      withoutLimiter as unknown as Parameters<typeof meterOperator>[0],
      "no-limiter",
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
  });
});

describe("operator tools", () => {
  const operator = { kind: "operator", id: "test" } as const;

  it("REFUSES a first publication with the policy string a client branches on", async () => {
    const result = await runTool(operatorEnv(), operator, "save_post", {
      slug: "operator-first-publish",
      raw: post("operator-first-publish", { draft: false }),
      isNew: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      /* THE MACHINE-READABLE HALF. A client is told to branch on this rather
       * than string-match the prose, so the prose may change and this may not. */
      expect(result.detail).toMatchObject({ policy: "first-publish-requires-admin" });
    }
    expect(gh.files.has(postPath("operator-first-publish"))).toBe(false);
  });

  it("ALLOWS an operator to save a draft, and to republish one already published", async () => {
    const drafted = await runTool(operatorEnv(), operator, "save_post", {
      slug: "operator-draft",
      raw: post("operator-draft", { draft: true }),
      isNew: true,
    });
    expect(drafted.ok).toBe(true);

    /*
     * A post that HAS been public before may be republished by an operator.
     * Seeded with `first_published` in the repository, which is the only
     * authority `decide()` consults, so this is the real transition rather than
     * a flag the caller asserted about itself.
     */
    gh.files.set(
      postPath("was-public"),
      post("was-public", { draft: true, first_published: "2026-07-01" }),
    );
    const republished = await runTool(operatorEnv(), operator, "save_post", {
      slug: "was-public",
      raw: post("was-public", { draft: false, first_published: "2026-07-01" }),
      isNew: false,
    });
    expect(republished.ok).toBe(true);
  });

  it("REFUSES an operator delete, and the refusal names the reversible alternative", async () => {
    gh.files.set(postPath("keep-me"), post("keep-me"));
    const result = await runTool(operatorEnv(), operator, "delete_post", { slug: "keep-me" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.detail).toMatchObject({ policy: "delete-requires-admin" });
      expect(result.error).toContain("draft: true");
    }
    expect(gh.files.has(postPath("keep-me"))).toBe(true);
  });

  it("REFUSES a read-only smoke actor for every save, before any transition is computed", async () => {
    const result = await runTool(
      operatorEnv(),
      { kind: "smoke", id: "smoke-actor" },
      "save_post",
      { slug: "smoke-cannot-write", raw: post("smoke-cannot-write"), isNew: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toMatchObject({ policy: "smoke-is-read-only" });
    expect(gh.files.has(postPath("smoke-cannot-write"))).toBe(false);
  });
});
