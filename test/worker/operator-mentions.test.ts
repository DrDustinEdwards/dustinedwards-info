import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { runTool } from "~/lib/operator/api.server";
import { MENTION_POLICIES } from "~/lib/webmention/decide.server";
import type { Actor } from "~/lib/editor/publish-policy.mjs";

/**
 * The moderation queue over the operator token.
 *
 * OBSERVATION BOUNDARY. `runTool` is driven directly rather than through
 * `/api/operator`, on `operator.test.ts`' pattern: the route is a thin shell
 * over it and what is worth asserting is the capability decision and the write,
 * not the JSON envelope, which verify-live reads on the wire.
 */

const OPERATOR: Actor = { kind: "operator", id: "test-operator" };
const SMOKE: Actor = { kind: "smoke", id: "test-smoke" };
const ADMIN: Actor = { kind: "admin" };

const SLUG = "a-mentioned-post";
const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];

async function seedPost() {
  await env.DB.prepare(
    `INSERT INTO posts (slug, kind, title, body, status, publish_at)
     VALUES (?1, 'post', 'A post', 'Body.', 'published', ?2)
     ON CONFLICT(slug) DO UPDATE SET status = 'published'`,
  )
    .bind(SLUG, Math.floor(Date.UTC(2026, 0, 1) / 1000))
    .run();
}

/** One row, in whatever state the case needs. Returns its id. */
async function seedMention(source: string, status = "pending"): Promise<number> {
  const now = Math.floor(Date.UTC(2026, 8, 5) / 1000);
  await env.DB.prepare(
    `INSERT INTO webmentions (source_url, target_slug, status, author_name, excerpt, received_at, verified_at)
     VALUES (?1, ?2, ?3, 'A Reader', 'An excerpt.', ?4, ?4)`,
  )
    .bind(source, SLUG, status, now)
    .run();
  const row = await env.DB.prepare(`SELECT id FROM webmentions WHERE source_url = ?1`)
    .bind(source)
    .first<{ id: number }>();
  return row?.id ?? -1;
}

const statusOf = async (source: string) =>
  (
    await env.DB.prepare(`SELECT status FROM webmentions WHERE source_url = ?1`)
      .bind(source)
      .first<{ status: string }>()
  )?.status ?? null;

beforeEach(async () => {
  await env.DB.prepare(`DELETE FROM webmentions`).run();
  await seedPost();
});

describe("decide_mention: who may decide", () => {
  it("REFUSES THE SMOKE ACTOR every decision, because it may not write at all", async () => {
    /*
     * `WRITE_CAPABILITIES.smoke` is write:false, and this is the same table the
     * publish path consults. The smoke credential cannot reach `/api/operator`
     * in production (that path authenticates a different token), so this asserts
     * the capability rather than a route: if a future caller hands a smoke actor
     * to `runTool`, it is refused here rather than by luck.
     */
    const id = await seedMention("https://elsewhere.example/smoke");

    for (const decision of ["approve", "reject", "delete"]) {
      const result = await runTool(operatorEnv(), SMOKE, "decide_mention", { id, decision });
      expect(result, decision).toMatchObject({ ok: false, status: 403 });
      if (!result.ok) expect(result.error, decision).toContain(MENTION_POLICIES.write);
    }

    /* NOTHING MOVED. A refusal that had already written would be a refusal in
     * name only. */
    expect(await statusOf("https://elsewhere.example/smoke")).toBe("pending");
  });

  it("ALLOWS THE OPERATOR to approve, and reports the post it purged", async () => {
    const source = "https://elsewhere.example/operator-approve";
    const id = await seedMention(source);

    const result = await runTool(operatorEnv(), OPERATOR, "decide_mention", {
      id,
      decision: "approve",
    });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.data).toMatchObject({ changed: true, slug: SLUG, purged: `post:${SLUG}` });
    }
    expect(await statusOf(source)).toBe("approved");
  });

  it("ALLOWS THE OPERATOR to reject, which is the two-way door's other half", async () => {
    const source = "https://elsewhere.example/operator-reject";
    const id = await seedMention(source);

    const rejected = await runTool(operatorEnv(), OPERATOR, "decide_mention", { id, decision: "reject" });
    expect(await statusOf(source)).toBe("rejected");
    expect(rejected).toMatchObject({ ok: true, data: { purged: `post:${SLUG}` } });

    /* And back again, which is what makes it reversible rather than a claim. */
    const approved = await runTool(operatorEnv(), OPERATOR, "decide_mention", { id, decision: "approve" });
    expect(await statusOf(source)).toBe("approved");
    expect(approved).toMatchObject({ ok: true, data: { purged: `post:${SLUG}` } });
  });

  it("REFUSES THE OPERATOR a delete, on delete_post's terms", async () => {
    /*
     * `WRITE_CAPABILITIES.operator` is destroy:false. A mention row came from a
     * stranger and converges toward nothing, so there is no derivation that
     * could produce it again: the same reason `delete_post` is admin-only.
     */
    const source = "https://elsewhere.example/operator-delete";
    const id = await seedMention(source);

    const result = await runTool(operatorEnv(), OPERATOR, "decide_mention", {
      id,
      decision: "delete",
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    if (!result.ok) expect(result.error).toContain(MENTION_POLICIES.destroy);
    expect(await statusOf(source)).toBe("pending");
  });

  it("ALLOWS THE ADMIN to delete, which is the capability the operator lacks", async () => {
    const source = "https://elsewhere.example/admin-delete";
    const id = await seedMention(source);

    const result = await runTool(operatorEnv(), ADMIN, "decide_mention", {
      id,
      decision: "delete",
    });

    expect(result).toMatchObject({ ok: true, data: { purged: `post:${SLUG}` } });
    expect(await statusOf(source)).toBeNull();
  });

  it("does NOT purge when nothing moved", async () => {
    /*
     * A row that is `unverified` or `failed` has no evidence to approve, and the
     * DB layer's `where` refuses it. Reporting that as success with
     * `changed: false` is the honest answer; purging for a page that did not
     * change would spend a rate-limited call on nothing.
     */
    const source = "https://elsewhere.example/unverified";
    const id = await seedMention(source, "unverified");

    const result = await runTool(operatorEnv(), OPERATOR, "decide_mention", {
      id,
      decision: "approve",
    });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data).toMatchObject({ changed: false, slug: null, purged: null });
    expect(await statusOf(source)).toBe("unverified");
  });

  it("REFUSES a malformed id or decision before touching the database", async () => {
    for (const args of [
      { id: 0, decision: "approve" },
      { id: -3, decision: "approve" },
      { id: "abc", decision: "approve" },
      { id: 1, decision: "approve-please" },
      { id: 1, decision: "" },
    ]) {
      const result = await runTool(operatorEnv(), OPERATOR, "decide_mention", args);
      expect(result, JSON.stringify(args)).toMatchObject({ ok: false, status: 400 });
    }
  });
});

