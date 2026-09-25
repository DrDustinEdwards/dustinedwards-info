import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SITE_ORIGIN } from "~/lib/seo";
import { FAILURE_REASONS, inspectSource } from "~/lib/webmention/verify.server";
import { action as webmentionAction, loader as webmentionLoader } from "~/routes/webmention";

import { freezeAtWindowStart, routeContext, untilRefused } from "./route-helpers";
import { seedPost } from "./seed";
import { mentionRow, resetMentions, TARGET, TARGET_SLUG } from "./webmention-fixtures";

/* Every case carries its own client IP: `clientIp` falls back to `unknown` off the edge, so
 * cases would otherwise share one `wm:unknown` rate-limit instance. */

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

type StubPage =
  | { body: string; contentType?: string; status?: number }
  | { networkError: true }
  | { redirect: string };

/* A URL with no recorded page throws rather than reaching the network. `gate` holds serving
 * so a case can observe the row BEFORE verification overwrites it. */
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
    if ("redirect" in page) {
      return new Response(null, { status: 302, headers: { location: page.redirect } });
    }
    return new Response(page.body, {
      status: page.status ?? 200,
      headers: { "content-type": page.contentType ?? "text/html; charset=utf-8" },
    });
  });
}

const pageLinkingTo = (href: string, extra = "") =>
  `<!doctype html><html><body>${extra}<p>I read <a href="${href}">this post</a> today and it was useful.</p></body></html>`;

beforeEach(resetMentions);

afterEach(() => {
  /* Restored here, not per case: a case that fails mid-assertion never reaches its own
   * cleanup, and a frozen clock would fail whatever ran next. */
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
    /* A declared length is useful only for refusing early, never for permitting. The header below lies. */
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
    /* An unprotected public write path does not serve unmetered; it does not serve. */
    const response = await webmentionAction({
      request: wm(form("https://elsewhere.example/a", TARGET), { ip: "203.0.113.15" }),
      context: routeContext(createExecutionContext(), { ASK_BUDGET: undefined }),
    } as never);

    expect(response.status).toBe(503);
  });
});

describe("/webmention bound 1: the per-IP rate limit", () => {
  it("REFUSES past 20 per 60 seconds, with a Retry-After to hand back", async () => {
    /* The clock is frozen: `AskBudget.hit` keys on a FIXED window. The target is one this site
     * lacks, so each request spends its rate unit and stops at 400 before touching D1. */
    freezeAtWindowStart();

    const ctx = createExecutionContext();
    const context = routeContext(ctx);
    const { refusal, results } = await untilRefused(
      () =>
        webmentionAction({
          request: wm(form("https://elsewhere.example/a", "https://elsewhere.example/not-here"), {
            ip: "203.0.113.20",
          }),
          context,
        } as never),
      (response) => response.status === 429,
      40,
    );

    expect(refusal).not.toBeNull();
    expect(results.filter((response) => response.status !== 429)).toHaveLength(20);
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
    /* A 400 that told a draft from an unknown slug would let a caller enumerate unpublished
     * slugs from the refusals, so the two are compared on the wire. */
    await seedPost("an-unpublished-draft", { status: "draft" });

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

    /* The draft is really there, so this is not passing on a seed that silently failed. */
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
  });
});

describe("/webmention bound 4: the global cap on open rows", () => {
  it("answers 503 at the cap and writes nothing more", async () => {
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
    /* Verification runs in `ctx.waitUntil`; the gate holds the stub so the row is observed
     * before the verdict write, instead of racing the assertion. */
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
    expect(row?.excerpt).toBe("I read this post today and it was useful.");
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
    /* The link IS on the page, or this would pass on `no-link`, which is also a failure. */
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

  it("FOLLOWS a redirect to another public page and verifies the page it lands on", async () => {
    const source = "https://elsewhere.example/moved";
    const landed = "https://elsewhere.example/moved-here";
    stubSources({ [source]: { redirect: "/moved-here" }, [landed]: { body: pageLinkingTo(TARGET) } });

    const ctx = createExecutionContext();
    await webmentionAction({
      request: wm(form(source, TARGET), { ip: "203.0.113.58" }),
      context: routeContext(ctx),
    } as never);
    await waitOnExecutionContext(ctx);

    expect((await mentionRow(source))?.status).toBe("pending");
  });

  it("REFUSES a redirect to a loopback name or an IP literal, which the first URL could not name", async () => {
    for (const [index, hop] of ["http://localhost/admin", "http://169.254.169.254/latest"].entries()) {
      const source = `https://elsewhere.example/bounce-${index}`;
      /* The hop has no recorded page, so reaching it would throw inside the stub. */
      stubSources({ [source]: { redirect: hop } });

      const ctx = createExecutionContext();
      await webmentionAction({
        request: wm(form(source, TARGET), { ip: `203.0.113.${70 + index}` }),
        context: routeContext(ctx),
      } as never);
      await waitOnExecutionContext(ctx);

      expect((await mentionRow(source))?.failure_reason).toBe(FAILURE_REASONS.redirectRefused);
    }
  });

  it("REFUSES a redirect onto the canonical origin when the target names the other host", async () => {
    /* Before the cutover the route accepts targets on the request's host too, so a hop back to
     * SITE_ORIGIN must be refused even when the target's own origin is a different one. */
    const source = "https://elsewhere.example/to-canonical";
    stubSources({ [source]: { redirect: `${SITE_ORIGIN}/blog/${TARGET_SLUG}` } });
    const verdict = await inspectSource(source, `https://other-host.example/blog/${TARGET_SLUG}`);
    expect(verdict).toEqual({ status: "failed", failureReason: FAILURE_REASONS.redirectRefused });
  });

  it("STORES A SCRIPT-SHAPED AUTHOR NAME AS THAT LITERAL TEXT", async () => {
    /* Hostile h-card: it must be stored as the CHARACTERS, unexecuted and unstripped. The source
     * entity-encodes it so `textContent` yields the literal string, as a real hostile page would. */
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

    /* The source has stopped linking here, so the row must be re-decided, not left stale. */
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
    expect(row?.excerpt).toBeNull();
  });
});

describe("/webmention on a body stream that breaks", () => {
  it("answers 400, not a 500, and stores nothing", async () => {
    const before = await env.DB.prepare(`SELECT COUNT(*) AS n FROM webmentions`).first<{ n: number }>();
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("source=https%3A%2F%2Felsewhere"));
        controller.error(new Error("planted stream failure"));
      },
    });
    const ctx = createExecutionContext();
    const response = await webmentionAction({
      request: new Request(`${SITE_ORIGIN}/webmention`, {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.77",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: broken,
      }),
      context: routeContext(ctx),
    } as never);

    expect(response.status).toBe(400);
    const after = await env.DB.prepare(`SELECT COUNT(*) AS n FROM webmentions`).first<{ n: number }>();
    expect(after?.n).toBe(before?.n);
  });
});
