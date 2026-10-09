import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import { blogFeed, feedResponse, seriesFeed, tagFeed, type FeedFormat } from "~/lib/feed-response";
import { purgePages, purgePosts, purgeProcedures, purgeRegistry } from "~/lib/cache-purge.server";
import { CONTENT_PAGES_CACHE_TAG } from "~/lib/pages/route";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { REGISTRY_CACHE_TAG } from "~/kb/registry/route";
import { cacheTags, SITE_ORIGIN } from "~/lib/seo";
import { loader as llmsFullLoader } from "~/routes/llms-full[.txt]";
import { loader as sitemapLoader } from "~/routes/sitemap";

import { routeContext } from "./route-helpers";

/* A document that can be stored and carries no tag a save purges stays stale until a deploy. These
 * pin that the sitemap, every feed and llms-full carry the tags the two purges send. */

/* The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one. */
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const tagsOf = (response: Response) =>
  (response.headers.get("cache-tag") ?? "").split(",").filter(Boolean);

async function sitemap() {
  return (await sitemapLoader({
    request: new Request(`${SITE_ORIGIN}/sitemap.xml`),
    params: {},
    context: routeContext(),
  } as never)) as Response;
}

async function llmsFull() {
  return (await llmsFullLoader({
    request: new Request(`${SITE_ORIGIN}/llms-full.txt`),
    params: {},
    context: routeContext(),
  } as never)) as Response;
}

/** Tags handed to `cache.purge` by `run`. */
async function purgedBy(run: () => Promise<unknown>): Promise<string[]> {
  purge.mockClear();
  await run();
  return purge.mock.calls.flatMap(([options]) => options.tags);
}

describe("the cache tags of the machine documents", () => {
  it("the sitemap carries posts, procedures, pages and the registry, and each purge reaches it", async () => {
    const tags = tagsOf(await sitemap());
    expect(tags).toEqual([cacheTags(), PROCEDURES_CACHE_TAG, CONTENT_PAGES_CACHE_TAG, REGISTRY_CACHE_TAG]);

    const postsPurge = await purgedBy(() => purgePosts("test"));
    const proceduresPurge = await purgedBy(() => purgeProcedures("test"));
    expect(tags.some((tag) => postsPurge.includes(tag))).toBe(true);
    expect(tags.some((tag) => proceduresPurge.includes(tag))).toBe(true);
    const pagesPurge = await purgedBy(() => purgePages("test"));
    expect(tags.some((tag) => pagesPurge.includes(tag))).toBe(true);
    // The sitemap lists the registry's items, so a registry save must reach it.
    const registryPurge = await purgedBy(() => purgeRegistry("test"));
    expect(tags.some((tag) => registryPurge.includes(tag))).toBe(true);
  });

  it("llms-full carries posts, and a posts purge reaches it", async () => {
    const tags = tagsOf(await llmsFull());
    expect(tags).toEqual([cacheTags()]);
    const postsPurge = await purgedBy(() => purgePosts("test"));
    expect(tags.some((tag) => postsPurge.includes(tag))).toBe(true);
  });

  it("every feed format, for the blog, a tag and a series, carries posts", async () => {
    const scopes = [blogFeed, tagFeed({ slug: "d1", name: "D1" }), seriesFeed({ name: "A series" })];
    const postsPurge = await purgedBy(() => purgePosts("test"));
    for (const scope of scopes) {
      for (const format of ["json", "rss", "atom"] as FeedFormat[]) {
        const tags = tagsOf(await feedResponse(env as never, format, scope));
        expect(tags, `${scope.path} ${format}`).toEqual([cacheTags()]);
        expect(tags.some((tag) => postsPurge.includes(tag))).toBe(true);
      }
    }
  });
});
