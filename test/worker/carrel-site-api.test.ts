import { createExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getBlogPost } from "~/db";
import { previewPost, withPublication } from "~/lib/carrel/site-adapter.server";
import { postPath } from "~/lib/content/pipeline.mjs";
import { renderAndWrite, renderRecord } from "~/lib/editor/publish.server";
import { ALLOWED, MAX_BYTES } from "~/lib/media/upload-contract.mjs";
import { authenticateOperator } from "~/lib/operator/auth.server";
import { runTool } from "~/lib/operator/api.server";
import { action, loader } from "~/routes/api.carrel.v1.$";

import { post } from "./fixtures";
import { stubGitHub, type GitHubStub } from "./github-stub";
import { bytesFor, envWithImages } from "./media-fixtures";
import { routeContext } from "./route-helpers";
import { seedPost } from "./seed";
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
    /* Older than this run, so a preview that stamps its own time cannot match by landing in the
     * same second as the sync. */
    await testEnv.DB.prepare(`UPDATE posts SET updated_at = 1767225600 WHERE slug = ?1`)
      .bind("carrel-preview-match")
      .run();

    const published = await getBlogPost(siteEnv(), "carrel-preview-match");
    const preview = await previewPost(siteEnv(), await renderRecord(siteEnv(), "carrel-preview-match", raw));

    expect(published).not.toBeNull();
    expect(preview).toEqual(published);
  });
});

/* Media (site-api v0.2.0): the site's own store, list, reference check and delete, behind the same
 * key and limiter. Each case uploads its own bytes, so its own content-addressed key. */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Fake image bytes behind a real PNG signature, which the package checks before the site reads them. */
function pngBytes(seed: string) {
  const body = bytesFor(seed);
  const bytes = new Uint8Array(PNG_SIGNATURE.length + body.length);
  bytes.set(PNG_SIGNATURE);
  bytes.set(body, PNG_SIGNATURE.length);
  return bytes;
}

type MediaInit = { body?: BodyInit; type?: string; key?: string };

/** Through the route, with the recorded IMAGES binding and anything in `overrides` over the env. */
function mediaCall(
  method: "GET" | "POST" | "DELETE",
  url: string,
  init: MediaInit = {},
  overrides: object = {},
): Promise<Response> {
  const request = new Request(url, {
    method,
    headers: {
      ...headersFor(init.key ?? testEnv.CARREL_SITE_KEY),
      "content-type": init.type ?? "application/json",
    },
    ...(method === "GET" ? {} : { body: init.body }),
  });
  const args = {
    request,
    context: routeContext(createExecutionContext(), {
      ...envWithImages({ width: 10, height: 10 }),
      ...overrides,
    }),
    params: {},
  } as never;
  return method === "GET" ? loader(args) : action(args);
}

