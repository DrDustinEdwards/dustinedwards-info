import { createExecutionContext, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getBlogPost } from "~/db";
import { previewPost, withPublication } from "~/lib/carrel/site-adapter.server";
import { runCarrelSchedules } from "~/lib/carrel/site-api.server";
import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { postPath } from "~/lib/content/pipeline.mjs";
import { commitFiles } from "~/lib/source/store.server";
import { renderAndWrite, renderRecord } from "~/lib/editor/publish.server";
import { documentHandlerContext, postPreviewContext } from "~/lib/context";
import { LLMS_PATH } from "~/lib/llms/validate.mjs";
import { ALLOWED, MAX_BYTES } from "~/lib/media/upload-contract.mjs";
import { authenticateOperator } from "~/lib/operator/auth.server";
import { runTool } from "~/lib/operator/api.server";
import { action, loader } from "~/routes/api.carrel.v1.$";
import { loader as postLoader } from "~/routes/blog.$slug";
import { loader as twinLoader } from "~/routes/blog.$slug[.md]";
import { loader as previewLinkLoader } from "~/routes/preview.$token";

import { post } from "./fixtures";
import { putSource, removeSource, source, stubSources, versionOf, writes, type SourceStub } from "./source-stub";
import { bytesFor, envWithImages } from "./media-fixtures";
import { routeContext } from "./route-helpers";
import { seedMention, seedPost } from "./seed";
import { testEnv } from "./test-env";

/* Through the real route module, so the package's guard, the site's limiter and the adapter are the
 * ones that run in production. Each refusal also checks that the repository did not change. */

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
/** The stub's fixed head: the version every write here must name to land. */
const HEAD = "a".repeat(40);

const siteEnv = () => testEnv as unknown as Parameters<typeof renderAndWrite>[0];

/** One address per case, so the site's limiter (120 a minute per address) counts each case alone. */
let caller = 0;
const headersFor = (key: string) => ({
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
  "cf-connecting-ip": `198.51.100.${caller % 250}`,
});

const argsFor = (request: Request) => ({ request, context: routeContext(), params: {} }) as never;

function get(url: string, key: string = testEnv.CARREL_SITE_KEY): Promise<Response> {
  return loader(argsFor(new Request(url, { headers: headersFor(key) })));
}

function send(method: "PUT" | "POST" | "DELETE", url: string, body?: unknown): Promise<Response> {
  const request = new Request(url, {
    method,
    headers: headersFor(testEnv.CARREL_SITE_KEY),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return action(argsFor(request));
}

let gh: SourceStub;

beforeEach(async () => {
  caller += 1;
  gh = await stubSources();
});

afterEach(async () => {
  await gh.restore();
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
    await putSource(postPath("carrel-stale"), post("carrel-stale"));
    const before = (await source(postPath("carrel-stale")));

    const response = await send("PUT", `${PREFIX}/content/carrel-stale/draft`, {
      source: post("carrel-stale", { title: "Changed" }),
      expectedVersion: "b".repeat(40),
      changeId: "chg-stale",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "version-conflict",
      currentVersion: await gitBlobSha(before ?? ""),
    });
    expect((await source(postPath("carrel-stale")))).toBe(before);
  });

  it("REFUSES a version for an id that does not exist, with a null current version", async () => {
    const response = await send("POST", `${PREFIX}/content/carrel-missing/publish`, {
      expectedVersion: HEAD,
      changeId: "chg-missing",
      source: post("carrel-missing"),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "version-conflict", currentVersion: null });
    expect(((await source(postPath("carrel-missing"))) !== undefined)).toBe(false);
  });

  it("REFUSES a create over an id that exists", async () => {
    await putSource(postPath("carrel-taken"), post("carrel-taken"));
    const response = await send("PUT", `${PREFIX}/content/carrel-taken/draft`, {
      source: post("carrel-taken", { title: "Other" }),
      expectedVersion: null,
      changeId: "chg-taken",
    });
    expect(response.status).toBe(409);
  });
});

/* A post's version identifies that post's file, not the repository's head, so saving one post must not make
 * every other open post look changed (job_010ea9cff26c). */
describe("a post's version is its own", () => {
  const readVersion = async (id: string) => {
    const response = await get(`${PREFIX}/content/${id}`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { version: string }).version;
  };
  const save = (id: string, title: string, expectedVersion: string) =>
    send("PUT", `${PREFIX}/content/${id}/draft`, {
      source: post(id, { title }),
      expectedVersion,
      changeId: `chg-${id}-${title.replace(/\W+/g, "-")}`,
    });

  it("is the blob sha of the post's file at head", async () => {
    const raw = post("own-sha");
    await putSource(postPath("own-sha"), raw);
    expect(await readVersion("own-sha")).toBe(await gitBlobSha(raw));
  });

  it("does not change when another post is committed", async () => {
    await putSource(postPath("own-a"), post("own-a"));
    await putSource(postPath("own-b"), post("own-b"));
    const before = await readVersion("own-a");

    const saved = await save("own-b", "B edited", await readVersion("own-b"));
    expect(saved.status).toBe(200);

    expect(await readVersion("own-a")).toBe(before);
  });

  it("changes when this post is committed, and the save answers the new version", async () => {
    await putSource(postPath("own-c"), post("own-c"));
    const before = await readVersion("own-c");

    const saved = await save("own-c", "C edited", before);
    expect(saved.status).toBe(200);
    const answered = ((await saved.json()) as { version: string }).version;

    expect(answered).not.toBe(before);
    expect(await readVersion("own-c")).toBe(answered);
    expect(answered).toBe(await gitBlobSha((await source(postPath("own-c"))) ?? ""));
  });

  it("lets two posts be saved in one sitting without a false conflict", async () => {
    await putSource(postPath("own-d"), post("own-d"));
    await putSource(postPath("own-e"), post("own-e"));
    const d = await readVersion("own-d");
    const e = await readVersion("own-e");

    expect((await save("own-d", "D edited", d)).status).toBe(200);
    expect((await save("own-e", "E edited", e)).status).toBe(200);
  });

  it("still REFUSES a save made from a version this post has since moved past", async () => {
    await putSource(postPath("own-f"), post("own-f"));
    const opened = await readVersion("own-f");
    expect((await save("own-f", "F first", opened)).status).toBe(200);
    const afterFirst = (await source(postPath("own-f")));

    const stale = await save("own-f", "F second", opened);

    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: "version-conflict",
      currentVersion: await gitBlobSha(afterFirst ?? ""),
    });
    expect((await source(postPath("own-f")))).toBe(afterFirst);
  });

  it("answers the post's own version when a create finds the id taken", async () => {
    const raw = post("own-g");
    await putSource(postPath("own-g"), raw);
    const response = await send("PUT", `${PREFIX}/content/own-g/draft`, {
      source: post("own-g", { title: "Other" }),
      expectedVersion: null,
      changeId: "chg-own-g",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ currentVersion: await gitBlobSha(raw) });
  });
});

