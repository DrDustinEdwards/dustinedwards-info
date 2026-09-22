import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { approvedMentionsFor } from "~/db";
import { cloudflareContext } from "~/lib/context";
import { SMOKE_READ_ONLY_POLICY } from "~/lib/editor/publish-policy.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { FAILURE_REASONS } from "~/lib/webmention/verify.server";
import { middleware as adminMiddleware } from "~/routes/admin";
import {
  action as mentionsAction,
  loader as mentionsLoader,
} from "~/routes/admin.mentions";
import { action as webmentionAction, loader as webmentionLoader } from "~/routes/webmention";
import { loader as blogLoader } from "~/routes/blog.$slug";

/**
 * The webmention receiver, its four bounds, its verifier and its moderation
 * queue.
 *
 * ## OBSERVATION BOUNDARY
 *
 * The route module is driven DIRECTLY, on `routes.test.ts`' pattern and for its
 * reason: `virtual:react-router/server-build` is a build artifact this layer
 * does not build, so what is exercised here is the module's own behavior,
 * which is where every property below actually lives. What this cannot see is
 * that `/webmention` is wired to this module, which is `routes.ts` and the
 * live probe's business.
 *
 * The outbound fetch is stubbed at the wire, the way `github-stub.ts` does it
 * and for the same stated reason: the verifier's job IS to make an HTTP request
 * and read what comes back, so mocking the verifier would delete the subject
 * and leave a test of its argument list. The stub REFUSES EVERY URL IT DOES NOT
 * KNOW, which is what makes "this layer never reaches the network" a mechanism
 * rather than an intention.
 *
 * ## EVERY CASE CARRIES ITS OWN CLIENT IP
 *
 * `clientIp` falls back to the literal `unknown` off the edge, so without this
 * every case in the file would share one `wm:unknown` rate-limit instance and
 * the twenty-first assertion in the file would fail for the twentieth's reason.
 * Discovered by reading `client-ip.ts`, not by watching it happen.
 */

/** The `context` a loader or action receives, carrying the bindings. */
function routeContext(ctx: ExecutionContext, overrides: Record<string, unknown> = {}) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: { ...env, ...overrides } as never, ctx });
  return context;
}

/**
 * The instant the rate case freezes at. ON A MINUTE BOUNDARY, so a case that
 * advances by the window length lands exactly on the next one and the
 * arithmetic under test is the limiter's rather than this fixture's.
 *
 * The whole family of rate-limit cases in this layer was flaky against the real
 * clock until 2026-09-04: `AskBudget.hit` keys on a FIXED window, so a boundary
 * landing inside a spend loop resets the count and the refusal never arrives.
 * Frozen here for that reason and no other.
 */
const WINDOW_START = Date.UTC(2026, 8, 4, 12, 0, 0);

const TARGET_SLUG = "a-mentioned-post";
const TARGET = `${SITE_ORIGIN}/blog/${TARGET_SLUG}`;

/** A form POST to the endpoint, from an IP of the case's own choosing. */
function wm(
  body: string,
  options: { ip?: string; method?: string; contentType?: string | null; headers?: HeadersInit } = {},
) {
  const headers = new Headers(options.headers);
  headers.set("cf-connecting-ip", options.ip ?? "203.0.113.1");
  if (options.contentType !== null) {
    headers.set("content-type", options.contentType ?? "application/x-www-form-urlencoded");
  }
  return new Request(`${SITE_ORIGIN}/webmention`, {
    method: options.method ?? "POST",
    headers,
    ...(options.method === "GET" || options.method === "HEAD" ? {} : { body }),
  });
}

const form = (source: string, target: string) =>
  `source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`;

/** One page the stub will serve, or a failure it will produce instead. */
type StubPage =
  | { body: string; contentType?: string; status?: number }
  | { networkError: true };

/**
 * Install the outbound stub.
 *
 * A URL with no recorded page THROWS AND NAMES ITSELF rather than falling
 * through to the network, which is `github-stub.ts`' one load-bearing property
 * transplanted: a stub that reached the real internet would pass locally
 * against whatever happened to be published that day.
 *
 * `gate`, when given, is awaited before any page is served. It is how the
 * "202 and a row in unverified" case observes the row BEFORE verification
 * overwrites it, without racing the `waitUntil` task.
 */
function stubSources(pages: Record<string, StubPage>, gate?: Promise<void>) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const page = pages[url];
    if (!page) {
      throw new Error(
        `the webmention source stub refuses ${url}: this layer never reaches the ` +
          `network. Record the page's shape here if the fetch is legitimate.`,
      );
    }
    if (gate) await gate;
    if ("networkError" in page) throw new TypeError("network failure");
    return new Response(page.body, {
      status: page.status ?? 200,
      headers: { "content-type": page.contentType ?? "text/html; charset=utf-8" },
    });
  });
}

/** A minimal source page that links to `href`. */
const pageLinkingTo = (href: string, extra = "") =>
  `<!doctype html><html><body>${extra}<p>I read <a href="${href}">this post</a> today and it was useful.</p></body></html>`;

async function seedPost(slug: string, status: "draft" | "published") {
  await env.DB.prepare(
    `INSERT INTO posts (slug, kind, title, body, status, publish_at)
     VALUES (?1, 'post', ?2, 'A body.', ?3, ?4)
     ON CONFLICT(slug) DO UPDATE SET status = excluded.status`,
  )
    .bind(slug, `Title for ${slug}`, status, Math.floor(Date.UTC(2026, 0, 1) / 1000))
    .run();
}

async function mentionRow(sourceUrl: string) {
  return env.DB.prepare(`SELECT * FROM webmentions WHERE source_url = ?1`)
    .bind(sourceUrl)
    .first<{
      id: number;
      status: string;
      author_name: string | null;
      author_url: string | null;
      excerpt: string | null;
      failure_reason: string | null;
      target_slug: string;
    }>();
}

