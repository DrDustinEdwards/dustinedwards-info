import { createExecutionContext, env } from "cloudflare:test";
import type { IntentResult } from "@dustinedwards/site-api/admin";
import { beforeEach, describe, expect, it } from "vitest";

import { SMOKE_READ_ONLY_POLICY } from "~/lib/editor/publish-policy.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { middleware as adminMiddleware } from "~/routes/admin";
import { action as mentionsAction, loader as mentionsLoader } from "~/routes/admin.mentions";

import { routeContext, throughMiddleware } from "./route-helpers";
import { seedMention as seedMentionRow } from "./seed";
import { mentionRow, resetMentions, TARGET_SLUG } from "./webmention-fixtures";

/*
 * The moderation queue as the admin page runs it: Capsomer's MentionsList posts the kit's intents, the kit runs them
 * through localClient against the site API's mentions group (app/lib/carrel/mentions-adapter.server.ts), which is the
 * door Carrel's requests reach too. The kit's own steps (Undo, asking first) are tested in site-api; these are the
 * site's rules on its own table.
 */

function seedMention(sourceUrl: string, status: string, receivedDaysAgo: number): Promise<number> {
  const receivedAt = Math.floor((Date.now() - receivedDaysAgo * 24 * 60 * 60 * 1000) / 1000);
  return seedMentionRow(sourceUrl, TARGET_SLUG, { status, receivedAt });
}

function post(body: Record<string, string | string[]>, headers: Record<string, string> = {}) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body))
    for (const one of [value].flat()) form.append(key, one);
  return new Request(`${SITE_ORIGIN}/admin/mentions`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: SITE_ORIGIN,
      ...headers,
    },
    body: form,
  });
}

async function run(body: Record<string, string | string[]>): Promise<IntentResult> {
  return (await mentionsAction({
    request: post(body),
    context: routeContext(),
    params: {},
  } as never)) as IntentResult;
}

async function load(query = "") {
  const loaded = (await mentionsLoader({
    request: new Request(`${SITE_ORIGIN}/admin/mentions${query}`),
    context: routeContext(),
    params: {},
  } as never)) as unknown as {
    data: {
      mentions: {
        query: { view: string };
        rows: Array<{ id: string; version: string; state: string }>;
        counts: Record<string, number>;
      };
    };
  };
  return loaded.data.mentions;
}

const statusOf = async (sourceUrl: string) => (await mentionRow(sourceUrl))?.status ?? null;

beforeEach(resetMentions);

describe("the admin plane refuses the smoke actor", () => {
  it("REFUSES a POST carrying the smoke credential, and the row survives", async () => {
    const source = "https://elsewhere.example/smoke-target";
    const id = await seedMention(source, "rejected", 1);
    const token = "smoke-token-0123456789abcdef0123456789";
    const request = post(
      { intent: "delete", ids: String(id), confirm: "1" },
      { authorization: `Bearer ${token}` },
    );
    const outcome = await throughMiddleware(adminMiddleware, mentionsAction, {
      request,
      context: routeContext(createExecutionContext(), { SMOKE_TOKEN: token }),
      params: {},
    } as never).catch((thrown: unknown) => thrown);
    expect(outcome).toBeInstanceOf(Response);
    expect((outcome as Response).status).toBe(403);
    expect(await (outcome as Response).text()).toContain(SMOKE_READ_ONLY_POLICY);
    expect(await mentionRow(source)).not.toBeNull();
  });
});