/* The check lives in commitFiles, against the head the commit is parented on, so a change that lands between a
 * writer's read and its write is refused there whichever kind is writing (job_d0ed3f93a4d3). */
describe("commitFiles refuses a file that is not the one the writer loaded", () => {
  const commit = (expected: string | null) =>
    commitFiles(testEnv as never, {
      message: "Update guarded",
      changes: [{ path: "content/guarded.md", content: "after\n" }],
      expectedBlobs: { "content/guarded.md": expected },
    });
  const commits = async () => (await writes()).length;

  it("REFUSES a write over a file that changed since it was loaded, and commits nothing", async () => {
    const loaded = await gitBlobSha("before\n");
    await putSource("content/guarded.md", "changed by someone else\n");
    await expect(commit(loaded)).rejects.toMatchObject({ conflict: true, status: 409 });
    expect((await commits())).toBe(0);
    expect((await source("content/guarded.md"))).toBe("changed by someone else\n");
  });

  it("REFUSES a write that expects the file absent when it exists", async () => {
    await putSource("content/guarded.md", "there\n");
    await expect(commit(null)).rejects.toMatchObject({ conflict: true });
    expect((await commits())).toBe(0);
  });

  it("commits when the file is the one that was loaded, and when an absent one is still absent", async () => {
    await putSource("content/guarded.md", "before\n");
    await commit(await gitBlobSha("before\n"));
    expect((await source("content/guarded.md"))).toBe("after\n");
    await removeSource("content/guarded.md");
    await commit(null);
    expect((await commits())).toBe(2);
  });
});

describe("the first publication", () => {
  it("ALLOWS it from Carrel's key, and the commit records who published", async () => {
    const draft = post("carrel-first", { draft: true });
    await putSource(postPath("carrel-first"), draft);

    const response = await send("POST", `${PREFIX}/content/carrel-first/publish`, {
      expectedVersion: await gitBlobSha(draft),
      changeId: "chg-first",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "published", changeId: "chg-first" });
    const saved = (await source(postPath("carrel-first"))) ?? "";
    expect(saved).toMatch(/^draft: false$/m);
    expect(saved).toMatch(/^first_published: /m);
    const commit = (await writes()).map((w) => ({ body: { message: w.message } }))[0];
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
    expect(((await source(postPath("carrel-operator-first"))) !== undefined)).toBe(false);
  });
});

describe("status belongs to the site", () => {
  it("keeps a live post live when Carrel saves its source", async () => {
    const live = post("carrel-live", { draft: false, first_published: "2026-07-01" });
    await putSource(postPath("carrel-live"), live);
    const response = await send("PUT", `${PREFIX}/content/carrel-live/draft`, {
      source: post("carrel-live", { draft: true, title: "Edited live" }),
      expectedVersion: await gitBlobSha(live),
      changeId: "chg-live",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "published" });
    expect((await source(postPath("carrel-live")))).toMatch(/^draft: false$/m);
  });

  it("changes only the draft and publish_at lines, so keys the editor does not know survive", () => {
    const raw = `---\ntitle: "T"\ndraft: true\nwriting_status: draft\nkey_takeaways:\n  - one\n---\n\nBody\n`;
    const out = withPublication(raw, { draft: false, publishAt: "2026-12-01T09:00:00.000Z" });
    expect(out).toBe(
      `---\ntitle: "T"\ndraft: false\nwriting_status: draft\nkey_takeaways:\n  - one\npublish_at: "2026-12-01T09:00:00.000Z"\n---\n\nBody\n`,
    );
  });
});

describe("a scheduled update to a live post", () => {
  it("keeps the live post served until its time, then the cron puts the update live and drops it", async () => {
    const live = post("carrel-later", { draft: false, first_published: "2026-07-01", title: "Live" });
    await putSource(postPath("carrel-later"), live);
    const at = new Date(Date.now() + 3_600_000).toISOString();

    const response = await send("POST", `${PREFIX}/content/carrel-later/schedule`, {
      source: post("carrel-later", { draft: false, first_published: "2026-07-01", title: "Updated" }),
      publishAt: at,
      expectedVersion: await gitBlobSha(live),
      changeId: "chg-later",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "published", scheduledUpdate: { changeId: "chg-later" } });
    expect(await source(postPath("carrel-later"))).toBe(live);

    const env = siteEnv() as unknown as Env;
    const early = await runCarrelSchedules(env, createExecutionContext(), new Date());
    expect(early.applied).toHaveLength(0);

    const run = await runCarrelSchedules(env, createExecutionContext(), new Date(Date.parse(at) + 1000));
    expect(run).toMatchObject({ applied: [{ id: "carrel-later", kind: "update" }], failed: 0 });
    const saved = (await source(postPath("carrel-later"))) ?? "";
    expect(saved).toMatch(/^title: "?Updated"?$/m);
    expect(saved).toMatch(/^draft: false$/m);
    expect((await get(`${PREFIX}/content/carrel-later/schedule`)).status).toBe(404);
  });
});

