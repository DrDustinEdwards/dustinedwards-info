import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as login from "~/routes/login";

import { freezeAtWindowStart, renderRoute, routeContext, textsOf, untilRefused } from "./route-helpers";

afterEach(() => {
  vi.useRealTimers();
});

/** What `data()` hands back, read loosely: the action returns it, a Response, or a thrown value. */
type Answer = Response | { data?: { problem?: string }; init?: { status?: number; headers?: Record<string, string> } };

const status = (answer: Answer) =>
  answer instanceof Response ? answer.status : (answer.init?.status ?? 200);

describe("/login without React", () => {
  it("does not hydrate: the door is a plain form plus the login.js busy label", () => {
    expect((login as { handle?: unknown }).handle).toBeUndefined();
    const html = renderRoute("/login", login.default, { actionData: undefined, loaderData: null });
    expect(html).toMatch(/<form data-sign-in="" method="post">/);
    expect(html).toMatch(/<button type="submit" class="btn-brand">Continue with Google<\/button>/);
    expect(html).toMatch(/<script type="module" src="[^"]*login[^"]*\.js"/);
  });

  it("renders an action's problem as an alert on the page, which is the no-script error state", async () => {
    const html = renderRoute("/login", login.default, {
      actionData: { problem: "Sign-in could not start: nope" },
      loaderData: null,
    });
    expect(await textsOf(html, '[role="alert"]')).toEqual(["Sign-in could not start: nope"]);
  });

  it("answers a rate-limited submission with a rendered problem, a 429 and Retry-After", async () => {
    freezeAtWindowStart();
    const ip = "203.0.113.91";
    const { refusal } = await untilRefused(
      async () => {
        const ctx = createExecutionContext();
        const answer = (await login.action({
          request: new Request("https://example.com/login", {
            method: "POST",
            headers: { "cf-connecting-ip": ip },
          }),
          context: routeContext(ctx),
          params: {},
        } as never)) as Answer;
        await waitOnExecutionContext(ctx);
        return answer;
      },
      (answer) => status(answer) === 429,
      31,
    );

    expect(refusal).not.toBeNull();
    expect(refusal).not.toBeInstanceOf(Response);
    const refused = refusal as Exclude<Answer, Response>;
    expect(refused.data?.problem).toMatch(/Too many sign-in attempts/);
    expect(Number(refused.init?.headers?.["retry-after"])).toBeGreaterThanOrEqual(300);
    expect(refused.init?.headers?.["cache-control"]).toMatch(/no-store/);
  });
});
