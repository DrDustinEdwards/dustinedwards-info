import { createExecutionContext, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { adminActorContext } from "~/lib/auth.server";
import { CONFIRM_FIELD } from "~/lib/destructive.mjs";
import { SMOKE_READ_ONLY_POLICY } from "~/lib/editor/publish-policy.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { middleware as adminMiddleware } from "~/routes/admin";
import AdminMentions, {
  action as mentionsAction,
  loader as mentionsLoader,
} from "~/routes/admin.mentions";

import { renderRoute, routeContext, textsOf, throughMiddleware } from "./route-helpers";
import { seedMention as seedMentionRow } from "./seed";
import { mentionRow, resetMentions, TARGET_SLUG } from "./webmention-fixtures";

function seedMention(sourceUrl: string, status: string, receivedDaysAgo: number): Promise<number> {
  const receivedAt = Math.floor((Date.now() - receivedDaysAgo * 24 * 60 * 60 * 1000) / 1000);
  return seedMentionRow(sourceUrl, TARGET_SLUG, { status, receivedAt });
}

function renderMentionsPage(url: string, loaderData: unknown, actionData?: unknown) {
  return renderRoute("/admin/mentions", AdminMentions, { loaderData, actionData }, url);
}

beforeEach(resetMentions);

describe("the admin plane refuses the smoke actor", () => {
  async function throughAdminStack(request: Request, context: ReturnType<typeof routeContext>) {
    try {
      return await throughMiddleware(adminMiddleware, mentionsAction, {
        request,
        context,
        params: {},
      } as never);
    } catch (thrown) {
      return thrown;
    }
  }

  it("REFUSES a POST carrying the smoke credential, and the row survives", async () => {
    const source = "https://elsewhere.example/smoke-target";
    const id = await seedMention(source, "rejected", 1);

    const token = "smoke-token-0123456789abcdef0123456789";
    const ctx = createExecutionContext();
    const request = new Request(`${SITE_ORIGIN}/admin/mentions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        origin: SITE_ORIGIN,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ intent: "delete", id: String(id), [CONFIRM_FIELD]: "1" }),
    });

    const outcome = await throughAdminStack(request, routeContext(ctx, { SMOKE_TOKEN: token }));

    expect(outcome).toBeInstanceOf(Response);
    const refusal = outcome as Response;
    expect(refusal.status).toBe(403);
    expect(await refusal.text()).toContain(SMOKE_READ_ONLY_POLICY);
    expect(await mentionRow(source)).not.toBeNull();
  });
});

describe("the moderation queue", () => {
  function adminPost(body: Record<string, string>) {
    return new Request(`${SITE_ORIGIN}/admin/mentions`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
  }

  async function runAction(body: Record<string, string>) {
    const ctx = createExecutionContext();
    /* The admin layout sets the actor; the action hands it to `decideMention` for the policy checks. */
    const context = routeContext(ctx);
    context.set(adminActorContext, { kind: "admin", email: "admin@example.com" });
    return (await mentionsAction({
      request: adminPost(body),
      context,
    } as never)) as unknown as {
      data: {
        ok?: boolean;
        message?: string;
        confirmDelete?: number;
        confirmSweep?: { failed: number; rejected: number };
      };
    };
  }

  async function runLoader(query = "") {
    const ctx = createExecutionContext();
    return (await mentionsLoader({
      request: new Request(`${SITE_ORIGIN}/admin/mentions${query}`),
      context: routeContext(ctx),
    } as never)) as unknown as {
      data: {
        mentions: Array<{ status: string }>;
        expiring: { failed: number; rejected: number };
        status: string;
      };
    };
  }

  async function statusOf(sourceUrl: string) {
    return (await mentionRow(sourceUrl))?.status ?? null;
  }

  it("A DECISION IS A TWO-WAY DOOR: approve is undone by reject", async () => {
    /* `check:destructive` lists these intents REVERSIBLE ("undone by reject"); this runs that claim. */
    const source = "https://elsewhere.example/decided";
    const id = await seedMention(source, "pending", 1);

    await runAction({ intent: "approve", id: String(id) });
    expect(await statusOf(source)).toBe("approved");

    await runAction({ intent: "reject", id: String(id) });
    expect(await statusOf(source)).toBe("rejected");

    await runAction({ intent: "approve", id: String(id) });
    expect(await statusOf(source)).toBe("approved");
  });

  it("REFUSES to decide an unverified or failed mention", async () => {
    const unverified = "https://elsewhere.example/still-unverified";
    const failed = "https://elsewhere.example/already-failed";
    const a = await seedMention(unverified, "unverified", 1);
    const b = await seedMention(failed, "failed", 1);

    const first = await runAction({ intent: "approve", id: String(a) });
    const second = await runAction({ intent: "approve", id: String(b) });

    expect(await statusOf(unverified)).toBe("unverified");
    expect(await statusOf(failed)).toBe("failed");
    /* Nothing moved, so the page must not say "approved". */
    for (const result of [first, second]) {
      expect(result.data.ok).toBe(false);
      expect(result.data.message).toMatch(/^Nothing changed/);
    }
  });

  it("REFUSES A DELETE WITH NO TYPED CONFIRMATION, in the ACTION", async () => {
    /* With scripting off the handler never runs and the form posts anyway, so the refusal
     * must be observable in the action itself. */
    const source = "https://elsewhere.example/keep-me";
    const id = await seedMention(source, "rejected", 1);

    const bare = await runAction({ intent: "delete", id: String(id) });
    expect(bare.data.confirmDelete).toBe(id);
    expect(await statusOf(source)).toBe("rejected");

    /* "1 " and "01" both read as one to a human, so the predicate is a strict string compare. */
    const near = await runAction({ intent: "delete", id: String(id), "confirm-count": "01" });
    expect(near.data.confirmDelete).toBe(id);
    expect(await statusOf(source)).toBe("rejected");
  });

  it("DELETES on the typed confirmation, and the row is gone", async () => {
    const source = "https://elsewhere.example/delete-me";
    const id = await seedMention(source, "rejected", 1);

    const done = await runAction({ intent: "delete", id: String(id), "confirm-count": "1" });
    expect(await mentionRow(source)).toBeNull();
    expect(done.data.message).toContain("deleted");
  });

  it("REFUSES A SWEEP WITH NO TYPED CONFIRMATION, and states what is at stake", async () => {
    await seedMention("https://elsewhere.example/old-failure", "failed", 40);
    await seedMention("https://elsewhere.example/old-rejection", "rejected", 100);

    const bare = await runAction({ intent: "sweep" });
    expect(bare.data.confirmSweep).toEqual({ failed: 1, rejected: 1 });

    const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM webmentions`).first<{
      n: number;
    }>();
    expect(count?.n).toBe(2);
  });

  it("SWEEPS ONLY PAST THE WINDOW, and never an open row at any age", async () => {
    /* Expiring an ancient OPEN row would quietly raise the endpoint's global cap. */
    await seedMention("https://elsewhere.example/failed-old", "failed", 40);
    await seedMention("https://elsewhere.example/failed-recent", "failed", 20);
    await seedMention("https://elsewhere.example/rejected-old", "rejected", 100);
    await seedMention("https://elsewhere.example/rejected-recent", "rejected", 60);
    await seedMention("https://elsewhere.example/ancient-pending", "pending", 400);
    await seedMention("https://elsewhere.example/ancient-unverified", "unverified", 400);

    const done = await runAction({ intent: "sweep", "confirm-count": "1" });
    expect(done.data.message).toContain("Removed 1 failed and 1 rejected");

    expect(await mentionRow("https://elsewhere.example/failed-old")).toBeNull();
    expect(await mentionRow("https://elsewhere.example/rejected-old")).toBeNull();
    expect(await statusOf("https://elsewhere.example/failed-recent")).toBe("failed");
    expect(await statusOf("https://elsewhere.example/rejected-recent")).toBe("rejected");
    expect(await statusOf("https://elsewhere.example/ancient-pending")).toBe("pending");
    expect(await statusOf("https://elsewhere.example/ancient-unverified")).toBe("unverified");

    /* An APPROVED row is the published record and is not swept at any age. */
    await seedMention("https://elsewhere.example/ancient-approved", "approved", 400);
    await runAction({ intent: "sweep", "confirm-count": "1" });
    expect(await statusOf("https://elsewhere.example/ancient-approved")).toBe("approved");
  });

  it("REFUSES an id that is not a positive integer, and deletes nothing", async () => {
    const source = "https://elsewhere.example/near-miss-id";
    const id = await seedMention(source, "rejected", 1);

    for (const bad of ["", "0", `-${id}`, `${id}.5`, `${id}abc`]) {
      const result = await runAction({ intent: "delete", id: bad, [CONFIRM_FIELD]: "1" });
      expect(result.data.ok, `id ${JSON.stringify(bad)} was not refused`).toBe(false);
      expect(await statusOf(source), `id ${JSON.stringify(bad)} reached the row`).toBe("rejected");
    }
  });

  /* Rendering runs no action, so only this layer can see the `ok` flag. It is asserted beside
   * the effect, or an action that reported success and did nothing would pass. */
  it("MARKS AN OUTCOME ok AND A REFUSAL NOT, so the page can pick the right box", async () => {
    const source = "https://elsewhere.example/flagged";
    const id = await seedMention(source, "pending", 1);

    const approved = await runAction({ intent: "approve", id: String(id) });
    expect(approved.data.ok).toBe(true);
    expect(await statusOf(source)).toBe("approved");

    const rejected = await runAction({ intent: "reject", id: String(id) });
    expect(rejected.data.ok).toBe(true);
    expect(await statusOf(source)).toBe("rejected");

    const swept = await runAction({ intent: "sweep", "confirm-count": "1" });
    expect(swept.data.ok).toBe(true);

    const deleted = await runAction({ intent: "delete", id: String(id), "confirm-count": "1" });
    expect(deleted.data.ok).toBe(true);
    expect(await mentionRow(source)).toBeNull();

    /* Both refusals carry a message too, so the page cannot classify by reading one. */
    const badIntent = await runAction({ intent: "incinerate" });
    expect(badIntent.data.ok).toBe(false);
    expect(badIntent.data.message).toBeTruthy();

    const badId = await runAction({ intent: "delete", id: "0", "confirm-count": "1" });
    expect(badId.data.ok).toBe(false);
    expect(badId.data.message).toBeTruthy();
  });

  it("A CONFIRMATION STEP renders the second step, no outcome, and keeps the rows", async () => {
    const source = "https://elsewhere.example/pending-confirm";
    const id = await seedMention(source, "rejected", 1);
    await seedMention("https://elsewhere.example/expired-failure", "failed", 40);

    const steps: Record<string, string>[] = [{ intent: "delete", id: String(id) }, { intent: "sweep" }];
    for (const body of steps) {
      const step = await runAction(body);
      const page = renderMentionsPage(
        "/admin/mentions",
        (await runLoader()).data,
        step.data,
      );

      /* The status region is always rendered, so "no outcome" is an empty one, and no alert. */
      const said = (await textsOf(page, "[role=status]")).filter((text) => text.trim() !== "");
      expect(said, body.intent).toEqual([]);
      expect(await textsOf(page, "[role=alert]"), body.intent).toEqual([]);
      expect(await textsOf(page, `input[name="${CONFIRM_FIELD}"]`), body.intent).toHaveLength(1);
    }
    expect(await statusOf(source)).toBe("rejected");
    expect(await statusOf("https://elsewhere.example/expired-failure")).toBe("failed");
  });

  /* The filter is resolved on the server so the page needs no script; only the loader can see it. */
  it("DEFAULTS TO PENDING when anything is pending, and to all when nothing is", async () => {
    await seedMention("https://elsewhere.example/settled", "approved", 1);

    const quiet = await runLoader();
    expect(quiet.data.status).toBe("all");

    await seedMention("https://elsewhere.example/waiting", "pending", 1);
    const busy = await runLoader();
    expect(busy.data.status).toBe("pending");
  });

  it("HONOURS an explicit ?status=, and treats an unrecognised one as absent", async () => {
    await seedMention("https://elsewhere.example/waiting", "pending", 1);

    expect((await runLoader("?status=all")).data.status).toBe("all");
    expect((await runLoader("?status=rejected")).data.status).toBe("rejected");

    /* An empty or unknown value falls back to the default rather than to `all`, so a
       truncated link cannot silently widen what is on screen. */
    expect((await runLoader("?status=")).data.status).toBe("pending");
    expect((await runLoader("?status=everything")).data.status).toBe("pending");
  });

  it("EVERY CHIP COUNTS THE ROWS ITS FILTER LISTS, and pending lists the pending rows", async () => {
    await seedMention("https://elsewhere.example/p1", "pending", 1);
    await seedMention("https://elsewhere.example/p2", "pending", 1);
    await seedMention("https://elsewhere.example/u1", "unverified", 1);
    await seedMention("https://elsewhere.example/f1", "failed", 1);
    await seedMention("https://elsewhere.example/a1", "approved", 1);

    const renderAt = async (query: string) =>
      renderMentionsPage(`/admin/mentions${query}`, (await runLoader(query)).data);
    const chipsOf = async (page: string) =>
      Object.fromEntries(
        (await textsOf(page, ".mention-filters a")).map((chip) => {
          const [, label, count] = /^(.*) (\d+)$/.exec(chip) ?? [];
          return [label ?? chip, Number(count)];
        }),
      );

    const pending = await renderAt("?status=pending");
    expect(await chipsOf(pending)).toEqual({
      Pending: 2,
      Failed: 1,
      Approved: 1,
      Rejected: 0,
      All: 5,
    });
    expect((await textsOf(pending, ".mention-source")).sort()).toEqual([
      "https://elsewhere.example/p1",
      "https://elsewhere.example/p2",
    ]);

    for (const [filter, label] of [
      ["pending", "Pending"],
      ["failed", "Failed"],
      ["approved", "Approved"],
      ["rejected", "Rejected"],
      ["all", "All"],
    ] as const) {
      const page = await renderAt(`?status=${filter}`);
      const chips = await chipsOf(page);
      expect(await textsOf(page, ".mention-source"), filter).toHaveLength(chips[label] ?? -1);
    }
  });

  /* The sweep button is labelled with this count, so the loader owes it on every request. */
  it("CARRIES THE EXPIRING COUNT, so the sweep control can name what it removes", async () => {
    const empty = await runLoader();
    expect(empty.data.expiring).toEqual({ failed: 0, rejected: 0 });

    await seedMention("https://elsewhere.example/old-failure", "failed", 40);
    await seedMention("https://elsewhere.example/old-rejection", "rejected", 100);
    await seedMention("https://elsewhere.example/recent-failure", "failed", 20);

    const loaded = await runLoader();
    expect(loaded.data.expiring).toEqual({ failed: 1, rejected: 1 });
  });
});
