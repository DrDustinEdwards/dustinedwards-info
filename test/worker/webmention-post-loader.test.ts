import { createExecutionContext, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { approvedMentionsFor } from "~/db";
import { SITE_ORIGIN } from "~/lib/seo";
import { loader as blogLoader } from "~/routes/blog.$slug";

import { routeContext } from "./route-helpers";
import { seedMention as seedMentionRow, seedPost } from "./seed";
import { resetMentions } from "./webmention-fixtures";

beforeEach(resetMentions);

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
