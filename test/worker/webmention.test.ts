import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { approvedMentionsFor } from "~/db";
import { adminActorContext } from "~/lib/auth.server";
import { CONFIRM_FIELD } from "~/lib/destructive.mjs";
import { SMOKE_READ_ONLY_POLICY } from "~/lib/editor/publish-policy.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { FAILURE_REASONS, inspectSource } from "~/lib/webmention/verify.server";
import { middleware as adminMiddleware } from "~/routes/admin";
import AdminMentions, {
  action as mentionsAction,
  loader as mentionsLoader,
} from "~/routes/admin.mentions";
import { action as webmentionAction, loader as webmentionLoader } from "~/routes/webmention";
import { loader as blogLoader } from "~/routes/blog.$slug";

import {
  freezeAtWindowStart,
  renderRoute,
  routeContext,
  textsOf,
  throughMiddleware,
  untilRefused,
} from "./route-helpers";
import { seedMention as seedMentionRow, seedPost } from "./seed";

/* Every case carries its own client IP: `clientIp` falls back to `unknown` off the edge, so
 * cases would otherwise share one `wm:unknown` rate-limit instance. */

const TARGET_SLUG = "a-mentioned-post";
const TARGET = `${SITE_ORIGIN}/blog/${TARGET_SLUG}`;

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

function seedMention(sourceUrl: string, status: string, receivedDaysAgo: number): Promise<number> {
  const receivedAt = Math.floor((Date.now() - receivedDaysAgo * 24 * 60 * 60 * 1000) / 1000);
  return seedMentionRow(sourceUrl, TARGET_SLUG, { status, receivedAt });
}

function renderMentionsPage(url: string, loaderData: unknown, actionData?: unknown) {
  return renderRoute("/admin/mentions", AdminMentions, { loaderData, actionData }, url);
}