describe("the preview", () => {
  it("builds exactly the loader data the published page reads from D1", async () => {
    const raw = post("carrel-preview-match", { draft: false, first_published: "2026-07-01" });
    await putSource(postPath("carrel-preview-match"), raw);
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

  it("ALLOWS a draft with no front matter as \"Untitled\", and a save of it is still REFUSED", async () => {
    const request = new Request(`${PREFIX}/preview`, {
      method: "POST",
      headers: headersFor(testEnv.CARREL_SITE_KEY),
      body: JSON.stringify({ source: "# A heading only\n" }),
    });
    const args = argsFor(request) as unknown as { context: ReturnType<typeof routeContext> };
    args.context.set(documentHandlerContext, async (_request, context) =>
      new Response(`<title>${context.get(postPreviewContext)?.title}</title>`, { headers: { "content-type": "text/html" } }),
    );
    const preview = await action(args as never);
    expect(preview.status).toBe(200);
    expect(await preview.text()).toContain("<title>Untitled</title>");

    const saved = await send("PUT", `${PREFIX}/content/no-title/draft`, {
      source: "# A heading only\n",
      expectedVersion: null,
      changeId: "chg-no-title",
    });
    expect(saved.status).toBe(422);
    expect(await source(postPath("no-title"))).toBeUndefined();
  });
});

/* Media (site-api v0.2.0): the site's own store, list, reference check and delete, behind the same
 * key and limiter. Each case uploads its own bytes, so its own content-addressed key. */

type MediaInit = { body?: BodyInit; type?: string; key?: string };

/** Through the route, with the recorded IMAGES binding and anything in `overrides` over the env. */
function mediaCall(
  method: "GET" | "POST" | "PUT" | "DELETE",
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
    body: bytesFor(seed),
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

/* The focal point, caption and replace (site-api v0.10.0). */

type MediaJson = { id: string; version: string; focus?: string | null; caption?: string; sizesNeedPurge?: boolean };

const mediaItem = async (id: string) => (await (await mediaCall("GET", `${PREFIX}/media/${id}`)).json()) as MediaJson;

function putJson(path: string, body: unknown) {
  return mediaCall("PUT", `${PREFIX}${path}`, { body: JSON.stringify(body) });
}

describe("media: focal point, caption and replace", () => {
  it("keeps a focal point on the object, where ./image crops around it, and moves the version", async () => {
    const id = await uploadThroughApi("focus-case");
    const before = await mediaItem(id);
    const response = await putJson(`/media/${id}/focus`, { focus: "0.25x0.4", expectedVersion: before.version, changeId: "chg-focus" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await testEnv.MEDIA.head(id))?.customMetadata?.focus).toBe("0.25x0.4");
    const after = await mediaItem(id);
    expect(after.focus).toBe("0.25x0.4");
    expect(after.version).not.toBe(before.version);
  });

  it("keeps a caption in the media index", async () => {
    const id = await uploadThroughApi("caption-case");
    const { version } = await mediaItem(id);
    const response = await putJson(`/media/${id}/caption`, { caption: "Plaques on a lawn", expectedVersion: version, changeId: "chg-caption" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await mediaItem(id)).caption).toBe("Plaques on a lawn");
  });

  it("replaces the bytes under the same address, clears the focal point and keeps the old bytes in the backup", async () => {
    const id = await uploadThroughApi("replace-case");
    let { version } = await mediaItem(id);
    const focused = await putJson(`/media/${id}/focus`, { focus: "0.1x0.9", expectedVersion: version, changeId: "chg-rf" });
    ({ version } = (await focused.json()) as MediaJson);
    const original = new Uint8Array(await (await testEnv.MEDIA.get(id))!.arrayBuffer());

    const query = new URLSearchParams({ filename: "replace-case-2.png", changeId: "chg-replace", expectedVersion: version });
    const response = await mediaCall(
      "PUT",
      `${PREFIX}/media/${id}/file?${query}`,
      { body: bytesFor("replace-case-2"), type: "image/png" },
      { MEDIA_BACKUP: testEnv.BACKUPS },
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id, focus: null, sizesNeedPurge: false });
    expect(new Uint8Array(await (await testEnv.MEDIA.get(id))!.arrayBuffer())).toEqual(bytesFor("replace-case-2"));
    const kept = (await testEnv.BACKUPS.list({ prefix: "replaced/" })).objects.find((o) => o.key.endsWith(`/${id}`));
    expect(kept, "the old bytes were not kept").toBeDefined();
    expect(new Uint8Array(await (await testEnv.BACKUPS.get(kept!.key))!.arrayBuffer())).toEqual(original);
  });
});

/* Alt, tags and the trash (site-api v0.4.0), through the admin library's own core writes. */

const sendJson = (method: "PUT" | "POST", path: string, body: unknown) =>
  mediaCall(method, `${PREFIX}${path}`, { body: JSON.stringify(body) });

const listIds = async (query: string) =>
  ((await (await mediaCall("GET", `${PREFIX}/media?${query}`)).json()) as { items: MediaJson[] }).items.map((i) => i.id);

describe("media: alt, tags and the trash", () => {
  it("REFUSES a stale version with 409 even within the same second, and keeps the first write", async () => {
    const id = await uploadThroughApi("alt-race");
    const { version } = await mediaItem(id);
    const first = await sendJson("PUT", `/media/${id}/alt`, { alt: "First", expectedVersion: version, changeId: "chg-alt-1" });
    expect(first.status, await first.clone().text()).toBe(200);
    const moved = ((await first.json()) as MediaJson).version;
    expect(moved).not.toBe(version);

    // Sent at once, from the same loaded version: updated_at alone could not tell these apart.
    const second = await sendJson("PUT", `/media/${id}/alt`, { alt: "Second", expectedVersion: version, changeId: "chg-alt-2" });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: "version-conflict", currentVersion: moved });
    expect(await mediaRowOf(id)).toMatchObject({ alt: "First" });
  });

  it("filters by tag, and trash hides a file from the library until it is restored", async () => {
    const id = await uploadThroughApi("tag-trash");
    let { version } = await mediaItem(id);
    const tagged = await sendJson("PUT", `/media/${id}/tags`, { tags: ["field-notes"], expectedVersion: version, changeId: "chg-tag" });
    expect(tagged.status, await tagged.clone().text()).toBe(200);
    ({ version } = (await tagged.json()) as MediaJson);
    expect(await listIds("tag=field-notes")).toEqual([id]);
    // The count is across every page, of the same rows the page lists.
    expect(((await (await mediaCall("GET", `${PREFIX}/media?tag=field-notes&limit=1`)).json()) as { total?: number }).total).toBe(1);

    const trashed = await sendJson("POST", `/media/${id}/trash`, { expectedVersion: version, changeId: "chg-trash" });
    expect(trashed.status, await trashed.clone().text()).toBe(200);
    ({ version } = (await trashed.json()) as MediaJson);
    expect(await listIds("tag=field-notes")).toEqual([]);
    expect(await listIds("trashed=only&tag=field-notes")).toEqual([id]);
    // The object stays, so a page that uses it keeps rendering.
    expect(await testEnv.MEDIA.head(id)).not.toBeNull();

    const restored = await sendJson("POST", `/media/${id}/restore`, { expectedVersion: version, changeId: "chg-restore" });
    expect(restored.status, await restored.clone().text()).toBe(200);
    expect(await listIds("tag=field-notes")).toEqual([id]);
  });
});

/* The media library's v0.13.0 ideas: duplicates, turns with their history, the change log, embedded metadata,
 * the shrink at upload and the model's suggestions. Images and Workers AI have no local emulation, so both are
 * recorded shapes: the transformer appends what it was asked to do, so its output differs from its input. */

type Size = { width: number; height: number };

