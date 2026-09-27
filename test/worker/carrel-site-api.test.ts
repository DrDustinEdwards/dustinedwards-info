import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getBlogPost } from "~/db";
import { previewPost, withPublication } from "~/lib/carrel/site-adapter.server";
import { postPath } from "~/lib/content/pipeline.mjs";
import { renderAndWrite, renderRecord } from "~/lib/editor/publish.server";
import { authenticateOperator } from "~/lib/operator/auth.server";
import { runTool } from "~/lib/operator/api.server";
import { action, loader } from "~/routes/api.carrel.v1.$";

import { post } from "./fixtures";
import { stubGitHub, type GitHubStub } from "./github-stub";
import { routeContext } from "./route-helpers";
import { testEnv } from "./test-env";

/* Through the real route module, so the package's guard, the site's limiter and the adapter are the
 * ones that run in production. Each refusal also checks that the repository did not change. */

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
/** The stub's fixed head: the version every write here must name to land. */
const HEAD = "a".repeat(40);

const siteEnv = () => testEnv as unknown as Parameters<typeof renderAndWrite>[0];

const headersFor = (key: string) => ({
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
  "cf-connecting-ip": "203.0.113.9",
});

const argsFor = (request: Request) => ({ request, context: routeContext(), params: {} }) as never;

function get(url: string, key: string = testEnv.CARREL_SITE_KEY): Promise<Response> {
  return loader(argsFor(new Request(url, { headers: headersFor(key) })));
}

function send(method: "PUT" | "POST", url: string, body: unknown): Promise<Response> {
  const request = new Request(url, {
    method,
    headers: headersFor(testEnv.CARREL_SITE_KEY),
    body: JSON.stringify(body),
  });
  return action(argsFor(request));
}

let gh: GitHubStub;

beforeEach(() => {
  gh = stubGitHub();
});

afterEach(() => {
  gh.restore();
});

describe("the Carrel key reaches only its prefix", () => {
  it("REFUSES the Carrel key on the operator API", async () => {
    const request = new Request(`${ORIGIN}/api/operator`, {
      method: "POST",
      headers: { authorization: `Bearer ${testEnv.CARREL_SITE_KEY}` },
    });
    const result = await authenticateOperator(
      testEnv as unknown as Parameters<typeof authenticateOperator>[0],
      request,
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("REFUSES to serve a path outside /api/carrel/v1 even with the key", async () => {
    await expect(get(`${ORIGIN}/api/carrel/v2/content`)).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("REFUSES the operator token on the Carrel prefix", async () => {
    const response = await get(`${PREFIX}/content`, testEnv.OPERATOR_TOKEN);
    expect(response.status).toBe(401);
  });

  it("answers the key on its prefix", async () => {
    const response = await get(`${PREFIX}/meta`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ site: { id: "dustinedwards-info" } });
  });
});

describe("every write names the version it was loaded at", () => {
  it("REFUSES a stale expectedVersion, names the current one, and commits nothing", async () => {
    gh.files.set(postPath("carrel-stale"), post("carrel-stale"));
    const before = gh.files.get(postPath("carrel-stale"));

    const response = await send("PUT", `${PREFIX}/content/carrel-stale/draft`, {
      source: post("carrel-stale", { title: "Changed" }),
      expectedVersion: "b".repeat(40),
      changeId: "chg-stale",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "version-conflict", currentVersion: HEAD });
    expect(gh.files.get(postPath("carrel-stale"))).toBe(before);
  });

  it("REFUSES a version for an id that does not exist, with a null current version", async () => {
    const response = await send("POST", `${PREFIX}/content/carrel-missing/publish`, {
      expectedVersion: HEAD,
      changeId: "chg-missing",
      source: post("carrel-missing"),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "version-conflict", currentVersion: null });
    expect(gh.files.has(postPath("carrel-missing"))).toBe(false);
  });

  it("REFUSES a create over an id that exists", async () => {
    gh.files.set(postPath("carrel-taken"), post("carrel-taken"));
    const response = await send("PUT", `${PREFIX}/content/carrel-taken/draft`, {
      source: post("carrel-taken", { title: "Other" }),
      expectedVersion: null,
      changeId: "chg-taken",
    });
    expect(response.status).toBe(409);
  });
});

describe("the first publication", () => {
  it("ALLOWS it from Carrel's key, and the commit records who published", async () => {
    gh.files.set(postPath("carrel-first"), post("carrel-first", { draft: true }));

    const response = await send("POST", `${PREFIX}/content/carrel-first/publish`, {
      expectedVersion: HEAD,
      changeId: "chg-first",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "published", changeId: "chg-first" });
    const saved = gh.files.get(postPath("carrel-first")) ?? "";
    expect(saved).toMatch(/^draft: false$/m);
    expect(saved).toMatch(/^first_published: /m);
    const commit = gh.calls.find((c) => c.method === "POST" && c.path.endsWith("/git/commits"));
    const message = (commit?.body as { message?: string } | undefined)?.message;
    expect(message).toContain("[carrel:chg-first]");
  });

  it("REFUSES it from any other key: the operator keeps the admin-only rule", async () => {
    const result = await runTool(
      testEnv as unknown as Parameters<typeof runTool>[0],
      { kind: "operator", id: "test" },
      "save_post",
      { slug: "carrel-operator-first", raw: post("carrel-operator-first", { draft: false }), isNew: true },
    );
    expect(result).toMatchObject({ ok: false, status: 403, detail: { policy: "first-publish-requires-admin" } });
    expect(gh.files.has(postPath("carrel-operator-first"))).toBe(false);
  });
});

describe("status belongs to the site", () => {
  it("keeps a live post live when Carrel saves its source", async () => {
    gh.files.set(
      postPath("carrel-live"),
      post("carrel-live", { draft: false, first_published: "2026-07-01" }),
    );
    const response = await send("PUT", `${PREFIX}/content/carrel-live/draft`, {
      source: post("carrel-live", { draft: true, title: "Edited live" }),
      expectedVersion: HEAD,
      changeId: "chg-live",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "published" });
    expect(gh.files.get(postPath("carrel-live"))).toMatch(/^draft: false$/m);
  });

  it("changes only the draft and publish_at lines, so keys the editor does not know survive", () => {
    const raw = `---\ntitle: "T"\ndraft: true\nwriting_status: draft\nkey_takeaways:\n  - one\n---\n\nBody\n`;
    const out = withPublication(raw, { draft: false, publishAt: "2026-12-01T09:00:00.000Z" });
    expect(out).toBe(
      `---\ntitle: "T"\ndraft: false\nwriting_status: draft\nkey_takeaways:\n  - one\npublish_at: "2026-12-01T09:00:00.000Z"\n---\n\nBody\n`,
    );
  });
});

describe("the preview", () => {
  it("builds exactly the loader data the published page reads from D1", async () => {
    const raw = post("carrel-preview-match", { draft: false, first_published: "2026-07-01" });
    gh.files.set(postPath("carrel-preview-match"), raw);
    await renderAndWrite(siteEnv(), "carrel-preview-match", raw);

    const published = await getBlogPost(siteEnv(), "carrel-preview-match");
    const preview = await previewPost(siteEnv(), await renderRecord(siteEnv(), "carrel-preview-match", raw));

    expect(published).not.toBeNull();
    expect(preview).toEqual(published);
  });
});