beforeEach(async () => {
  /*
   * THE TABLE IS EMPTIED BETWEEN CASES, because D1 persists for the whole file
   * and the global-cap case asserts an exact count. Not an FTS index and not a
   * derived store, so hard rules 7 and 18 have nothing to say about it.
   */
  await env.DB.prepare(`DELETE FROM webmentions`).run();
  await seedPost(TARGET_SLUG, "published");
});

afterEach(() => {
  /* RESTORED HERE rather than at the end of each freezing case: a case that
   * fails mid-assertion never reaches its own cleanup, and a clock left frozen
   * would surface as a failure in whatever ran next. */
  vi.useRealTimers();
});

describe("/webmention refuses before it reads", () => {
  it("answers 405 to a GET at the ACTION and reads nothing", async () => {
    const ctx = createExecutionContext();
    const response = await webmentionAction({
      request: wm("", { method: "GET", ip: "203.0.113.10" }),
      context: routeContext(ctx),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    /* NOTHING WAS WRITTEN. A 405 that had already touched D1 would mean the
     * method gate is decoration rather than the first bound. */
    const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM webmentions`).first<{
      n: number;
    }>();
    expect(count?.n).toBe(0);
  });

  it("answers 200 with plain text to a GET at the LOADER, revealing nothing", async () => {
    const response = webmentionLoader();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toContain("Webmention endpoint");
  });

  it("answers 413 on an honest oversized Content-Length, before the body", async () => {
    const ctx = createExecutionContext();
    const response = await webmentionAction({
      request: wm(form("https://elsewhere.example/a", TARGET), {
        ip: "203.0.113.11",
        headers: { "content-length": String(5 * 1024) },
      }),
      context: routeContext(ctx),
    } as never);

    expect(response.status).toBe(413);
  });

  it("answers 413 on a body that EXCEEDS the cap while UNDERSTATING its length", async () => {
    /*
     * THE HALF A Content-Length CHECK CANNOT SEE, and the defect
     * `read-capped.mjs` was written for: a declared length is useful only for
     * refusing early, never for permitting. The header below lies.
     */
    const ctx = createExecutionContext();
    const huge = form(`https://elsewhere.example/${"a".repeat(6000)}`, TARGET);
    const response = await webmentionAction({
      request: wm(huge, { ip: "203.0.113.12", headers: { "content-length": "10" } }),
      context: routeContext(ctx),
    } as never);

    expect(response.status).toBe(413);
  });

  it("answers 400 when source or target is missing", async () => {
    const ctx = createExecutionContext();
    for (const body of ["", "source=https://elsewhere.example/a", `target=${encodeURIComponent(TARGET)}`]) {
      const response = await webmentionAction({
        request: wm(body, { ip: "203.0.113.13" }),
        context: routeContext(ctx),
      } as never);
      expect(response.status).toBe(400);
    }
  });

  it("answers 400 when the encoding is not a form", async () => {
    const ctx = createExecutionContext();
    const response = await webmentionAction({
      request: wm(JSON.stringify({ source: "https://elsewhere.example/a", target: TARGET }), {
        ip: "203.0.113.14",
        contentType: "application/json",
      }),
      context: routeContext(ctx),
    } as never);

    expect(response.status).toBe(400);
  });

  it("does NOT serve when the limiter is missing", async () => {
    /*
     * The stance the Ask guards, the CSP sink, `/api/health` and the operator
     * path all take: an unprotected public write path does not serve unmetered,
     * it does not serve. Asserted by REMOVING THE BINDING rather than by
     * reading the source.
     */
    const ctx = createExecutionContext();
    const { ASK_BUDGET: _removed, ...withoutLimiter } = env as unknown as Record<string, unknown>;
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env: withoutLimiter as never, ctx });

    const response = await webmentionAction({
      request: wm(form("https://elsewhere.example/a", TARGET), { ip: "203.0.113.15" }),
      context,
    } as never);

    expect(response.status).toBe(503);
  });
});