/** An IMAGES binding that measures by `size` (or `sizeAfter` once a transform has run) and marks what it transformed. */
function imagesThatTransform(size: Size = { width: 10, height: 10 }, sizeAfter: (steps: string) => Size = () => size) {
  const marker = "|transformed:";
  return {
    info: async (stream: ReadableStream) => {
      const text = new TextDecoder().decode(await new Response(stream).arrayBuffer());
      const at = text.lastIndexOf(marker);
      return at === -1 ? size : sizeAfter(text.slice(at + marker.length));
    },
    input: (stream: ReadableStream) => {
      const steps: unknown[] = [];
      const handle = {
        transform: (step: unknown) => {
          steps.push(step);
          return handle;
        },
        output: async () => {
          const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
          const marked = new Uint8Array([...bytes, ...new TextEncoder().encode(`${marker}${JSON.stringify(steps)}`)]);
          return { response: () => new Response(marked) };
        },
      };
      return handle;
    },
  };
}

/** A JPEG whose EXIF names an artist, a copyright and when it was taken, big-endian as many cameras write it. */
function exifJpeg(fields: { artist: string; copyright: string; taken: string; offset: string }) {
  const ascii = (s: string) => new TextEncoder().encode(`${s}\u0000`);
  const tiff = new Uint8Array(512);
  const view = new DataView(tiff.buffer);
  let dataAt = 80;
  const place = (bytes: Uint8Array) => {
    tiff.set(bytes, dataAt);
    dataAt += bytes.length;
    return dataAt - bytes.length;
  };
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(at, tag);
    view.setUint16(at + 2, type);
    view.setUint32(at + 4, count);
    view.setUint32(at + 8, value);
  };
  tiff.set([0x4d, 0x4d, 0, 42, 0, 0, 0, 8]);
  view.setUint16(8, 3);
  const [artist, copyright, taken, offset] = [ascii(fields.artist), ascii(fields.copyright), ascii(fields.taken), ascii(fields.offset)];
  entry(10, 0x013b, 2, artist.length, place(artist));
  entry(22, 0x8298, 2, copyright.length, place(copyright));
  entry(34, 0x8769, 4, 1, 50);
  view.setUint16(50, 2);
  entry(52, 0x9003, 2, taken.length, place(taken));
  entry(64, 0x9011, 2, offset.length, place(offset));
  const body = tiff.subarray(0, dataAt);
  const length = 2 + 6 + body.length;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0, ...body, 0xff, 0xd9]);
}

const uploadQuery = (seed: string, extra: Record<string, string> = {}) =>
  new URLSearchParams({ filename: `${seed}.png`, changeId: `chg-${seed}`, ...extra });

const objectBytes = async (id: string) => new Uint8Array(await (await testEnv.MEDIA.get(id))!.arrayBuffer());

type Revision = { rev: string; reason: string; current: boolean };

describe("media: the v0.13.0 library", () => {
  it("answers an upload of bytes it already holds with that file, under any name, and stores nothing new", async () => {
    const id = await uploadThroughApi("duplicate-case");
    const before = await mediaCount();
    const response = await mediaCall("POST", `${PREFIX}/media?${uploadQuery("duplicate-case-renamed")}`, {
      body: bytesFor("duplicate-case"),
      type: "image/png",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id, duplicateOf: id });
    expect(await mediaCount()).toBe(before);
  });

  it("mirrors a picture in place, keeps the old bytes in its history, and a revert puts them back", async () => {
    const overrides = { MEDIA_BACKUP: testEnv.BACKUPS, IMAGES: imagesThatTransform() };
    const id = await uploadThroughApi("transform-case");
    const original = await objectBytes(id);
    const { version } = await mediaItem(id);

    const turned = await mediaCall("POST", `${PREFIX}/media/${id}/transform`, { body: JSON.stringify({ op: "flip-h", expectedVersion: version, changeId: "chg-flip" }) }, overrides);
    expect(turned.status, await turned.clone().text()).toBe(200);
    const after = (await turned.json()) as MediaJson & { asNewFile: boolean };
    expect(after).toMatchObject({ id, asNewFile: false });
    expect(await objectBytes(id)).not.toEqual(original);

    const history = (await (await mediaCall("GET", `${PREFIX}/media/${id}/history`, {}, overrides)).json()) as { revisions: Revision[] };
    expect(history.revisions.map((r) => [r.reason, r.current])).toEqual([["transform", true], ["upload", false]]);

    const reverted = await mediaCall("POST", `${PREFIX}/media/${id}/revert`, { body: JSON.stringify({ to: history.revisions[1]!.rev, expectedVersion: after.version, changeId: "chg-revert" }) }, overrides);
    expect(reverted.status, await reverted.clone().text()).toBe(200);
    expect(await objectBytes(id)).toEqual(original);
  });

  it("turns a picture that is not square into a new file with its alt, leaving the old one as it was", async () => {
    const overrides = { MEDIA_BACKUP: testEnv.BACKUPS, IMAGES: imagesThatTransform({ width: 20, height: 10 }, () => ({ width: 10, height: 20 })) };
    const upload = await mediaCall("POST", `${PREFIX}/media?${uploadQuery("turn-case", { alt: "A wide chart" })}`, { body: bytesFor("turn-case"), type: "image/png" }, overrides);
    const { id, version } = (await upload.json()) as MediaJson;
    const original = await objectBytes(id);

    const turned = await mediaCall("POST", `${PREFIX}/media/${id}/transform`, { body: JSON.stringify({ op: "rotate-90", expectedVersion: version, changeId: "chg-turn" }) }, overrides);
    expect(turned.status, await turned.clone().text()).toBe(200);
    const made = (await turned.json()) as MediaJson & { asNewFile: boolean; width: number; height: number; alt: string };
    expect(made).toMatchObject({ asNewFile: true, width: 10, height: 20, alt: "A wide chart" });
    expect(made.id).not.toBe(id);
    expect(made.id).toMatch(/-10x20\.png$/);
    expect(await objectBytes(id)).toEqual(original);
    expect((await mediaItem(id)).version).toBe(version);
  });

  it("says what changed since a cursor, and names a file deleted for good", async () => {
    const first = (await (await mediaCall("GET", `${PREFIX}/media?limit=1`)).json()) as { changeCursor: string };
    const id = await uploadThroughApi("changes-case");
    type Changes = { items: MediaJson[]; removed: string[]; changeCursor: string; moreChanges: boolean };
    const changed = (await (await mediaCall("GET", `${PREFIX}/media?changedSince=${first.changeCursor}`)).json()) as Changes;
    expect(changed.items.map((i) => i.id)).toContain(id);
    expect(changed.removed).toEqual([]);

    expect((await mediaCall("DELETE", `${PREFIX}/media/${id}?changeId=chg-changes-delete`)).status).toBe(200);
    const after = (await (await mediaCall("GET", `${PREFIX}/media?changedSince=${changed.changeCursor}`)).json()) as Changes;
    expect(after.removed).toEqual([id]);
    expect(after.items.map((i) => i.id)).not.toContain(id);
  });

  it("fills credit, license and the date taken from a JPEG's EXIF, and names what it filled", async () => {
    const bytes = exifJpeg({ artist: "Example Photographer", copyright: "CC BY 4.0", taken: "2024:05:06 14:30:00", offset: "+01:00" });
    const query = new URLSearchParams({ filename: "exif-case.jpg", changeId: "chg-exif" });
    const response = await mediaCall("POST", `${PREFIX}/media?${query}`, { body: bytes, type: "image/jpeg" });
    expect(response.status, await response.clone().text()).toBe(201);
    expect(await response.json()).toMatchObject({
      credit: "Example Photographer",
      license: "CC BY 4.0",
      takenAt: "2024-05-06T14:30:00+01:00",
      embedded: ["credit", "license", "takenAt"],
    });
  });

  it("shrinks a large picture at upload, unless asked not to, and keeps the original", async () => {
    const overrides = { MEDIA_BACKUP: testEnv.BACKUPS, IMAGES: imagesThatTransform({ width: 8000, height: 6000 }, () => ({ width: 4096, height: 3072 })) };
    const response = await mediaCall("POST", `${PREFIX}/media?${uploadQuery("resize-case")}`, { body: bytesFor("resize-case"), type: "image/png" }, overrides);
    expect(response.status, await response.clone().text()).toBe(201);
    const shrunk = (await response.json()) as MediaJson & { width: number; resizedFrom?: Size & { bytes: number } };
    expect(shrunk).toMatchObject({ width: 4096, resizedFrom: { width: 8000, height: 6000, bytes: bytesFor("resize-case").length } });
    const kept = (await testEnv.BACKUPS.list({ prefix: "resized/" })).objects.find((o) => o.key.endsWith(`/${shrunk.id}`));
    expect(kept, "the original was not kept").toBeDefined();
    expect(new Uint8Array(await (await testEnv.BACKUPS.get(kept!.key))!.arrayBuffer())).toEqual(bytesFor("resize-case"));

    const kept2 = await mediaCall("POST", `${PREFIX}/media?${uploadQuery("resize-no-case", { resize: "no" })}`, { body: bytesFor("resize-no-case"), type: "image/png" }, overrides);
    expect(await kept2.json()).toMatchObject({ width: 8000, height: 6000 });
  });

  it("suggests tags and alt text from the model, in the contract's spelling, and applies neither", async () => {
    const id = await uploadThroughApi("suggest-case");
    const sent: unknown[] = [];
    const AI = {
      run: async (model: string, input: unknown) => {
        sent.push({ model, input });
        return { response: 'Here you are: {"alt": "Three brass plaques set in a lawn.", "tags": ["Plaques", "lawn", "lawn", "not a tag!"]}' };
      },
    };
    const response = await mediaCall("GET", `${PREFIX}/media/${id}/suggestions`, {}, { AI, IMAGES: imagesThatTransform() });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id, alt: "Three brass plaques set in a lawn.", tags: ["plaques", "lawn"] });
    expect(JSON.stringify(sent)).toContain("data:image/jpeg;base64,");
    expect(await mediaItem(id)).toMatchObject({ alt: "", tags: [] });
  });
});

