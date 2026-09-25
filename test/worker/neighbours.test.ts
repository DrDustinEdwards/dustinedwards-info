import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { getBlogPost } from "~/db";

import { seedPost } from "./seed";

/* Two posts can share a publish_at (a date-only schedule lands both at midnight). The neighbours
 * follow the listing's order, publish_at then id, so neither skips the other. */

const AT = Math.floor(Date.UTC(2025, 5, 1) / 1000);

const seed = (slug: string, publishAt: number) => seedPost(slug, { publishAt });

describe("getBlogPost neighbours", () => {
  it("LINKS TWO POSTS THAT SHARE A PUBLISH_AT to each other, in the listing's order", async () => {
    await seed("tie-before", AT - 86_400);
    await seed("tie-first", AT);
    await seed("tie-second", AT);
    await seed("tie-after", AT + 86_400);
    const db = env as unknown as Parameters<typeof getBlogPost>[0];

    const first = await getBlogPost(db, "tie-first");
    const second = await getBlogPost(db, "tie-second");

    expect(first?.previous?.slug).toBe("tie-before");
    expect(first?.next?.slug).toBe("tie-second");
    expect(second?.previous?.slug).toBe("tie-first");
    expect(second?.next?.slug).toBe("tie-after");
  });
});
