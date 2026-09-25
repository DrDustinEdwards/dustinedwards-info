import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authenticateOperator, meterOperator } from "~/lib/operator/auth.server";
import { runTool } from "~/lib/operator/api.server";
import { postPath } from "~/lib/content/pipeline.mjs";

import { post } from "./fixtures";
import { testEnv } from "./test-env";
import { stubGitHub, type GitHubStub } from "./github-stub";

/* The token fixture is long enough to clear the 32-character minimum, so these cases exercise
 * authentication rather than the not-configured branch. */

const operatorEnv = () => env as unknown as Parameters<typeof authenticateOperator>[0];

const bearer = (token: string) =>
  new Request("https://example.com/api/operator", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });

/* On a minute boundary, so a case that advances by the window length lands exactly on the next
 * one and the arithmetic under test is the limiter's. */
const WINDOW_START = Date.UTC(2026, 8, 4, 12, 0, 0);

let gh: GitHubStub;

beforeEach(() => {
  gh = stubGitHub();
});

afterEach(() => {
  gh.restore();
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
     * `constantTimeEqual`, while a very long one is refused earlier and proves nothing. */
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WINDOW_START);

    for (let i = 0; i < 40; i += 1) {
      const auth = await authenticateOperator(operatorEnv(), bearer(testEnv.OPERATOR_TOKEN));
      expect(auth.ok).toBe(true);
    }

    const metered = await meterOperator(operatorEnv(), "describe-budget-case");
    expect(metered.ok).toBe(true);
  });

  it("REFUSES past the per-operator rate limit, with a Retry-After to hand back", async () => {
    /* Frozen: `AskBudget.hit` keys on a FIXED wall-clock window, so a boundary inside the loop
     * drops the count and the refusal arrives late or never. Only `Date` is faked; the Durable
     * Object call underneath is real RPC. */
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
    /* A metered or privileged endpoint without its limiter does not serve unprotected; it does not serve. */
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

    /* Seeded with `first_published` in the repository, the only authority `decide()` consults,
     * so this is the real transition rather than a flag the caller asserted. */
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