describe("media: meta declares what the site accepts", () => {
  it("names media and the admin library's limits less SVG", async () => {
    const response = await get(`${PREFIX}/meta`);
    expect(response.status).toBe(200);
    const meta = (await response.json()) as {
      capabilities: { media: boolean; mediaUpload: { maxBytes: number; types: string[] } };
    };
    expect(meta.capabilities.media).toBe(true);
    expect(meta.capabilities).toMatchObject({ mediaAlt: true, mediaTags: true, mediaTrash: true });
    // v0.13.0: every idea but the resize pass, which a site whose addresses carry the size never offers.
    expect(meta.capabilities).toMatchObject({
      mediaDuplicates: true, mediaUsage: true, mediaFilters: true, mediaImport: true, mediaCredit: true, mediaTransform: true,
      mediaHistory: true, mediaChanges: true, mediaResize: { maxEdge: 4096, quality: 85 }, mediaEmbedded: true, mediaSuggestions: true,
    });
    expect(meta.capabilities).not.toHaveProperty("mediaResizePass");
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
    bytes.set(bytesFor("huge"));
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

/* site-api v0.3.0: the source at a revision, and the optional content delete (job_3839c2d00cb6). */
describe("a revision's source", () => {
  it("opens an old revision of a post, and answers 404 for a version the repository does not hold", async () => {
    await putSource(postPath("rev-open"), post("rev-open"));
    const sha = await versionOf(postPath("rev-open"));
    await putSource(postPath("rev-open"), post("rev-open", { title: "Retitled" }));
    const found = await get(`${PREFIX}/content/rev-open/revisions/${sha}`);
    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({ id: "rev-open", version: sha, source: post("rev-open") });

    const notAVersion = await get(`${PREFIX}/content/rev-open/revisions/not-a-sha`);
    expect(notAVersion.status).toBe(404);
  });
});

describe("content delete", () => {
  const remove = (id: string, expectedVersion: string, changeId: string, key?: string) =>
    mediaCall(
      "DELETE",
      `${PREFIX}/content/${id}?expectedVersion=${encodeURIComponent(expectedVersion)}&changeId=${changeId}`,
      key ? { key } : {},
    );
  const commits = async () => (await writes()).map((w) => ({ body: { message: w.message } }));

  it("is declared in meta.capabilities", async () => {
    const meta = (await (await get(`${PREFIX}/meta`)).json()) as { capabilities: { contentDelete?: boolean } };
    expect(meta.capabilities.contentDelete).toBe(true);
  });

  it("deletes the post at its current version, records the change id, and clears its rows", async () => {
    const raw = post("del-ok");
    await putSource(postPath("del-ok"), raw);
    await seedPost("del-ok");

    const response = await remove("del-ok", await gitBlobSha(raw), "chg-del-ok");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "del-ok", deleted: true, changeId: "chg-del-ok" });
    expect(((await source(postPath("del-ok"))) !== undefined)).toBe(false);
    expect((await commits())).toHaveLength(1);
    expect(JSON.stringify((await commits())[0]?.body)).toContain("[carrel:chg-del-ok]");
    expect(await getBlogPost(testEnv as never, "del-ok")).toBeNull();
  });

  it("REFUSES a stale version, names the current one, and deletes nothing", async () => {
    const raw = post("del-stale");
    await putSource(postPath("del-stale"), raw);

    const response = await remove("del-stale", "b".repeat(40), "chg-del-stale");

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "version-conflict",
      currentVersion: await gitBlobSha(raw),
    });
    expect((await source(postPath("del-stale")))).toBe(raw);
    expect((await commits())).toHaveLength(0);
  });

  it("answers 404 for a post the site does not hold", async () => {
    const response = await remove("del-missing", "a".repeat(40), "chg-del-missing");
    expect(response.status).toBe(404);
    expect((await commits())).toHaveLength(0);
  });

  it("REFUSES a kind that has no delete, and deletes nothing", async () => {
    const response = await remove("page.privacy", "a".repeat(40), "chg-del-page");
    expect(response.status).toBe(422);
    expect((await commits())).toHaveLength(0);
  });

  it("REFUSES without the key", async () => {
    const raw = post("del-nokey");
    await putSource(postPath("del-nokey"), raw);
    const response = await remove("del-nokey", await gitBlobSha(raw), "chg-del-nokey", "wrong-key");
    expect(response.status).toBe(401);
    expect((await source(postPath("del-nokey")))).toBe(raw);
  });

});

