import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runTool } from "~/lib/operator/api.server";

import { post } from "./fixtures";
import { putSource, removeSource, stubSources, type SourceStub } from "./source-stub";

/* sync_posts refuses a content/posts listing with no markdown instead of deleting every post row, as the
 * other kinds' syncs do (Grok audit 2026-10-21, DE-1). */

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const SLUG = "posts-sync-empty-listing";
const PATH = `content/posts/${SLUG}.md`;

const rowFor = (slug: string) =>
  env.DB.prepare("SELECT slug FROM posts WHERE slug = ?1").bind(slug).first<{ slug: string }>();
const sync = () => runTool(operatorEnv(), operator, "sync_posts", {});

let gh: SourceStub;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM posts WHERE slug = ?1").bind(SLUG).run();
  gh = await stubSources({ [PATH]: post(SLUG) });
});

afterEach(async () => {
  await gh.restore();
});

describe("sync_posts", () => {
  it("REFUSES an empty file set instead of deleting every row", { timeout: 240_000 }, async () => {
    const first = await sync();
    expect(first.ok, JSON.stringify(first)).toBe(true);
    expect(await rowFor(SLUG)).not.toBeNull();

    // The directory lists, but holds no post: a fault, not a site with none.
    await removeSource(PATH);
    await putSource("content/posts/README.txt", "not a post");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await rowFor(SLUG)).not.toBeNull();
  });
});