describe("/webmention bound 1: the per-IP rate limit", () => {
  it("REFUSES past 20 per 60 seconds, with a Retry-After to hand back", async () => {
    /*
     * THE CLOCK IS FROZEN FOR THE WHOLE SPEND. `AskBudget.hit` keys its counter
     * on `Math.floor(Date.now() / 1000 / windowSeconds)`, a FIXED window: a
     * boundary landing inside this loop drops the count and the refusal arrives
     * late or never. Measured 2026-09-04 across the operator and health cases,
     * where it cost a ship.
     *
     * The requests below carry a TARGET THIS SITE DOES NOT HAVE, so each one is
     * refused at 400 after spending its rate unit and before touching D1 or
     * scheduling a verification. The rate limit is what is under test, not the
     * write path.
     */
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WINDOW_START);

    const ctx = createExecutionContext();
    const context = routeContext(ctx);
    let refusal: Response | null = null;
    let accepted = 0;
    for (let i = 0; i < 40 && refusal === null; i += 1) {
      const response = await webmentionAction({
        request: wm(form("https://elsewhere.example/a", "https://elsewhere.example/not-here"), {
          ip: "203.0.113.20",
        }),
        context,
      } as never);
      if (response.status === 429) refusal = response;
      else accepted += 1;
    }

    expect(refusal).not.toBeNull();
    expect(accepted).toBe(20);
    expect(refusal?.headers.get("retry-after")).toBe("60");
    expect(refusal?.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("/webmention bound 2: the target must be a published post here", () => {
  it("REFUSES a target on another origin", async () => {
    const ctx = createExecutionContext();
    const response = await webmentionAction({
      request: wm(
        form("https://elsewhere.example/a", "https://elsewhere.example/blog/a-mentioned-post"),
        { ip: "203.0.113.30" },
      ),
      context: routeContext(ctx),
    } as never);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("target must be a published post on this site");
  });

  it("REFUSES a path on this origin that is not a post", async () => {
    const ctx = createExecutionContext();
    for (const target of [`${SITE_ORIGIN}/colophon`, `${SITE_ORIGIN}/blog`, `${SITE_ORIGIN}/`]) {
      const response = await webmentionAction({
        request: wm(form("https://elsewhere.example/a", target), { ip: "203.0.113.31" }),
        context: routeContext(ctx),
      } as never);
      expect(response.status).toBe(400);
    }
  });

  it("REFUSES A DRAFT TARGET AND AN UNKNOWN SLUG IDENTICALLY, byte for byte", async () => {
    /*
     * THE ORACLE THIS CLOSES. Hard rule 1 keeps drafts off every public
     * surface, and a 400 that distinguished "that post is not published" from
     * "there is no such post" would put them back on one: a caller could
     * enumerate unpublished slugs by reading the refusals, without ever seeing
     * a page.
     *
     * Compared as STATUS AND BODY rather than by reading the route's constant,
     * because the property is that a caller cannot tell them apart, and a
     * caller reads the wire.
     */
    await seedPost("an-unpublished-draft", "draft");

    const ctx = createExecutionContext();
    const draft = await webmentionAction({
      request: wm(
        form("https://elsewhere.example/a", `${SITE_ORIGIN}/blog/an-unpublished-draft`),
        { ip: "203.0.113.32" },
      ),
      context: routeContext(ctx),
    } as never);
    const unknown = await webmentionAction({
      request: wm(
        form("https://elsewhere.example/a", `${SITE_ORIGIN}/blog/no-such-post-anywhere`),
        { ip: "203.0.113.32" },
      ),
      context: routeContext(ctx),
    } as never);

    expect(draft.status).toBe(400);
    expect(draft.status).toBe(unknown.status);
    expect(await draft.text()).toBe(await unknown.text());

    /* And the draft is really there, so this case is not passing because the
     * seed silently failed and both requests named a slug that does not
     * exist. */
    const seeded = await env.DB.prepare(
      `SELECT status FROM posts WHERE slug = 'an-unpublished-draft'`,
    ).first<{ status: string }>();
    expect(seeded?.status).toBe("draft");
  });

  it("REFUSES a source that is this origin, an IP literal, or localhost", async () => {
    const ctx = createExecutionContext();
    const sources = [
      `${SITE_ORIGIN}/blog/some-other-post`,
      "http://192.0.2.7/a-post",
      "https://[2001:db8::1]/a-post",
      "http://localhost:8787/a-post",
      "http://a.localhost/a-post",
      "ftp://elsewhere.example/a-post",
    ];
    for (const source of sources) {
      const response = await webmentionAction({
        request: wm(form(source, TARGET), { ip: "203.0.113.33" }),
        context: routeContext(ctx),
      } as never);
      expect(response.status, `source ${source} was not refused`).toBe(400);
    }
    /* SCOPE, ASSERTED. An empty list would pass this case by examining
     * nothing, which is what a clean sweep looks like. */
    expect(sources.length).toBe(6);
  });
});

describe("/webmention bound 4: the global cap on open rows", () => {
  it("answers 503 at the cap and writes nothing more", async () => {
    /*
     * 500 SEEDED `pending` ROWS, which is the cap. Written with a recursive CTE
     * rather than 500 round trips, and every value is generated here, so
     * nothing about this seed is user input.
     */
    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 500)
       INSERT INTO webmentions (source_url, target_slug, status)
       SELECT 'https://seeded.example/' || n, ?1, 'pending' FROM seq`,
    )
      .bind(TARGET_SLUG)
      .run();

    const before = await env.DB.prepare(`SELECT COUNT(*) AS n FROM webmentions`).first<{
      n: number;
    }>();
    expect(before?.n).toBe(500);

    const ctx = createExecutionContext();
    const response = await webmentionAction({
      request: wm(form("https://elsewhere.example/over-the-cap", TARGET), {
        ip: "203.0.113.40",
      }),
      context: routeContext(ctx),
    } as never);

    expect(response.status).toBe(503);
    const after = await env.DB.prepare(`SELECT COUNT(*) AS n FROM webmentions`).first<{
      n: number;
    }>();
    expect(after?.n).toBe(500);
  });
});

describe("/webmention accepts and verifies", () => {
  it("answers 202 and leaves the row UNVERIFIED until verification runs", async () => {
    /*
     * THE GATE IS WHAT MAKES THIS DETERMINISTIC. Verification is handed to
     * `ctx.waitUntil`, so without a hold the verdict write races the assertion
     * below and this case would pass or fail on scheduling. The stub waits on
     * `release` before serving, so the row is observed in the state the
     * endpoint left it in, and then the hold is lifted and the same case proves
     * the transition.
     */
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const source = "https://elsewhere.example/gated";
    stubSources({ [source]: { body: pageLinkingTo(TARGET) } }, gate);

    const ctx = createExecutionContext();
    const response = await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.50" }),
      context: routeContext(ctx),
    } as never);

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("private, no-store");

    const held = await mentionRow(source);
    expect(held?.status).toBe("unverified");
    expect(held?.target_slug).toBe(TARGET_SLUG);

    release();
    await waitOnExecutionContext(ctx);

    const verified = await mentionRow(source);
    expect(verified?.status).toBe("pending");
  });

  it("moves the row to PENDING when the source really links to the target", async () => {
    const source = "https://elsewhere.example/links-here";
    stubSources({ [source]: { body: pageLinkingTo(TARGET) } });

    const ctx = createExecutionContext();
    await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.51" }),
      context: routeContext(ctx),
    } as never);
    await waitOnExecutionContext(ctx);

    const row = await mentionRow(source);
    expect(row?.status).toBe("pending");
    expect(row?.failure_reason).toBeNull();
    /* The excerpt is the CONTAINING element's text, collapsed. */
    expect(row?.excerpt).toBe("I read this post today and it was useful.");
    /* No h-card, so the name is the source HOSTNAME and the url is null: a
     * fact about where it came from rather than a guess about who wrote it. */
    expect(row?.author_name).toBe("elsewhere.example");
    expect(row?.author_url).toBeNull();
  });

  it("matches the link with and without a trailing slash", async () => {
    const source = "https://elsewhere.example/trailing-slash";
    stubSources({ [source]: { body: pageLinkingTo(`${TARGET}/`) } });

    const ctx = createExecutionContext();
    await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.52" }),
      context: routeContext(ctx),
    } as never);
    await waitOnExecutionContext(ctx);

    expect((await mentionRow(source))?.status).toBe("pending");
  });

  it("FAILS with no-link when the source does not link to the target", async () => {
    const source = "https://elsewhere.example/links-elsewhere";
    stubSources({
      [source]: { body: pageLinkingTo(`${SITE_ORIGIN}/blog/a-different-post`) },
    });

    const ctx = createExecutionContext();
    await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.53" }),
      context: routeContext(ctx),
    } as never);
    await waitOnExecutionContext(ctx);

    const row = await mentionRow(source);
    expect(row?.status).toBe("failed");
    expect(row?.failure_reason).toBe(FAILURE_REASONS.noLink);
  });

  it("FAILS with too-large past 1 MB, without holding the whole body", async () => {
    const source = "https://elsewhere.example/enormous";
    /* Over the ceiling by a comfortable margin, and the link IS on the page:
     * the case would pass for the wrong reason if the body carried no link,
     * because `no-link` is also a failure. */
    const filler = "<p>padding padding padding</p>".repeat(40_000);
    stubSources({ [source]: { body: pageLinkingTo(TARGET, filler) } });

    const ctx = createExecutionContext();
    await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.54" }),
      context: routeContext(ctx),
    } as never);
    await waitOnExecutionContext(ctx);

    const row = await mentionRow(source);
    expect(row?.status).toBe("failed");
    expect(row?.failure_reason).toBe(FAILURE_REASONS.tooLarge);
  });

  it("FAILS with not-html when the source is not a document", async () => {
    const source = "https://elsewhere.example/a.json";
    stubSources({
      [source]: { body: `{"links":["${TARGET}"]}`, contentType: "application/json" },
    });

    const ctx = createExecutionContext();
    await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.55" }),
      context: routeContext(ctx),
    } as never);
    await waitOnExecutionContext(ctx);

    expect((await mentionRow(source))?.failure_reason).toBe(FAILURE_REASONS.notHtml);
  });

  it("FAILS with fetch-error when the source cannot be reached", async () => {
    const source = "https://elsewhere.example/gone";
    stubSources({ [source]: { networkError: true } });

    const ctx = createExecutionContext();
    await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.56" }),
      context: routeContext(ctx),
    } as never);
    await waitOnExecutionContext(ctx);

    expect((await mentionRow(source))?.failure_reason).toBe(FAILURE_REASONS.fetchError);
  });

  it("STORES A SCRIPT-SHAPED AUTHOR NAME AS THAT LITERAL TEXT", async () => {
    /*
     * The h-card is read out of a document this site does not control, and the
     * value below is what an attacker would put in it. It must arrive in the
     * column as the CHARACTERS, unexecuted and unstripped: the H2 render
     * escapes it, and a column holding markup would make the render the only
     * thing standing between it and a reader.
     *
     * The name is entity-encoded in the source so that `textContent` yields the
     * literal string rather than a parsed element, which is exactly the shape a
     * real hostile page would send.
     */
    const source = "https://elsewhere.example/hostile-card";
    const card =
      `<div class="h-card"><span class="p-name">&lt;script&gt;alert(1)&lt;/script&gt;</span>` +
      `<a class="u-url" href="/about">home</a></div>`;
    stubSources({ [source]: { body: pageLinkingTo(TARGET, card) } });

    const ctx = createExecutionContext();
    await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.57" }),
      context: routeContext(ctx),
    } as never);
    await waitOnExecutionContext(ctx);

    const row = await mentionRow(source);
    expect(row?.status).toBe("pending");
    expect(row?.author_name).toBe("<script>alert(1)</script>");
    /* The relative u-url is RESOLVED against the source, so what is stored is
     * an absolute http(s) URL and never a fragment a render would have to
     * complete. */
    expect(row?.author_url).toBe("https://elsewhere.example/about");
  });
});

describe("/webmention bound 3: one row per source and target", () => {
  it("UPDATES a re-sent mention rather than duplicating it", async () => {
    const source = "https://elsewhere.example/resent";
    stubSources({ [source]: { body: pageLinkingTo(TARGET) } });

    const first = createExecutionContext();
    await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.60" }),
      context: routeContext(first),
    } as never);
    await waitOnExecutionContext(first);
    expect((await mentionRow(source))?.status).toBe("pending");

    /* The second send arrives after the source has stopped linking here, which
     * is the case that matters: the row must be re-decided rather than left
     * carrying a verdict its evidence no longer supports. */
    stubSources({ [source]: { body: pageLinkingTo(`${SITE_ORIGIN}/blog/somewhere-else`) } });
    const second = createExecutionContext();
    const response = await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.60" }),
      context: routeContext(second),
    } as never);
    await waitOnExecutionContext(second);

    expect(response.status).toBe(202);
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM webmentions WHERE source_url = ?1`,
    )
      .bind(source)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);

    const row = await mentionRow(source);
    expect(row?.status).toBe("failed");
    expect(row?.failure_reason).toBe(FAILURE_REASONS.noLink);
    /* The stale excerpt went with the stale verdict. */
    expect(row?.excerpt).toBeNull();
  });
});

describe("the admin plane refuses the smoke actor", () => {
  it("REFUSES a POST carrying the smoke credential before any action runs", async () => {
    /*
     * THE MECHANISM IS THE LAYOUT MIDDLEWARE'S METHOD ALLOWLIST, and this case
     * drives it rather than `/admin/mentions`, because that is where the rule
     * lives. The moderation route deliberately holds no capability read of its
     * own: the `WRITE_CAPABILITIES` table is consulted by `decide()` and
     * `decideDelete()` on the publish path, and none of the mention actions is
     * a publish, so a second check there would be a second owner of one rule.
     *
     * Asserted through the middleware with a real SMOKE_TOKEN and no admin
     * session, which is exactly the state a CI sweep is in. The refusal must
     * arrive BEFORE `next()`, so the child never runs and nothing has read a
     * row by the time it is written.
     */
    const token = "smoke-token-0123456789abcdef0123456789";
    expect(token.length).toBeGreaterThanOrEqual(32);

    const ctx = createExecutionContext();
    const context = routeContext(ctx, { SMOKE_TOKEN: token });
    const request = new Request(`${SITE_ORIGIN}/admin/mentions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        origin: SITE_ORIGIN,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "intent=delete&id=1",
    });

    let childRan = false;
    let thrown: unknown;
    try {
      await (adminMiddleware[0] as never as (
        args: { request: Request; context: RouterContextProvider },
        next: () => Promise<Response>,
      ) => Promise<Response>)({ request, context }, async () => {
        childRan = true;
        return new Response("the child ran");
      });
    } catch (error) {
      thrown = error;
    }

    expect(childRan).toBe(false);
    expect(thrown).toBeInstanceOf(Response);
    const refusal = thrown as Response;
    expect(refusal.status).toBe(403);
    expect(await refusal.text()).toContain(SMOKE_READ_ONLY_POLICY);
  });
});

describe("the moderation queue", () => {
  /** Insert one row directly, so a case can start from a state it chose. */
  async function seedMention(
    sourceUrl: string,
    status: string,
    receivedDaysAgo: number,
  ): Promise<number> {
    const received = Math.floor((Date.now() - receivedDaysAgo * 24 * 60 * 60 * 1000) / 1000);
    await env.DB.prepare(
      `INSERT INTO webmentions (source_url, target_slug, status, received_at, excerpt)
       VALUES (?1, ?2, ?3, ?4, 'An excerpt.')`,
    )
      .bind(sourceUrl, TARGET_SLUG, status, received)
      .run();
    const row = await env.DB.prepare(`SELECT id FROM webmentions WHERE source_url = ?1`)
      .bind(sourceUrl)
      .first<{ id: number }>();
    return row?.id ?? -1;
  }

  function adminPost(body: Record<string, string>) {
    return new Request(`${SITE_ORIGIN}/admin/mentions`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
  }

  async function runAction(body: Record<string, string>) {
    const ctx = createExecutionContext();
    return (await mentionsAction({
      request: adminPost(body),
      context: routeContext(ctx),
    } as never)) as unknown as {
      data: {
        ok?: boolean;
        message?: string;
        confirmDelete?: number;
        confirmSweep?: { failed: number; rejected: number };
      };
    };
  }

  /** The loader, at whatever `?status=` the case wants to ask about. */
  async function runLoader(query = "") {
    const ctx = createExecutionContext();
    return (await mentionsLoader({
      request: new Request(`${SITE_ORIGIN}/admin/mentions${query}`),
      context: routeContext(ctx),
    } as never)) as unknown as {
      data: {
        mentions: Array<{ status: string }>;
        expiring: { failed: number; rejected: number };
        status: string;
      };
    };
  }

  async function statusOf(sourceUrl: string) {
    return (await mentionRow(sourceUrl))?.status ?? null;
  }

  it("A DECISION IS A TWO-WAY DOOR: approve is undone by reject", async () => {
    /*
     * THE CLAIM `check:destructive` CLASSIFIES THESE TWO INTENTS ON. They are
     * listed REVERSIBLE with the reason "undone by reject", and an entry in
     * that map is a judgment nobody has to run. This runs it.
     */
    const source = "https://elsewhere.example/decided";
    const id = await seedMention(source, "pending", 1);

    await runAction({ intent: "approve", id: String(id) });
    expect(await statusOf(source)).toBe("approved");

    await runAction({ intent: "reject", id: String(id) });
    expect(await statusOf(source)).toBe("rejected");

    await runAction({ intent: "approve", id: String(id) });
    expect(await statusOf(source)).toBe("approved");
  });

  it("REFUSES to decide an unverified or failed mention", async () => {
    const unverified = "https://elsewhere.example/still-unverified";
    const failed = "https://elsewhere.example/already-failed";
    const a = await seedMention(unverified, "unverified", 1);
    const b = await seedMention(failed, "failed", 1);

    await runAction({ intent: "approve", id: String(a) });
    await runAction({ intent: "approve", id: String(b) });

    /* Neither moved: one has no evidence yet and the other has evidence
     * against it, and the `where` clause says so rather than the button
     * layout saying it. */
    expect(await statusOf(unverified)).toBe("unverified");
    expect(await statusOf(failed)).toBe("failed");
  });

  it("REFUSES A DELETE WITH NO TYPED CONFIRMATION, in the ACTION", async () => {
    /*
     * `app/lib/destructive.mjs`: a guard that runs in a handler is feedback,
     * not a guard, because with scripting off the handler never runs and the
     * form posts anyway. So the refusal has to be observable HERE, with no
     * browser in the picture at all, which is exactly what this case is.
     */
    const source = "https://elsewhere.example/keep-me";
    const id = await seedMention(source, "rejected", 1);

    const bare = await runAction({ intent: "delete", id: String(id) });
    expect(bare.data.confirmDelete).toBe(id);
    expect(await statusOf(source)).toBe("rejected");

    /* AND A NEAR MISS IS STILL A MISS. "1 " and "01" both read as one to a
     * human and neither satisfies the predicate, which is the whole reason it
     * is a strict string compare rather than Number(). */
    const near = await runAction({ intent: "delete", id: String(id), "confirm-count": "01" });
    expect(near.data.confirmDelete).toBe(id);
    expect(await statusOf(source)).toBe("rejected");
  });

  it("DELETES on the typed confirmation, and the row is gone", async () => {
    const source = "https://elsewhere.example/delete-me";
    const id = await seedMention(source, "rejected", 1);

    const done = await runAction({ intent: "delete", id: String(id), "confirm-count": "1" });
    /* THE ROW FIRST, so a guard whose count drifted fails on the claim that
     * matters with a legible message, rather than on a missing message field. */
    expect(await mentionRow(source)).toBeNull();
    expect(done.data.message).toContain("deleted");
  });

  it("REFUSES A SWEEP WITH NO TYPED CONFIRMATION, and states what is at stake", async () => {
    await seedMention("https://elsewhere.example/old-failure", "failed", 40);
    await seedMention("https://elsewhere.example/old-rejection", "rejected", 100);

    const bare = await runAction({ intent: "sweep" });
    expect(bare.data.confirmSweep).toEqual({ failed: 1, rejected: 1 });

    const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM webmentions`).first<{
      n: number;
    }>();
    expect(count?.n).toBe(2);
  });

  it("SWEEPS ONLY PAST THE WINDOW, and never an open row at any age", async () => {
    /*
     * SIX ROWS STRADDLING BOTH WINDOWS, so the case can fail in both
     * directions: a sweep that took too much removes a recent failure, and one
     * that took too little leaves an old rejection. The two ancient OPEN rows
     * are the assertion that matters most, because expiring them would quietly
     * raise the endpoint's global cap.
     */
    await seedMention("https://elsewhere.example/failed-old", "failed", 40);
    await seedMention("https://elsewhere.example/failed-recent", "failed", 20);
    await seedMention("https://elsewhere.example/rejected-old", "rejected", 100);
    await seedMention("https://elsewhere.example/rejected-recent", "rejected", 60);
    await seedMention("https://elsewhere.example/ancient-pending", "pending", 400);
    await seedMention("https://elsewhere.example/ancient-unverified", "unverified", 400);

    const done = await runAction({ intent: "sweep", "confirm-count": "1" });
    expect(done.data.message).toContain("Removed 1 failed and 1 rejected");

    expect(await mentionRow("https://elsewhere.example/failed-old")).toBeNull();
    expect(await mentionRow("https://elsewhere.example/rejected-old")).toBeNull();
    expect(await statusOf("https://elsewhere.example/failed-recent")).toBe("failed");
    expect(await statusOf("https://elsewhere.example/rejected-recent")).toBe("rejected");
    expect(await statusOf("https://elsewhere.example/ancient-pending")).toBe("pending");
    expect(await statusOf("https://elsewhere.example/ancient-unverified")).toBe("unverified");

    /* An APPROVED row is not swept at any age either: it is the published
     * record, and H2 renders it. */
    await seedMention("https://elsewhere.example/ancient-approved", "approved", 400);
    await runAction({ intent: "sweep", "confirm-count": "1" });
    expect(await statusOf("https://elsewhere.example/ancient-approved")).toBe("approved");
  });

  it("REFUSES an id that is not a positive integer", async () => {
    for (const id of ["", "0", "-3", "abc", "1.5"]) {
      const result = await runAction({ intent: "delete", id, "confirm-count": "1" });
      expect(result.data.message, `id ${JSON.stringify(id)} was not refused`).toContain(
        "not valid",
      );
    }
  });

  /*
   * RULING 21c, AND THIS IS THE LAYER THAT OWNS IT.
   *
   * The page renders a message into `editor-notice` or into `panel-error` on
   * `ok` alone, and `check:admin-ui` asserts that it picks the right box for a
   * DECLARED `ok`. Nothing there runs the action, so nothing there can say the
   * action sets the flag correctly. That is this layer's half, and the two
   * together are what stops a success reappearing in the error box.
   *
   * THE FLAG IS ASSERTED BESIDE THE EFFECT, never on its own: a run that
   * checked `ok === true` and not the row would pass on an action that reported
   * success and did nothing.
   */
  it("MARKS AN OUTCOME ok AND A REFUSAL NOT, so the page can pick the right box", async () => {
    const source = "https://elsewhere.example/flagged";
    const id = await seedMention(source, "pending", 1);

    const approved = await runAction({ intent: "approve", id: String(id) });
    expect(approved.data.ok).toBe(true);
    expect(await statusOf(source)).toBe("approved");

    const rejected = await runAction({ intent: "reject", id: String(id) });
    expect(rejected.data.ok).toBe(true);
    expect(await statusOf(source)).toBe("rejected");

    const swept = await runAction({ intent: "sweep", "confirm-count": "1" });
    expect(swept.data.ok).toBe(true);

    const deleted = await runAction({ intent: "delete", id: String(id), "confirm-count": "1" });
    expect(deleted.data.ok).toBe(true);
    expect(await mentionRow(source)).toBeNull();

    /* THE TWO REFUSALS, and neither may be `ok`. Both carry a message, which is
       exactly why the page cannot classify by reading one. */
    const badIntent = await runAction({ intent: "incinerate" });
    expect(badIntent.data.ok).toBe(false);
    expect(badIntent.data.message).toBeTruthy();

    const badId = await runAction({ intent: "delete", id: "0", "confirm-count": "1" });
    expect(badId.data.ok).toBe(false);
    expect(badId.data.message).toBeTruthy();
  });

  /* A CONFIRMATION STEP IS NEITHER. It carries no message at all, so the page
     renders no box and shows the second step instead, which is the whole
     ceremony `app/lib/destructive.mjs` asks for. */
  it("LEAVES ok UNSET on a confirmation step, so neither box renders", async () => {
    const id = await seedMention("https://elsewhere.example/pending-confirm", "rejected", 1);

    const del = await runAction({ intent: "delete", id: String(id) });
    expect(del.data.ok).toBeUndefined();
    expect(del.data.message).toBeUndefined();
    expect(del.data.confirmDelete).toBe(id);

    const sweep = await runAction({ intent: "sweep" });
    expect(sweep.data.ok).toBeUndefined();
    expect(sweep.data.message).toBeUndefined();
    expect(sweep.data.confirmSweep).toBeTruthy();
  });

  /*
   * RULING 21a's DEFAULT, and it is a loader property rather than a component
   * one: the filter is resolved on the server so the page needs no script and
   * the rendered HTML is the whole answer. `check:admin-ui` DECLARES a status
   * in its fixture, so it cannot see this; only running the loader can.
   */
  it("DEFAULTS TO PENDING when anything is pending, and to all when nothing is", async () => {
    await seedMention("https://elsewhere.example/settled", "approved", 1);

    /* Nothing pending, so the default is the log rather than a quiet line about
       an empty queue. */
    const quiet = await runLoader();
    expect(quiet.data.status).toBe("all");

    await seedMention("https://elsewhere.example/waiting", "pending", 1);
    const busy = await runLoader();
    expect(busy.data.status).toBe("pending");
  });

  it("HONOURS an explicit ?status=, and treats an unrecognised one as absent", async () => {
    await seedMention("https://elsewhere.example/waiting", "pending", 1);

    /* `all` is how a reader asks for everything ON PURPOSE, which is why it
       cannot be the same thing as the parameter being missing. */
    expect((await runLoader("?status=all")).data.status).toBe("all");
    expect((await runLoader("?status=rejected")).data.status).toBe("rejected");

    /* An empty or unknown value falls back to the default rather than to `all`,
       so a truncated link cannot silently widen what is on screen. */
    expect((await runLoader("?status=")).data.status).toBe("pending");
    expect((await runLoader("?status=everything")).data.status).toBe("pending");
  });

  /*
   * THE LOADER HANDS OVER EVERY ROW, and the component filters. That is what
   * makes the chip counts and the list agree by construction: they are derived
   * from one array. A loader that filtered in SQL would have to count in a
   * second query, which is the shape the media library's Unused chip shipped
   * with and got wrong.
   */
  it("RETURNS EVERY ROW INCLUDING UNVERIFIED, whatever the filter says", async () => {
    await seedMention("https://elsewhere.example/a", "pending", 1);
    await seedMention("https://elsewhere.example/b", "unverified", 1);
    await seedMention("https://elsewhere.example/c", "failed", 1);

    for (const query of ["", "?status=pending", "?status=all"]) {
      const result = await runLoader(query);
      expect(result.data.mentions.length, `filter ${JSON.stringify(query)}`).toBe(3);
      expect(result.data.mentions.some((m) => m.status === "unverified")).toBe(true);
    }
  });

  /* The sweep button is LABELLED with this count, so the loader owes it on
     every request rather than only on the confirmation step. */
  it("CARRIES THE EXPIRING COUNT, so the sweep control can name what it removes", async () => {
    const empty = await runLoader();
    expect(empty.data.expiring).toEqual({ failed: 0, rejected: 0 });

    await seedMention("https://elsewhere.example/old-failure", "failed", 40);
    await seedMention("https://elsewhere.example/old-rejection", "rejected", 100);
    await seedMention("https://elsewhere.example/recent-failure", "failed", 20);

    const loaded = await runLoader();
    expect(loaded.data.expiring).toEqual({ failed: 1, rejected: 1 });
  });
});

describe("the post loader carries approved mentions and advertises the endpoint", () => {
  /**
   * The post route's loader, driven directly.
   *
   * OBSERVATION BOUNDARY, and it is narrower than it looks. This layer runs
   * loaders, not React, so what is asserted here is WHICH ROWS reach the
   * component and what the response headers carry. Whether those rows render as
   * escaped text, whether a refused URL renders without an anchor, and whether
   * the section is absent rather than empty are facts about the RENDER, and
   * they are asserted in `check:browser` against a real document built from a
   * seeded row. Splitting them is not a gap: each half is asserted by the only
   * instrument that can see it.
   */

  const POST_SLUG = "a-mentioned-post";

  async function seedApproved(
    sourceUrl: string,
    fields: {
      slug?: string;
      status?: string;
      authorName?: string | null;
      authorUrl?: string | null;
      excerpt?: string | null;
      decidedAt?: number | null;
    } = {},
  ) {
    const decided = fields.decidedAt ?? Math.floor(Date.UTC(2026, 7, 20) / 1000);
    await env.DB.prepare(
      `INSERT INTO webmentions
         (source_url, target_slug, status, author_name, author_url, excerpt, received_at, decided_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
      .bind(
        sourceUrl,
        fields.slug ?? POST_SLUG,
        fields.status ?? "approved",
        fields.authorName ?? "A Reader",
        fields.authorUrl ?? null,
        fields.excerpt ?? "A sentence about the post.",
        decided,
        fields.decidedAt === null ? null : decided,
      )
      .run();
  }

  async function loadPost(slug: string) {
    const ctx = createExecutionContext();
    return blogLoader({
      params: { slug },
      context: routeContext(ctx),
      request: new Request(`${SITE_ORIGIN}/blog/${slug}`),
    } as never);
  }

  it("carries NO mentions when none are approved", async () => {
    /*
     * The absence case, and it is the one most posts are in. Every other status
     * for the same slug is seeded here, so this is not "an empty table returns
     * nothing": it is the predicate refusing four rows that exist.
     */
    await seedApproved("https://elsewhere.example/pending", { status: "pending" });
    await seedApproved("https://elsewhere.example/rejected", { status: "rejected" });
    await seedApproved("https://elsewhere.example/failed", { status: "failed" });
    await seedApproved("https://elsewhere.example/unverified", { status: "unverified" });

    const result = await loadPost(POST_SLUG);
    expect(result.data.mentions).toEqual([]);

    /* SCOPE, ASSERTED. Four rows for this slug exist, so an empty result is the
     * predicate working rather than the seed having failed. */
    const seeded = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM webmentions WHERE target_slug = ?1`,
    )
      .bind(POST_SLUG)
      .first<{ n: number }>();
    expect(seeded?.n).toBe(4);
  });

  it("carries the approved mention, newest decision first", async () => {
    const older = Math.floor(Date.UTC(2026, 7, 1) / 1000);
    const newer = Math.floor(Date.UTC(2026, 7, 20) / 1000);
    await seedApproved("https://elsewhere.example/older", { decidedAt: older });
    await seedApproved("https://elsewhere.example/newer", { decidedAt: newer });
    /* And one of every other status, so the ordering assertion is not also
     * standing in for the filter. */
    await seedApproved("https://elsewhere.example/still-pending", { status: "pending" });

    const result = await loadPost(POST_SLUG);
    expect(result.data.mentions).toHaveLength(2);
    expect(result.data.mentions[0]?.sourceUrl).toBe("https://elsewhere.example/newer");
    expect(result.data.mentions[1]?.sourceUrl).toBe("https://elsewhere.example/older");
    /* The projection is the six columns the render needs and nothing else: a
     * status or a failure reason reaching the client would be moderation state
     * on a public page. */
    expect(Object.keys(result.data.mentions[0] ?? {}).sort()).toEqual([
      "authorName",
      "authorUrl",
      "decidedAt",
      "excerpt",
      "id",
      "sourceUrl",
    ]);
  });

  it("A DRAFT'S APPROVED MENTION IS UNREACHABLE, at the route AND at the reader", async () => {
    /*
     * SEEDED DIRECTLY, because the endpoint cannot produce this row: H1 refuses
     * a draft target at the moment of receipt. What it CAN produce is this row's
     * successor, a post unpublished after its mentions were approved, and that
     * is the ordinary case this covers.
     *
     * BOTH LEVELS, because either alone is a weaker claim. The route 404s, which
     * is the positional guarantee. `approvedMentionsFor` also composes
     * `publiclyVisible()` itself, which is the guarantee that survives somebody
     * calling it from somewhere else.
     */
    await env.DB.prepare(
      `INSERT INTO posts (slug, kind, title, body, status) VALUES (?1, 'post', 'A draft', 'Body.', 'draft')
       ON CONFLICT(slug) DO UPDATE SET status = 'draft'`,
    )
      .bind("a-drafted-post")
      .run();
    await seedApproved("https://elsewhere.example/on-a-draft", { slug: "a-drafted-post" });

    /* The reader refuses it on its own. */
    await expect(approvedMentionsFor(env as never, "a-drafted-post")).resolves.toEqual([]);

    /* And the route never gets that far. */
    let thrown: unknown;
    try {
      await loadPost("a-drafted-post");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeTruthy();
    expect((thrown as { init?: { status?: number } })?.init?.status ?? (thrown as Response)?.status).toBe(404);

    /* SCOPE, ASSERTED. The approved row really is there, so both refusals above
     * are refusals rather than an empty table. */
    const row = await env.DB.prepare(
      `SELECT status FROM webmentions WHERE source_url = 'https://elsewhere.example/on-a-draft'`,
    ).first<{ status: string }>();
    expect(row?.status).toBe("approved");
  });

  it("A SCHEDULED POST'S mentions are refused too, on the same predicate", async () => {
    /*
     * The other half of `publiclyVisible()`. A post published with a future
     * `publish_at` is not draft and is not visible, and a predicate that only
     * checked status would pass this case while leaking it.
     */
    const future = Math.floor((Date.now() + 90 * 24 * 60 * 60 * 1000) / 1000);
    await env.DB.prepare(
      `INSERT INTO posts (slug, kind, title, body, status, publish_at)
       VALUES (?1, 'post', 'Scheduled', 'Body.', 'published', ?2)
       ON CONFLICT(slug) DO UPDATE SET publish_at = excluded.publish_at`,
    )
      .bind("a-scheduled-post", future)
      .run();
    await seedApproved("https://elsewhere.example/on-a-schedule", { slug: "a-scheduled-post" });

    await expect(approvedMentionsFor(env as never, "a-scheduled-post")).resolves.toEqual([]);
  });

  it("ADVERTISES the endpoint in the Link header, beside the markdown twin", async () => {
    const result = await loadPost(POST_SLUG);
    const link = result.init?.headers
      ? new Headers(result.init.headers as HeadersInit).get("Link")
      : null;

    expect(link).toContain(`rel="webmention"`);
    expect(link).toContain(`${SITE_ORIGIN}/webmention`);
    /* BOTH VALUES. The twin has been advertised here since it shipped, and a
     * header that gained the endpoint by replacing it would be a regression
     * nothing else would notice. */
    expect(link).toContain(`rel="alternate"`);
    expect(link).toContain(`/blog/${POST_SLUG}.md`);
    /* One header, two values, comma joined, which is how RFC 8288 spells it. */
    expect(link?.split(", ")).toHaveLength(2);
  });
});