describe("the moderation queue", () => {
  it("A DECISION IS A TWO-WAY DOOR, and goes back to waiting; an unchecked or failed mention is refused", async () => {
    const source = "https://elsewhere.example/decided";
    const id = String(await seedMention(source, "pending", 1));
    // The row form posts no statuses and the bulk form no version: the kit reads both from the site.
    const approved = await run({ intent: "approve", ids: id });
    expect(approved.ok, approved.message).toBe(true);
    expect(await statusOf(source)).toBe("approved");
    expect(approved.undo?.intent).toBe("reset");
    await run({ intent: "reject", ids: id });
    expect(await statusOf(source)).toBe("rejected");
    await run({ intent: approved.undo!.intent, ids: id });
    expect(await statusOf(source)).toBe("pending");

    const unchecked = "https://elsewhere.example/still-unverified";
    const failed = "https://elsewhere.example/already-failed";
    const refused = await run({
      intent: "approve",
      ids: [
        String(await seedMention(unchecked, "unverified", 1)),
        String(await seedMention(failed, "failed", 1)),
      ],
    });
    expect(refused.ok).toBe(false);
    expect(refused.outcomes?.map((o) => o.ok)).toEqual([false, false]);
    expect(await statusOf(unchecked)).toBe("unverified");
    expect(await statusOf(failed)).toBe("failed");
  });

  it("REFUSES A STALE VERSION: a mention re-sent since the page loaded is not decided", async () => {
    const source = "https://elsewhere.example/re-sent";
    const id = await seedMention(source, "pending", 2);
    const seen = (await load()).rows.find((r) => r.id === String(id))!;
    // A re-send resets the row (receiveWebmention), so the version the person saw no longer holds.
    await env.DB.prepare(
      `UPDATE webmentions SET status = 'unverified', received_at = unixepoch() WHERE id = ?1`,
    )
      .bind(id)
      .run();
    await env.DB.prepare(`UPDATE webmentions SET status = 'pending' WHERE id = ?1`).bind(id).run();
    const stale = await run({ intent: "approve", ids: String(id), versions: seen.version });
    expect(stale.ok).toBe(false);
    expect(stale.conflict?.id).toBe(String(id));
    expect(await statusOf(source)).toBe("pending");
  });

  it("ASKS BEFORE A DELETE, and deletes only on the typed count", async () => {
    const source = "https://elsewhere.example/delete-me";
    const id = String(await seedMention(source, "rejected", 1));
    const asked = await run({ intent: "delete", ids: id });
    expect(asked.confirm?.typeToConfirm).toBe("1");
    expect(await statusOf(source)).toBe("rejected");
    expect(
      (await run({ ...asked.confirm!.fields, intent: "delete", confirm: "01" })).confirm,
    ).toBeDefined();
    expect(await statusOf(source)).toBe("rejected");
    expect((await run({ ...asked.confirm!.fields, intent: "delete", confirm: "1" })).ok).toBe(true);
    expect(await mentionRow(source)).toBeNull();
  });

  it("ASKS BEFORE A SWEEP, then SWEEPS ONLY PAST THE WINDOW, never an open or approved row at any age", async () => {
    await seedMention("https://elsewhere.example/failed-old", "failed", 40);
    await seedMention("https://elsewhere.example/failed-recent", "failed", 20);
    await seedMention("https://elsewhere.example/rejected-old", "rejected", 100);
    await seedMention("https://elsewhere.example/rejected-recent", "rejected", 60);
    await seedMention("https://elsewhere.example/ancient-pending", "pending", 400);
    await seedMention("https://elsewhere.example/ancient-unverified", "unverified", 400);
    await seedMention("https://elsewhere.example/ancient-approved", "approved", 400);

    const asked = await run({ intent: "sweep" });
    expect(asked.confirm?.items).toEqual(["1 failed", "1 rejected"]);
    expect(await statusOf("https://elsewhere.example/failed-old")).toBe("failed");

    const done = await run({ intent: "sweep", ...asked.confirm!.fields });
    expect(done.message).toContain("Removed 1 failed and 1 rejected");
    expect(await mentionRow("https://elsewhere.example/failed-old")).toBeNull();
    expect(await mentionRow("https://elsewhere.example/rejected-old")).toBeNull();
    for (const [source, status] of [
      ["failed-recent", "failed"],
      ["rejected-recent", "rejected"],
      ["ancient-pending", "pending"],
      ["ancient-unverified", "unverified"],
      ["ancient-approved", "approved"],
    ]) {
      expect(await statusOf(`https://elsewhere.example/${source}`), source).toBe(status);
    }
  });

  it("OPENS ON WAITING when anything waits, and on all when nothing does, with the whole queue's counts", async () => {
    await seedMention("https://elsewhere.example/settled", "approved", 1);
    expect((await load()).query.view).toBe("all");
    await seedMention("https://elsewhere.example/waiting", "pending", 1);
    await seedMention("https://elsewhere.example/f1", "failed", 1);
    const busy = await load();
    expect(busy.query.view).toBe("pending");
    expect(busy.rows.map((r) => r.state)).toEqual(["pending"]);
    expect(busy.counts).toMatchObject({ pending: 1, approved: 1, failed: 1, all: 3 });
    expect((await load("?view=failed")).rows.map((r) => r.state)).toEqual(["failed"]);
  });
});
