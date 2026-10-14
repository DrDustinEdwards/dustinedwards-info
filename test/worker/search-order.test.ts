import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { search } from "~/lib/search/search.server";

import { seedPost } from "./seed";

/* Browse (a filter with no words) lists newest first by the same rule as /writing (app/lib/post-order.mjs):
 * a series of one day stays together, latest part first. The search index has its own row ids, so the rule
 * reads the posts table through the post's address. */

const AT = Math.floor(Date.UTC(2022, 5, 1) / 1000);

async function indexPost(slug: string) {
  const url = `/writing/${slug}`;
  await env.DB.prepare(
    `INSERT INTO search_docs (uid, url, type, title, body, doc_uid, doc_title, doc_url, status, publish_at)
     VALUES (?1, ?2, 'post', ?3, 'A body.', ?1, ?3, ?2, 'published', ?4)`,
  )
    .bind(`post:${slug}`, url, `Title ${slug}`, AT)
    .run();
}

describe("search browse order", () => {
  it("LISTS A SERIES' PARTS LATEST FIRST for posts that share a day", async () => {
    // Posts rows in one order, search rows in another, so neither id space is the answer by accident.
    await seedPost("so-plain", { publishAt: AT });
    await seedPost("so-part1", { publishAt: AT, series: "SO", part: 1 });
    await seedPost("so-part2", { publishAt: AT, series: "SO", part: 2 });
    await indexPost("so-part1");
    await indexPost("so-part2");
    await indexPost("so-plain");

    const result = await search(env as unknown as Parameters<typeof search>[0], { q: "", type: "post", year: "2022" });
    expect(result.hits.map((hit) => hit.url)).toEqual(["/writing/so-part2", "/writing/so-part1", "/writing/so-plain"]);
  });
});
