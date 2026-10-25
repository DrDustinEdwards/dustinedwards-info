import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { getBlogPost, listBlogPosts, listHomeStartHere } from "~/db";

import { seedPost } from "./seed";

/* Posts of one series that share a publish_at (three parts published the same day) list latest part first,
 * whatever order their rows were inserted in; every other tie keeps the later row first. The rule is
 * app/lib/post-order.mjs, and test/post-order.test.mjs states it in JS. */

const DAY = Math.floor(Date.UTC(2025, 8, 4) / 1000);
const db = env as unknown as Parameters<typeof listBlogPosts>[0];

describe("the listing order for posts that share an instant", () => {
  it("LISTS A SERIES' PARTS LATEST FIRST, kept together among the day's other posts", async () => {
    // Inserted in slug order, as the build does, so ids rise a, ai, one: the old order was one, ai, a.
    await seedPost("ord-older", { publishAt: DAY - 86_400 });
    await seedPost("ord-a-part1", { publishAt: DAY, series: "Ord", part: 1 });
    await seedPost("ord-ai-part3", { publishAt: DAY, series: "Ord", part: 3 });
    await seedPost("ord-one-part2", { publishAt: DAY, series: "Ord", part: 2 });
    await seedPost("ord-plain", { publishAt: DAY });

    const { posts } = await listBlogPosts(db, { perPage: 50 });
    const slugs = posts.map((p) => p.slug).filter((slug) => slug.startsWith("ord-"));
    expect(slugs).toEqual(["ord-plain", "ord-ai-part3", "ord-one-part2", "ord-a-part1", "ord-older"]);

    const home = await listHomeStartHere(db, { cards: 50 });
    const homeSlugs = [...(home.featured ? [home.featured] : []), ...home.recent].map((p) => p.slug).filter((slug) => slug.startsWith("ord-"));
    expect(homeSlugs).toEqual(slugs);
  });

  it("MAKES THE PARTS' PREVIOUS AND NEXT FOLLOW THAT ORDER", async () => {
    // A year of its own, so the other cases' rows are not this one's neighbors.
    const at = DAY - 365 * 86_400;
    await seedPost("nb-before", { publishAt: at - 86_400 });
    await seedPost("nb-a-part1", { publishAt: at, series: "Nb", part: 1 });
    await seedPost("nb-ai-part3", { publishAt: at, series: "Nb", part: 3 });
    await seedPost("nb-one-part2", { publishAt: at, series: "Nb", part: 2 });
    await seedPost("nb-after", { publishAt: at + 86_400 });

    const part3 = await getBlogPost(db, "nb-ai-part3");
    const part2 = await getBlogPost(db, "nb-one-part2");
    const part1 = await getBlogPost(db, "nb-a-part1");
    expect([part3?.next?.slug, part3?.previous?.slug]).toEqual(["nb-after", "nb-one-part2"]);
    expect([part2?.next?.slug, part2?.previous?.slug]).toEqual(["nb-ai-part3", "nb-a-part1"]);
    expect([part1?.next?.slug, part1?.previous?.slug]).toEqual(["nb-one-part2", "nb-before"]);
  });

  it("KEEPS TWO SERIES OF ONE DAY APART, each among the day's plain posts by its newest row, whatever is dated later", async () => {
    // A year of its own. Ids rise in the order seeded; the later day's series post has the highest series id.
    const day = DAY - 2 * 365 * 86_400;
    await seedPost("g-plain-1", { publishAt: day });
    await seedPost("g-a1", { publishAt: day, series: "GA", part: 1 });
    await seedPost("g-a2", { publishAt: day, series: "GA", part: 2 });
    await seedPost("g-plain-2", { publishAt: day });
    await seedPost("g-b1", { publishAt: day, series: "GB", part: 1 });
    await seedPost("g-b2", { publishAt: day, series: "GB", part: 2 });
    await seedPost("g-plain-3", { publishAt: day });
    await seedPost("g-c1", { publishAt: day + 86_400, series: "GC", part: 1 });

    const { posts } = await listBlogPosts(db, { perPage: 100 });
    const slugs = posts.map((p) => p.slug).filter((slug) => slug.startsWith("g-"));
    expect(slugs).toEqual(["g-c1", "g-plain-3", "g-b2", "g-b1", "g-plain-2", "g-a2", "g-a1", "g-plain-1"]);
  });
});