describe("the v0.17.0 contract on posts", () => {
  const live = (slug: string) => post(slug, { draft: false, first_published: "2026-07-01" });
  const list = async (query: string) =>
    (await (await get(`${PREFIX}/content?${query}`)).json()) as {
      items: Array<{ id: string; trashedAt?: string | null; version?: string }>;
      filtered?: string[];
    };

  it("trashes a live post off the site, lists it only in the trash, and restores it as a draft", async () => {
    await putSource(postPath("v17-trash"), live("v17-trash"));
    await seedPost("v17-trash");

    const trashed = await send("POST", `${PREFIX}/content/v17-trash/trash`, {
      expectedVersion: await versionOf(postPath("v17-trash")),
      changeId: "chg-v17-trash",
    });
    expect(trashed.status).toBe(200);
    expect(await trashed.json()).toMatchObject({ status: "draft" });
    expect(await source(postPath("v17-trash"))).toMatch(/^draft: true$/m);

    expect((await list("limit=200")).items.map((i) => i.id)).not.toContain("v17-trash");
    const trash = await list("trashed=true&kind=post&limit=200");
    expect(trash.filtered).toEqual(["kind", "trashed"]);
    expect(trash.items).toEqual([
      expect.objectContaining({ id: "v17-trash", version: await versionOf(postPath("v17-trash")), trashedAt: expect.any(String) }),
    ]);

    const version = await versionOf(postPath("v17-trash"));
    const republish = await send("POST", `${PREFIX}/content/v17-trash/publish`, { expectedVersion: version, changeId: "chg-v17-pub" });
    expect(republish.status).toBe(422);
    const restored = await send("POST", `${PREFIX}/content/v17-trash/restore`, { expectedVersion: version, changeId: "chg-v17-restore" });
    expect(await restored.json()).toMatchObject({ status: "draft" });
    expect((await list("limit=200")).items.map((i) => i.id)).toContain("v17-trash");
  });

  it("renames a live post with its history, and its old address answers a permanent redirect", async () => {
    await putSource(postPath("v17-old"), live("v17-old"));
    const renamed = await send("POST", `${PREFIX}/content/v17-old/rename`, {
      newId: "v17-new",
      expectedVersion: await versionOf(postPath("v17-old")),
      changeId: "chg-v17-rename",
    });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({ id: "v17-new", status: "published", previousPath: "/writing/v17-old" });
    expect(await source(postPath("v17-old"))).toBeUndefined();
    expect(await source(postPath("v17-new"))).toMatch(/^slug: v17-new$/m);
    const history = (await (await get(`${PREFIX}/content/v17-new/revisions`)).json()) as { items: unknown[] };
    expect(history.items).toHaveLength(2);

    // A missing page is thrown as router data, which the wire carries as its status.
    const page = async (slug: string) => {
      const thrown = await (postLoader({ request: new Request(`${ORIGIN}/writing/${slug}`), params: { slug }, context: routeContext() } as never) as Promise<unknown>).catch(
        (error: unknown) => error,
      );
      return thrown instanceof Response ? thrown : new Response(null, { status: (thrown as { init?: { status?: number } }).init?.status ?? 200 });
    };
    const twin = (slug: string) =>
      twinLoader({ request: new Request(`${ORIGIN}/writing/${slug}.md`), params: { slug }, context: routeContext() } as never) as Promise<Response>;
    const moved = await page("v17-old");
    expect(moved).toBeInstanceOf(Response);
    expect(moved.status).toBe(301);
    expect(moved.headers.get("location")).toBe("/writing/v17-new");
    const movedTwin = await twin("v17-old");
    expect(movedTwin.status).toBe(301);
    expect(movedTwin.headers.get("location")).toBe("/writing/v17-new.md");

    // Once the post it leads to is deleted, the old address no longer redirects to a page that is gone.
    const deleted = await send(
      "DELETE",
      `${PREFIX}/content/v17-new?expectedVersion=${await versionOf(postPath("v17-new"))}&changeId=chg-v17-delete`,
    );
    expect(deleted.status).toBe(200);
    expect((await page("v17-old")).status).toBe(404);
    expect((await twin("v17-old")).status).toBe(404);
  });

  it("records a revision for every publish, unpublish and rename, each naming the person, with every field", async () => {
    await putSource(postPath("v17-history"), post("v17-history", { tags: "[alpha]" }));
    const step = async (path: string, body: object) => {
      const response = await send("POST", `${PREFIX}/content/${path}`, {
        expectedVersion: await versionOf(postPath(path.split("/")[0]!)),
        ...body,
      });
      expect(response.status, path).toBe(200);
    };
    await step("v17-history/publish", { changeId: "chg-hist-pub" });
    await step("v17-history/unpublish", { changeId: "chg-hist-unpub" });
    await step("v17-history/rename", { changeId: "chg-hist-rename", newId: "v17-history-moved" });

    const history = (await (await get(`${PREFIX}/content/v17-history-moved/revisions`)).json()) as {
      items: Array<{ version: string; author: string; authors?: string[]; message: string }>;
    };
    expect(history.items.slice(0, 3).map((r) => r.message)).toEqual([
      expect.stringContaining("[carrel:chg-hist-rename]"),
      expect.stringContaining("[carrel:chg-hist-unpub]"),
      expect.stringContaining("[carrel:chg-hist-pub]"),
    ]);
    expect(history.items.every((r) => r.author === "Dustin Edwards" && r.authors?.[0] === "Dustin Edwards")).toBe(true);
    // A revision is the whole file, so the published one holds its tags and its status alike.
    const published = await get(`${PREFIX}/content/v17-history-moved/revisions/${history.items[2]!.version}`);
    const { source: was } = (await published.json()) as { source: string };
    expect(was).toMatch(/^draft: false$/m);
    expect(was).toMatch(/^tags: \[alpha\]$/m);
  });

  it("publishes under the date Carrel names", async () => {
    await putSource(postPath("v17-dated"), post("v17-dated"));
    const response = await send("POST", `${PREFIX}/content/v17-dated/publish`, {
      expectedVersion: await versionOf(postPath("v17-dated")),
      changeId: "chg-v17-dated",
      publishedAt: "2025-03-04T05:06:07.000Z",
    });
    expect(await response.json()).toMatchObject({ status: "published" });
    const saved = (await source(postPath("v17-dated"))) ?? "";
    expect(saved).toMatch(/^date: 2025-03-04$/m);
    expect(saved).toMatch(/^publish_at: "2025-03-04T05:06:07.000Z"$/m);

    // The read and the list name the date it is published under, not the day it first went out.
    const doc = (await (await get(`${PREFIX}/content/v17-dated`)).json()) as { publishedAt: string };
    expect(doc.publishedAt).toBe("2025-03-04T05:06:07.000Z");
    const listed = (await list("kind=post&limit=200")).items.find((i) => i.id === "v17-dated") as { publishedAt?: string };
    expect(listed.publishedAt).toBe(doc.publishedAt);
  });

  it("reads this site's older keys as site-api's post fields, writes the package's, and filters by author", async () => {
    await putSource(postPath("v17-fields"), post("v17-fields", { series: ["Fields", 2] }));
    const meta = (await (await get(`${PREFIX}/meta`)).json()) as { capabilities: { postFields?: string[]; contentFilters?: string[] } };
    expect(meta.capabilities.postFields).toEqual(["excerpt", "authors", "series", "seriesPart"]);
    expect(meta.capabilities.contentFilters).toContain("author");

    const doc = (await (await get(`${PREFIX}/content/v17-fields`)).json()) as { source: string; version: string };
    expect(doc.source).toMatch(/^excerpt: "A description for v17-fields/m);
    expect(doc.source).toMatch(/^seriesPart: 2$/m);
    expect(doc.source).not.toMatch(/^(description|part):/m);

    const credited = doc.source.replace(/^excerpt:/m, 'authors: ["Sample Author", "Dustin Edwards"]\nexcerpt:');
    const saved = await send("PUT", `${PREFIX}/content/v17-fields/draft`, {
      source: credited,
      expectedVersion: doc.version,
      changeId: "chg-v17-fields",
    });
    expect(saved.status).toBe(200);
    expect(await source(postPath("v17-fields"))).toMatch(/^excerpt: /m);

    const byAuthor = (await (await get(`${PREFIX}/content?author=Sample%20Author&limit=200`)).json()) as {
      items: Array<{ id: string; authors?: string[]; excerpt?: string }>;
    };
    expect(byAuthor.items).toEqual([
      expect.objectContaining({
        id: "v17-fields",
        authors: ["Sample Author", "Dustin Edwards"],
        excerpt: expect.stringContaining("A description for v17-fields"),
      }),
    ]);
    const owner = (await (await get(`${PREFIX}/content?author=Dustin%20Edwards&kind=post&limit=200`)).json()) as {
      items: Array<{ id: string }>;
    };
    expect(owner.items.length).toBeGreaterThan(0);
  });

  it("sets a post's whole tag set as a save", async () => {
    await putSource(postPath("v17-tags"), post("v17-tags", { tags: "[old]" }));
    const before = await versionOf(postPath("v17-tags"));
    const response = await send("PUT", `${PREFIX}/content/v17-tags/tags`, {
      tags: ["alpha", "beta two"],
      expectedVersion: before,
      changeId: "chg-v17-tags",
    });
    expect(response.status).toBe(200);
    expect(await source(postPath("v17-tags"))).toMatch(/^tags: \[alpha, beta two\]$/m);
    expect(await versionOf(postPath("v17-tags"))).not.toBe(before);
  });

  it("lists with a total, in the order asked, and finds a word in the body", async () => {
    for (const [slug, title] of [["v17-order-b", "Banana"], ["v17-order-a", "Apple"], ["v17-order-c", "Cherry"]] as const) {
      const made = await send("PUT", `${PREFIX}/content/${slug}/draft`, {
        source: post(slug, { title, body: `A paragraph about the quokkaword ${slug}.\n` }),
        expectedVersion: null,
        changeId: `chg-${slug}`,
      });
      expect(made.status).toBe(200);
    }
    const found = (await (await get(`${PREFIX}/content?q=quokkaword&sort=title&dir=asc&limit=2`)).json()) as {
      items: Array<{ id: string }>;
      total?: number;
      sorted?: { sort: string; dir: string };
      nextCursor: string | null;
    };
    expect(found.total).toBe(3);
    expect(found.sorted).toEqual({ sort: "title", dir: "asc" });
    expect(found.items.map((i) => i.id)).toEqual(["v17-order-a", "v17-order-b"]);
    expect(found.nextCursor).not.toBeNull();
  });

  it("announces a first publish that goes live by time once, with no write", async () => {
    await putSource(postPath("v17-later"), post("v17-later"));
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const scheduled = await send("POST", `${PREFIX}/content/v17-later/schedule`, {
      publishAt: at,
      expectedVersion: await versionOf(postPath("v17-later")),
      changeId: "chg-v17-later",
    });
    expect(await scheduled.json()).toMatchObject({ status: "scheduled" });
    const version = await versionOf(postPath("v17-later"));

    const env = siteEnv() as unknown as Env;
    const after = new Date(Date.parse(at) + 1000);
    const run = await runCarrelSchedules(env, createExecutionContext(), after);
    expect(run.applied).toEqual([expect.objectContaining({ id: "v17-later", kind: "publish", version })]);
    expect(await versionOf(postPath("v17-later"))).toBe(version);
    expect((await runCarrelSchedules(env, createExecutionContext(), after)).applied).toEqual([]);
  });

  it("serves a preview link with no key, noindex and never stored, and refuses an unknown token", async () => {
    await putSource(postPath("v17-share"), post("v17-share", { title: "Shared draft" }));
    const made = await send("POST", `${PREFIX}/preview-links`, { id: "v17-share", changeId: "chg-v17-share" });
    expect(made.status).toBe(201);
    const { url } = (await made.json()) as { url: string };
    const token = new URL(url).pathname.split("/").pop()!;

    const open = (path: string) => {
      const context = routeContext();
      context.set(documentHandlerContext, async (_request, ctx) =>
        new Response(`<title>${ctx.get(postPreviewContext)?.title}</title>`, { headers: { "content-type": "text/html" } }),
      );
      return previewLinkLoader({ request: new Request(`${ORIGIN}${path}`), params: {}, context } as never);
    };
    const page = await open(`/preview/${token}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<title>Shared draft</title>");
    expect(page.headers.get("x-robots-tag")).toMatch(/noindex/);
    expect(page.headers.get("cache-control")).toMatch(/no-store/);
    expect((await open(`/preview/${"x".repeat(43)}`)).status).toBe(404);
  });
});

/* I2: the queue the /webmention endpoint fills, moderated from Carrel's MentionsList through site-api's mentions group. */
describe("mentions", () => {
  type Listed = {
    items: Array<{ id: string; status: string; version: string; targetId: string }>;
    counts: Record<string, number>;
    expiring: { failed: number; rejected: number };
    filtered?: { q?: string; targetId?: string };
  };
  const day = 24 * 60 * 60;
  const now = () => Math.floor(Date.now() / 1000);
  const mentions = async (query = "") => (await (await get(`${PREFIX}/mentions${query}`)).json()) as Listed;
  const decide = (id: string, decision: string, expectedVersion: string, changeId: string) =>
    send("POST", `${PREFIX}/mentions/${id}/decide`, { decision, expectedVersion, changeId });

  beforeEach(async () => {
    await env.DB.prepare(`DELETE FROM webmentions`).run();
    await seedPost("mentioned-one");
    await seedPost("mentioned-two");
  });

  it("lists the queue newest first with whole-queue counts, and filters by words and by post", async () => {
    await seedMention("https://one.example/a", "mentioned-one", { status: "pending", receivedAt: now() - 60, excerpt: "A note on quolls." });
    await seedMention("https://two.example/b", "mentioned-two", { status: "approved", receivedAt: now() - 120 });
    await seedMention("https://three.example/c", "mentioned-one", { status: "failed", receivedAt: now() - 40 * day });

    const all = await mentions();
    expect(all.items.map((m) => m.targetId)).toEqual(["mentioned-one", "mentioned-two", "mentioned-one"]);
    expect(all.counts).toEqual({ unverified: 0, pending: 1, approved: 1, rejected: 0, failed: 1 });
    expect(all.expiring).toEqual({ failed: 1, rejected: 0 });

    const words = await mentions("?q=QUOLLS");
    expect(words.items.map((m) => m.status)).toEqual(["pending"]);
    expect(words.filtered).toEqual({ q: "QUOLLS" });
    expect(words.counts.approved).toBe(1);
    const onePost = await mentions("?targetId=mentioned-two");
    expect(onePost.items.map((m) => m.status)).toEqual(["approved"]);
    expect((await mentions("?status=failed")).items).toHaveLength(1);
  });

  it("approves, takes the decision back, rejects and deletes, each at the version it was loaded at", async () => {
    const id = String(await seedMention("https://one.example/a", "mentioned-one", { status: "pending", receivedAt: now() - 60, verifiedAt: now() - 50 }));
    const first = (await mentions()).items[0]!;

    const approved = await decide(id, "approve", first.version, "chg-m-approve");
    expect(approved.status).toBe(200);
    const after = (await approved.json()) as { status: string; version: string; purged: boolean | null };
    expect(after).toMatchObject({ status: "approved", purged: null });
    expect(after.version).not.toBe(first.version);

    // A second writer still holding the first version is refused and told the current one.
    const stale = await decide(id, "reject", first.version, "chg-m-stale");
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ currentVersion: after.version });

    const reset = (await (await decide(id, "reset", after.version, "chg-m-reset")).json()) as { status: string; version: string };
    expect(reset.status).toBe("pending");
    const rejected = (await (await decide(id, "reject", reset.version, "chg-m-reject")).json()) as { status: string; version: string };
    expect(rejected.status).toBe("rejected");

    const gone = await send("DELETE", `${PREFIX}/mentions/${id}?expectedVersion=${rejected.version}&changeId=chg-m-delete`);
    expect(gone.status).toBe(200);
    expect((await mentions()).items).toEqual([]);
  });

  it("REFUSES a decision on a mention that failed verification, and sweeps only what is past its window", async () => {
    const failed = String(await seedMention("https://one.example/old", "mentioned-one", { status: "failed", receivedAt: now() - 40 * day }));
    await seedMention("https://one.example/new", "mentioned-one", { status: "failed", receivedAt: now() - day });
    await seedMention("https://two.example/open", "mentioned-two", { status: "pending", receivedAt: now() - 400 * day });
    const listed = (await mentions("?status=failed")).items.find((m) => m.id === failed)!;
    expect((await decide(failed, "approve", listed.version, "chg-m-failed")).status).toBe(422);

    const swept = await send("POST", `${PREFIX}/mentions/sweep`, { changeId: "chg-m-sweep" });
    expect(await swept.json()).toMatchObject({ removed: { failed: 1, rejected: 0 } });
    expect((await mentions()).counts).toMatchObject({ failed: 1, pending: 1 });
  });
});

describe("the site-api conformance suite", () => {
  it("passes against the real route, with write probes", async () => {
    const { runConformance } = await import("@dustinedwards/site-api/conformance");
    // The list is built from D1 and the generated artifacts, the history from the repository, and the stub
    // repository holds only what a case puts there: the first listed item (llms.txt) gets its file, as the
    // deployed repository has it.
    // Other cases seed posts in D1 with no file, so the first item may be a post: it gets its file too.
    await putSource(LLMS_PATH, "# dustinedwards.info\n");
    const first = ((await (await get(`${PREFIX}/content?limit=1`)).json()) as { items: Array<{ id: string }> }).items[0];
    if (first && !first.id.includes(".")) await putSource(postPath(first.id), post(first.id));
    const report = await runConformance({
      baseUrl: ORIGIN,
      key: testEnv.CARREL_SITE_KEY,
      probeWrites: true,
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, {
          ...init,
          // Its own address, so the site's limiter (120 a minute per address) counts the suite alone, not the cases before it.
          headers: { ...Object.fromEntries(new Headers(init?.headers)), "cf-connecting-ip": "203.0.113.10" },
        });
        try {
          if (request.method === "GET") return await loader(argsFor(request));
          // The Worker puts the app's document renderer on the context (workers/app.ts); a test has no app build, so
          // this stand-in renders the post the preview handed it, which is what the preview case reads.
          const args = argsFor(request) as unknown as { context: ReturnType<typeof routeContext> };
          args.context.set(documentHandlerContext, async (_request, context) =>
            new Response(`<!doctype html><title>${context.get(postPreviewContext)?.title}</title>`, {
              headers: { "content-type": "text/html; charset=utf-8" },
            }),
          );
          return await action(args as never);
        } catch (thrown) {
          // A refusal outside the prefix is thrown (a Response or router data); the wire would carry it as its status.
          if (thrown instanceof Response) return thrown;
          const status = (thrown as { init?: { status?: number } }).init?.status;
          if (status) return new Response(null, { status });
          throw thrown;
        }
      }) as typeof fetch,
    });
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
