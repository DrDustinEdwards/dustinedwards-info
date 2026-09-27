import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { EDGE_CACHE_CONTROL, EDGE_CACHE_HEADER, SITE_ORIGIN } from "~/lib/seo";
import { headers as blogIndexHeaders, loader as blogIndexLoader } from "~/routes/blog._index";

import { routeContext } from "./route-helpers";
import { seedPost } from "./seed";

/* A scheduled post goes live when its publish_at passes, and nothing purges then. So /writing must
 * expire at that moment, not a day after it was rendered, or the edge keeps a list without it. */

/** The edge header /writing would leave the route with: its loader, then its headers(). */
async function writingEdgePolicy() {
  const result = await blogIndexLoader({
    request: new Request(`${SITE_ORIGIN}/writing`),
    params: {},
    context: routeContext(),
  } as never);
  const out = blogIndexHeaders({
    loaderHeaders: new Headers(result.init?.headers),
  } as never);
  return out.get(EDGE_CACHE_HEADER);
}

const maxAge = (header: string | null) => Number(/\bmax-age=(\d+)/.exec(header ?? "")?.[1]);

describe("the edge lifetime of /writing around a scheduled post", () => {
  it("WITH NOTHING SCHEDULED is the plain policy the Renderer stamps by default", async () => {
    await seedPost("edge-live-post");
    expect(await writingEdgePolicy()).toBe(EDGE_CACHE_CONTROL);
  });

  it("A POST FIVE MINUTES OUT caps it at about five minutes", async () => {
    const slug = "edge-scheduled-post";
    await seedPost(slug, { publishAt: Math.floor(Date.now() / 1000) + 300 });
    try {
      const age = maxAge(await writingEdgePolicy());
      expect(age).toBeGreaterThanOrEqual(295);
      expect(age).toBeLessThanOrEqual(300);
    } finally {
      await env.DB.prepare("DELETE FROM posts WHERE slug = ?1").bind(slug).run();
    }
    /* The control: with it gone the page is back on the plain policy. */
    expect(await writingEdgePolicy()).toBe(EDGE_CACHE_CONTROL);
  });
});