/** Uploads through the API and answers the stored id. */
async function uploadThroughApi(seed: string, alt = "") {
  const query = new URLSearchParams({ filename: `${seed}.png`, changeId: `chg-${seed}`, alt });
  const response = await mediaCall("POST", `${PREFIX}/media?${query}`, {
    body: pngBytes(seed),
    type: "image/png",
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

const mediaRowOf = (key: string) =>
  testEnv.DB.prepare("SELECT key, alt FROM media WHERE key = ?1")
    .bind(key)
    .first<{ key: string; alt: string }>();

const mediaCount = async () =>
  (await testEnv.DB.prepare("SELECT count(*) AS n FROM media").first<{ n: number }>())?.n ?? 0;

describe("media: meta declares what the site accepts", () => {
  it("names v0.2.0, media, and the admin library's limits less SVG", async () => {
    const response = await get(`${PREFIX}/meta`);
    expect(response.status).toBe(200);
    const meta = (await response.json()) as {
      packageVersion: string;
      capabilities: { media: boolean; mediaUpload: { maxBytes: number; types: string[] } };
    };
    expect(meta.packageVersion).toBe("0.2.0");
    expect(meta.capabilities.media).toBe(true);
    expect(meta.capabilities.mediaUpload.maxBytes).toBe(MAX_BYTES);
    expect(meta.capabilities.mediaUpload.types).toEqual(
      [...ALLOWED.keys()].filter((type) => type !== "image/svg+xml"),
    );
    expect(meta.capabilities.mediaUpload.types).not.toContain("image/svg+xml");
  });
});

describe("media: the key still reaches only its prefix", () => {
  it("REFUSES the media routes off the prefix even with the key", async () => {
    await expect(mediaCall("GET", `${ORIGIN}/api/carrel/v2/media`)).rejects.toMatchObject({
      init: { status: 404 },
    });
    await expect(mediaCall("GET", `${ORIGIN}/api/carrel/media`)).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("REFUSES the operator token on the media routes", async () => {
    const response = await mediaCall("GET", `${PREFIX}/media`, { key: testEnv.OPERATOR_TOKEN });
    expect(response.status).toBe(401);
  });
});

describe("media: uploads the site would refuse are refused", () => {
  it("REFUSES an oversized upload with 413 and stores nothing", async () => {
    const before = await mediaCount();
    const bytes = new Uint8Array(MAX_BYTES + 1);
    bytes.set(PNG_SIGNATURE);
    const response = await mediaCall("POST", `${PREFIX}/media?filename=huge.png&changeId=chg-huge`, {
      body: bytes,
      type: "image/png",
    });
    expect(response.status).toBe(413);
    expect(await mediaCount()).toBe(before);
  });

  it("REFUSES image/svg+xml and application/pdf with 400 and stores nothing", async () => {
    const before = await mediaCount();
    const svg = await mediaCall("POST", `${PREFIX}/media?filename=a.svg&changeId=chg-svg`, {
      body: `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
      type: "image/svg+xml",
    });
    expect(svg.status).toBe(400);
    const pdf = await mediaCall("POST", `${PREFIX}/media?filename=a.pdf&changeId=chg-pdf`, {
      body: "%PDF-1.7 not really",
      type: "application/pdf",
    });
    expect(pdf.status).toBe(400);
    expect(await mediaCount()).toBe(before);
  });
});

describe("media: a delete is decided by the site's reference check", () => {
  it("REFUSES to delete a file a post uses, naming the post, and deletes nothing", async () => {
    const id = await uploadThroughApi("carrel-in-use");
    await seedPost("carrel-uses-the-file", {
      title: "The post that uses it",
      body: `An image: ![a](/media/${id})`,
    });

    const detail = await mediaCall("GET", `${PREFIX}/media/${id}`);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      id,
      usedBy: [{ type: "post", id: "carrel-uses-the-file", title: "The post that uses it" }],
    });

    const response = await mediaCall("DELETE", `${PREFIX}/media/${id}?changeId=chg-in-use`);
    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: string; message: string; usedBy: unknown[] };
    expect(body.error).toBe("refused");
    expect(body.message).toContain("The post that uses it");
    expect(body.usedBy).toEqual([
      expect.objectContaining({
        type: "post",
        id: "carrel-uses-the-file",
        title: "The post that uses it",
      }),
    ]);
    expect(await testEnv.MEDIA.get(id)).toBeTruthy();
    expect(await mediaRowOf(id)).toBeTruthy();
  });

  it("REFUSES to delete when the reference scan cannot complete, and deletes nothing", async () => {
    const id = await uploadThroughApi("carrel-scan-fails");
    /* Only the posts read fails, so the row lookup works and the scan is the one that breaks. */
    const brokenDb = new Proxy(testEnv.DB, {
      get(target, property) {
        if (property === "prepare") {
          return (query: string) => {
            if (/from "posts"/i.test(query)) throw new Error("planted posts read failure");
            return target.prepare(query);
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const response = await mediaCall(
      "DELETE",
      `${PREFIX}/media/${id}?changeId=chg-scan-fails`,
      {},
      { DB: brokenDb },
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "refused",
      message: expect.stringMatching(/^Nothing was deleted: the reference scan failed/),
    });
    expect(await testEnv.MEDIA.get(id)).toBeTruthy();
    expect(await mediaRowOf(id)).toBeTruthy();
  });

  it("REFUSES the detail when the reference scan cannot complete", async () => {
    const id = await uploadThroughApi("carrel-detail-scan-fails");
    /* Same planted posts failure as the delete case: the row lookup works, the scan does not. */
    const brokenDb = new Proxy(testEnv.DB, {
      get(target, property) {
        if (property === "prepare") {
          return (query: string) => {
            if (/from "posts"/i.test(query)) throw new Error("planted posts read failure");
            return target.prepare(query);
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const response = await mediaCall("GET", `${PREFIX}/media/${id}`, {}, { DB: brokenDb });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "refused",
      message: expect.stringMatching(
        /^The detail is refused: the reference scan failed \(posts\), so this file's uses are unknown\.$/,
      ),
    });
    expect(await testEnv.MEDIA.get(id)).toBeTruthy();
    expect(await mediaRowOf(id)).toBeTruthy();
  });

  it("answers 404 for an id the site never held", async () => {
    const response = await mediaCall(
      "DELETE",
      `${PREFIX}/media/carrel-conformance-probe/no-such-file.png?changeId=chg-missing`,
    );
    expect(response.status).toBe(404);
    expect((await mediaCall("GET", `${PREFIX}/media/no-such-file.png`)).status).toBe(404);
  });

  it("lists, reads and deletes an unused upload, removing the object and its row", async () => {
    const id = await uploadThroughApi("carrel-round-trip", "A round trip");
    expect(await mediaRowOf(id)).toMatchObject({ alt: "A round trip" });

    const list = await mediaCall("GET", `${PREFIX}/media?q=carrel-round-trip&limit=10`);
    expect(list.status).toBe(200);
    const listed = (await list.json()) as {
      items: Array<{ id: string; url: string; deletable: boolean }>;
    };
    expect(listed.items).toContainEqual(
      expect.objectContaining({ id, url: `/media/${id}`, deletable: true }),
    );
    expect(listed.items.every((item) => !item.id.startsWith("/"))).toBe(true);

    const detail = await mediaCall("GET", `${PREFIX}/media/${id}`);
    expect(await detail.json()).toMatchObject({
      id,
      contentType: "image/png",
      width: 10,
      height: 10,
      alt: "A round trip",
      filename: "carrel-round-trip.png",
      usedBy: [],
    });

    const response = await mediaCall("DELETE", `${PREFIX}/media/${id}?changeId=chg-round-trip`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id, deleted: true, changeId: "chg-round-trip" });
    expect(await testEnv.MEDIA.get(id)).toBeNull();
    expect(await mediaRowOf(id)).toBeNull();
  });
});