describe("list_mentions", () => {
  it("returns the whole queue, failures included", async () => {
    /* The queue's value is being read, so it shows what the admin page shows: an
     * operator that could not see the failures could not tell "nothing arrived"
     * from "everything was refused". */
    await seedMention("https://elsewhere.example/a", "pending");
    await seedMention("https://elsewhere.example/b", "failed");
    await seedMention("https://elsewhere.example/c", "approved");

    const result = await runTool(operatorEnv(), OPERATOR, "list_mentions", {});
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      const data = result.data as { count: number; status: string; mentions: Array<{ status: string }> };
      expect(data.count).toBe(3);
      expect(data.status).toBe("all");
      expect(data.mentions.map((m) => m.status).sort()).toEqual(["approved", "failed", "pending"]);
    }
  });

  it("filters by status", async () => {
    await seedMention("https://elsewhere.example/p", "pending");
    await seedMention("https://elsewhere.example/f", "failed");

    const result = await runTool(operatorEnv(), OPERATOR, "list_mentions", { status: "pending" });
    if (result.ok) {
      const data = result.data as { count: number; mentions: Array<{ source: string }> };
      expect(data.count).toBe(1);
      expect(data.mentions[0]?.source).toBe("https://elsewhere.example/p");
    }
  });

  it("REFUSES AN UNKNOWN STATUS rather than answering with an empty list", async () => {
    /*
     * An agent that typed `pendign` and got `[]` would conclude the queue was
     * empty, which is the wrong repair and is indistinguishable from the right
     * one. The refusal names the set it will accept.
     */
    await seedMention("https://elsewhere.example/p", "pending");
    const result = await runTool(operatorEnv(), OPERATOR, "list_mentions", { status: "pendign" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (!result.ok) expect(result.error).toContain("pending");
  });

  it("returns a failed mention's reason, which is how the operator decides on it", async () => {
    const source = "https://elsewhere.example/f";
    await seedMention(source, "failed");
    await env.DB.prepare(`UPDATE webmentions SET failure_reason = ?1 WHERE source_url = ?2`)
      .bind("the source page does not link to the target", source)
      .run();

    const result = await runTool(operatorEnv(), OPERATOR, "list_mentions", { status: "failed" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      const mentions = (result.data as { mentions: Array<Record<string, unknown>> }).mentions;
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        source,
        failureReason: "the source page does not link to the target",
      });
    }
  });
});
