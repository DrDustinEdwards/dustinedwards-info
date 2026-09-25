import { describe, expect, it } from "vitest";

import { combinePurges, purgePost, purgePosts } from "~/lib/cache-purge.server";

describe("a purge outcome", () => {
  it("is null, SKIPPED, on a runtime with no purge API, never false", async () => {
    /* Miniflare has no purge API: this is the local and test case that used to read as a failure. */
    expect(await purgePosts("test")).toBeNull();
    expect(await purgePost("a-post", "test")).toBeNull();
  });

  it("combines as failed on any failure, done only when all are done, skipped otherwise", () => {
    expect(combinePurges(true, true)).toBe(true);
    expect(combinePurges(true, false)).toBe(false);
    expect(combinePurges(null, false)).toBe(false);
    expect(combinePurges(true, null)).toBeNull();
    expect(combinePurges(null, null)).toBeNull();
  });
});