beforeEach(async () => {
  /* Emptied between cases: D1 persists for the whole file and the global-cap case asserts an
   * exact count. */
  await env.DB.prepare(`DELETE FROM webmentions`).run();
  await seedPost(TARGET_SLUG);
});

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

  it("ANSWERS 400 WHEN THE REQUEST BODY BREAKS MID-READ, never a 500", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("source=https://a.example/"));
        controller.error(new Error("planted connection reset"));
      },
    });
    const request = new Request(`${SITE_ORIGIN}/webmention`, {
      method: "POST",
      headers: {
        "cf-connecting-ip": "203.0.113.90",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const response = await webmentionAction({
      request,
      context: routeContext(createExecutionContext()),
    } as never);
    expect(response.status).toBe(400);
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

describe("the admin plane refuses the smoke actor", () => {
  async function throughAdminStack(request: Request, context: ReturnType<typeof routeContext>) {
    try {
      return await throughMiddleware(adminMiddleware, mentionsAction, {
        request,
        context,
        params: {},
      } as never);
    } catch (thrown) {
      return thrown;
    }
  }

  it("REFUSES a POST carrying the smoke credential, and the row survives", async () => {
    const source = "https://elsewhere.example/smoke-target";
    const id = await seedMention(source, "rejected", 1);

    const token = "smoke-token-0123456789abcdef0123456789";
    const ctx = createExecutionContext();
    const request = new Request(`${SITE_ORIGIN}/admin/mentions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        origin: SITE_ORIGIN,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ intent: "delete", id: String(id), [CONFIRM_FIELD]: "1" }),
    });

    const outcome = await throughAdminStack(request, routeContext(ctx, { SMOKE_TOKEN: token }));

    expect(outcome).toBeInstanceOf(Response);
    const refusal = outcome as Response;
    expect(refusal.status).toBe(403);
    expect(await refusal.text()).toContain(SMOKE_READ_ONLY_POLICY);
    expect(await mentionRow(source)).not.toBeNull();
  });
});

describe("the moderation queue", () => {
  function adminPost(body: Record<string, string>) {
    return new Request(`${SITE_ORIGIN}/admin/mentions`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
  }

  async function runAction(body: Record<string, string>) {
    const ctx = createExecutionContext();
    /* The admin layout sets the actor; the action hands it to `decideMention` for the policy checks. */
    const context = routeContext(ctx);
    context.set(adminActorContext, { kind: "admin", email: "admin@example.com" });
    return (await mentionsAction({
      request: adminPost(body),
      context,
    } as never)) as unknown as {
      data: {
        ok?: boolean;
        message?: string;
        confirmDelete?: number;
        confirmSweep?: { failed: number; rejected: number };
      };
    };
  }

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
    /* `check:destructive` lists these intents REVERSIBLE ("undone by reject"); this runs that claim. */
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

    const first = await runAction({ intent: "approve", id: String(a) });
    const second = await runAction({ intent: "approve", id: String(b) });

    expect(await statusOf(unverified)).toBe("unverified");
    expect(await statusOf(failed)).toBe("failed");
    /* Nothing moved, so the page must not say "approved". */
    for (const result of [first, second]) {
      expect(result.data.ok).toBe(false);
      expect(result.data.message).toMatch(/^Nothing changed/);
    }
  });

  it("REFUSES A DELETE WITH NO TYPED CONFIRMATION, in the ACTION", async () => {
    /* With scripting off the handler never runs and the form posts anyway, so the refusal
     * must be observable in the action itself. */
    const source = "https://elsewhere.example/keep-me";
    const id = await seedMention(source, "rejected", 1);

    const bare = await runAction({ intent: "delete", id: String(id) });
    expect(bare.data.confirmDelete).toBe(id);
    expect(await statusOf(source)).toBe("rejected");

    /* "1 " and "01" both read as one to a human, so the predicate is a strict string compare. */
    const near = await runAction({ intent: "delete", id: String(id), "confirm-count": "01" });
    expect(near.data.confirmDelete).toBe(id);
    expect(await statusOf(source)).toBe("rejected");
  });

  it("DELETES on the typed confirmation, and the row is gone", async () => {
    const source = "https://elsewhere.example/delete-me";
    const id = await seedMention(source, "rejected", 1);

    const done = await runAction({ intent: "delete", id: String(id), "confirm-count": "1" });
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
    /* Expiring an ancient OPEN row would quietly raise the endpoint's global cap. */
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

    /* An APPROVED row is the published record and is not swept at any age. */
    await seedMention("https://elsewhere.example/ancient-approved", "approved", 400);
    await runAction({ intent: "sweep", "confirm-count": "1" });
    expect(await statusOf("https://elsewhere.example/ancient-approved")).toBe("approved");
  });

  it("REFUSES an id that is not a positive integer, and deletes nothing", async () => {
    const source = "https://elsewhere.example/near-miss-id";
    const id = await seedMention(source, "rejected", 1);

    for (const bad of ["", "0", `-${id}`, `${id}.5`, `${id}abc`]) {
      const result = await runAction({ intent: "delete", id: bad, [CONFIRM_FIELD]: "1" });
      expect(result.data.ok, `id ${JSON.stringify(bad)} was not refused`).toBe(false);
      expect(await statusOf(source), `id ${JSON.stringify(bad)} reached the row`).toBe("rejected");
    }
  });

  /* Rendering runs no action, so only this layer can see the `ok` flag. It is asserted beside
   * the effect, or an action that reported success and did nothing would pass. */
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

    /* Both refusals carry a message too, so the page cannot classify by reading one. */
    const badIntent = await runAction({ intent: "incinerate" });
    expect(badIntent.data.ok).toBe(false);
    expect(badIntent.data.message).toBeTruthy();

    const badId = await runAction({ intent: "delete", id: "0", "confirm-count": "1" });
    expect(badId.data.ok).toBe(false);
    expect(badId.data.message).toBeTruthy();
  });

  it("A CONFIRMATION STEP renders the second step, no outcome, and keeps the rows", async () => {
    const source = "https://elsewhere.example/pending-confirm";
    const id = await seedMention(source, "rejected", 1);
    await seedMention("https://elsewhere.example/expired-failure", "failed", 40);

    const steps: Record<string, string>[] = [{ intent: "delete", id: String(id) }, { intent: "sweep" }];
    for (const body of steps) {
      const step = await runAction(body);
      const page = renderMentionsPage(
        "/admin/mentions",
        (await runLoader()).data,
        step.data,
      );

      expect(await textsOf(page, "[role=status]"), body.intent).toEqual([]);
      expect(await textsOf(page, `input[name="${CONFIRM_FIELD}"]`), body.intent).toHaveLength(1);
    }
    expect(await statusOf(source)).toBe("rejected");
    expect(await statusOf("https://elsewhere.example/expired-failure")).toBe("failed");
  });

  /* The filter is resolved on the server so the page needs no script; only the loader can see it. */
  it("DEFAULTS TO PENDING when anything is pending, and to all when nothing is", async () => {
    await seedMention("https://elsewhere.example/settled", "approved", 1);

    const quiet = await runLoader();
    expect(quiet.data.status).toBe("all");

    await seedMention("https://elsewhere.example/waiting", "pending", 1);
    const busy = await runLoader();
    expect(busy.data.status).toBe("pending");
  });

  it("HONOURS an explicit ?status=, and treats an unrecognised one as absent", async () => {
    await seedMention("https://elsewhere.example/waiting", "pending", 1);

    expect((await runLoader("?status=all")).data.status).toBe("all");
    expect((await runLoader("?status=rejected")).data.status).toBe("rejected");

    /* An empty or unknown value falls back to the default rather than to `all`, so a
       truncated link cannot silently widen what is on screen. */
    expect((await runLoader("?status=")).data.status).toBe("pending");
    expect((await runLoader("?status=everything")).data.status).toBe("pending");
  });

  it("EVERY CHIP COUNTS THE ROWS ITS FILTER LISTS, and pending lists the pending rows", async () => {
    await seedMention("https://elsewhere.example/p1", "pending", 1);
    await seedMention("https://elsewhere.example/p2", "pending", 1);
    await seedMention("https://elsewhere.example/u1", "unverified", 1);
    await seedMention("https://elsewhere.example/f1", "failed", 1);
    await seedMention("https://elsewhere.example/a1", "approved", 1);

    const renderAt = async (query: string) =>
      renderMentionsPage(`/admin/mentions${query}`, (await runLoader(query)).data);
    const chipsOf = async (page: string) =>
      Object.fromEntries(
        (await textsOf(page, ".mention-filters a")).map((chip) => {
          const [, label, count] = /^(.*) (\d+)$/.exec(chip) ?? [];
          return [label ?? chip, Number(count)];
        }),
      );

    const pending = await renderAt("?status=pending");
    expect(await chipsOf(pending)).toEqual({
      Pending: 2,
      Failed: 1,
      Approved: 1,
      Rejected: 0,
      All: 5,
    });
    expect((await textsOf(pending, ".mention-source")).sort()).toEqual([
      "https://elsewhere.example/p1",
      "https://elsewhere.example/p2",
    ]);

    for (const [filter, label] of [
      ["pending", "Pending"],
      ["failed", "Failed"],
      ["approved", "Approved"],
      ["rejected", "Rejected"],
      ["all", "All"],
    ] as const) {
      const page = await renderAt(`?status=${filter}`);
      const chips = await chipsOf(page);
      expect(await textsOf(page, ".mention-source"), filter).toHaveLength(chips[label] ?? -1);
    }
  });

  /* The sweep button is labelled with this count, so the loader owes it on every request. */
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
  /* This layer runs loaders, not React: which rows reach the component is asserted here, and
   * how they render is asserted in `check:browser`. */
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
    await seedMentionRow(sourceUrl, fields.slug ?? POST_SLUG, {
      status: fields.status ?? "approved",
      authorName: fields.authorName ?? "A Reader",
      authorUrl: fields.authorUrl ?? null,
      excerpt: fields.excerpt ?? "A sentence about the post.",
      receivedAt: decided,
      decidedAt: fields.decidedAt === null ? null : decided,
    });
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
    /* Every other status is seeded, so this is the predicate refusing four rows that exist. */
    await seedApproved("https://elsewhere.example/pending", { status: "pending" });
    await seedApproved("https://elsewhere.example/rejected", { status: "rejected" });
    await seedApproved("https://elsewhere.example/failed", { status: "failed" });
    await seedApproved("https://elsewhere.example/unverified", { status: "unverified" });

    const result = await loadPost(POST_SLUG);
    expect(result.data.mentions).toEqual([]);

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
    /* One of another status, so the ordering assertion is not also standing in for the filter. */
    await seedApproved("https://elsewhere.example/still-pending", { status: "pending" });

    const result = await loadPost(POST_SLUG);
    expect(result.data.mentions).toHaveLength(2);
    expect(result.data.mentions[0]?.sourceUrl).toBe("https://elsewhere.example/newer");
    expect(result.data.mentions[1]?.sourceUrl).toBe("https://elsewhere.example/older");
    /* A status or failure reason reaching the client would be moderation state on a public
     * page. */
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
    /* Seeded directly: the endpoint refuses a draft target, but a post unpublished after its
     * mentions were approved reaches this state. */
    await seedPost("a-drafted-post", { status: "draft", publishAt: null });
    await seedApproved("https://elsewhere.example/on-a-draft", { slug: "a-drafted-post" });

    await expect(approvedMentionsFor(env as never, "a-drafted-post")).resolves.toEqual([]);

    let thrown: unknown;
    try {
      await loadPost("a-drafted-post");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeTruthy();
    expect((thrown as { init?: { status?: number } })?.init?.status ?? (thrown as Response)?.status).toBe(404);

    const row = await env.DB.prepare(
      `SELECT status FROM webmentions WHERE source_url = 'https://elsewhere.example/on-a-draft'`,
    ).first<{ status: string }>();
    expect(row?.status).toBe("approved");
  });

  it("A SCHEDULED POST'S mentions are refused too, on the same predicate", async () => {
    /* A predicate that only checked status would pass this case while leaking it. */
    const future = Math.floor((Date.now() + 90 * 24 * 60 * 60 * 1000) / 1000);
    await seedPost("a-scheduled-post", { publishAt: future });
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
    /* A header that gained the endpoint by replacing the twin would be a silent regression. */
    expect(link).toContain(`rel="alternate"`);
    expect(link).toContain(`/blog/${POST_SLUG}.md`);
    /* One header, two values, comma joined, which is how RFC 8288 spells it. */
    expect(link?.split(", ")).toHaveLength(2);
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
