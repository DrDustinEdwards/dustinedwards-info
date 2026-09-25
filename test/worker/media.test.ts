import { createExecutionContext, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  claimMediaKeyForDelete,
  listMediaPage,
  mediaRefsFor,
  mediaTwins,
  trashMediaRecord,
  trashedMediaKeys,
  upsertMediaRecord,
} from "~/db";
import { CONFIRM_FIELD } from "~/lib/destructive.mjs";
import { contentKey, dimensionsFromKey } from "~/lib/media/classify.mjs";
import { deleteMediaObject, isManagedKey, measureDimensions } from "~/lib/media/core.server";
import { ALLOWED } from "~/lib/media/upload-contract.mjs";
import { action as adminAction, middleware as adminMediaMiddleware } from "~/routes/admin.media._index";
import { action as uploadAction } from "~/routes/admin.media.upload";
import { loader as mediaLoader } from "~/routes/media.$";

import { bytesFor, envWithImages, pngKey } from "./media-fixtures";
import { routeContext } from "./route-helpers";
import { seedPost } from "./seed";

const mediaEnv = () => env as unknown as Parameters<typeof upsertMediaRecord>[0];

async function uploadKey(seed: string, dimensions: { width: number; height: number } | null) {
  const bytes = bytesFor(seed);
  const measured = await measureDimensions(
    envWithImages(dimensions) as unknown as Parameters<typeof measureDimensions>[0],
    bytes.buffer as ArrayBuffer,
  );
  const key = await pngKey(seed, measured);
  return { bytes, measured, key };
}

type Dimensions = { width: number; height: number } | null;

async function upload(
  file: { name: string; type: string; body: string },
  dimensions: Dimensions,
  overrides: Record<string, unknown> = {},
) {
  const form = new FormData();
  form.append("file", new File([file.body], file.name, { type: file.type }));
  const response = (await uploadAction({
    request: new Request("https://example.com/admin/media/upload", { method: "POST", body: form }),
    context: routeContext(createExecutionContext(), { ...envWithImages(dimensions), ...overrides }),
  } as never)) as Response;
  const body = (await response.json()) as { url?: string; key?: string };
  return { status: response.status, url: body.url, key: body.key ?? "" };
}

async function adminMediaAction(fields: Record<string, string>, routeEnv: object = env) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return adminAction({
    request: new Request("https://example.com/admin/media", { method: "POST", body: form }),
    context: routeContext(createExecutionContext(), routeEnv),
  } as never);
}

async function serve(key: string) {
  return (await mediaLoader({
    params: { "*": key },
    request: new Request(`https://example.com/media/${key}`),
    context: routeContext(),
  } as never)) as Response;
}

const mediaRow = (key: string) =>
  env.DB.prepare("SELECT width, height, original_name, alt FROM media WHERE key = ?1")
    .bind(key)
    .first<{ width: number | null; height: number | null; original_name: string; alt: string }>();

describe("media upload", () => {
  it("puts the object in R2 under a CONTENT-ADDRESSED key carrying its dimensions", async () => {
    const first = await upload(
      { name: "a photo.png", type: "image/png", body: "raster bytes: addressed" },
      { width: 800, height: 600 },
    );
    expect(first.status).toBe(200);
    expect(first.url).toBe(`/media/${first.key}`);

    const second = await upload(
      { name: "a photo.png", type: "image/png", body: "raster bytes: addressed, other bytes" },
      { width: 800, height: 600 },
    );
    expect(second.key).not.toBe(first.key);
    expect(first.key).not.toContain("posts/");

    expect(dimensionsFromKey(first.key)).toEqual({ width: 800, height: 600 });

    /* The filename lives on the object too, because the row write is non-fatal. */
    const object = await env.MEDIA.get(first.key);
    expect(object?.customMetadata?.originalName).toBe("a photo.png");
    expect(object?.httpMetadata?.cacheControl).toContain("immutable");
  });

  it("stores and serves a source with NO intrinsic size, recording no dimensions", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    const { status, key } = await upload({ name: "vector.svg", type: "image/svg+xml", body: svg }, null);
    expect(status).toBe(200);
    expect(dimensionsFromKey(key)).toBeNull();

    const served = await serve(key);
    expect(served.status).toBe(200);
    expect(await served.text()).toBe(svg);

    const row = await mediaRow(key);
    expect(row).toBeTruthy();
    expect(row?.width).toBeNull();
    expect(row?.height).toBeNull();
  });

  it("REFUSES a raster Images cannot measure, and stores nothing under a sizeless key", async () => {
    const count = async () => (await env.MEDIA.list()).objects.length;
    const before = await count();
    const { status } = await upload(
      { name: "outage.png", type: "image/png", body: "raster bytes: images outage" },
      { width: 10, height: 10 },
      {
        IMAGES: {
          info: async () => {
            throw new Error("planted Images outage");
          },
        },
      },
    );

    expect(status).toBe(503);
    expect(await count()).toBe(before);
  });

  it("writes the annotation row from the SAME measurement the key was built from", async () => {
    const { key } = await upload(
      { name: "annotated.png", type: "image/png", body: "raster bytes: annotated" },
      { width: 1200, height: 675 },
    );

    const row = await mediaRow(key);
    expect({ width: row?.width, height: row?.height }).toEqual(dimensionsFromKey(key));
    expect(row?.width).toBe(1200);
    expect(row?.original_name).toBe("annotated.png");
    expect(row?.alt).toBe("");
  });

  it("keeps the object when the annotation write fails, because the upload already succeeded", async () => {
    const brokenDb = new Proxy(env.DB, {
      get(target, property, receiver) {
        if (property === "prepare") {
          return () => {
            throw new Error("planted D1 failure during the annotation write");
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const { status, key } = await upload(
      { name: "non-fatal.png", type: "image/png", body: "raster bytes: non-fatal" },
      { width: 10, height: 10 },
      { DB: brokenDb },
    );

    expect(status).toBe(200);
    expect(await env.MEDIA.get(key)).toBeTruthy();
  });

  it("lets set-alt and delete act on the raster key an upload produced", async () => {
    const { key } = await upload(
      { name: "managed.png", type: "image/png", body: "raster bytes: managed" },
      { width: 640, height: 480 },
    );

    await adminMediaAction({ intent: "set-alt", key, alt: "a wheat field at dusk" });
    expect((await mediaRow(key))?.alt).toBe("a wheat field at dusk");

    await adminMediaAction({ intent: "delete", key, [CONFIRM_FIELD]: "1" });
    expect(await env.MEDIA.get(key)).toBeNull();
    expect(await mediaRow(key)).toBeNull();
  });
});

describe("serving an allowed type that can carry script", () => {
  const SCRIPT_CAPABLE = [
    "image/svg+xml",
    "text/html",
    "application/xhtml+xml",
    "text/xml",
    "application/xml",
  ];

  it("serves every one as a nosniff attachment, never inline", async () => {
    const capable = [...ALLOWED].filter(([type]) => SCRIPT_CAPABLE.includes(type));
    expect(capable.length).toBeGreaterThan(0);

    for (const [type, extension] of capable) {
      const key = `dustin-edwards-script-${extension}-00000000000000aa.${extension}`;
      await env.MEDIA.put(key, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', {
        httpMetadata: { contentType: type },
      });

      const served = await serve(key);
      expect(served.status, type).toBe(200);
      expect(served.headers.get("content-disposition"), type).toContain("attachment");
      expect(served.headers.get("x-content-type-options"), type).toBe("nosniff");
    }
  });
});

describe("set-alt", () => {
  it("updates the ROW on a raster key and leaves every column it did not name", async () => {
    const { key } = await uploadKey("alt-target", { width: 640, height: 480 });
    expect(key).toMatch(/-\d+x\d+\.png$/);
    expect(isManagedKey(key)).toBe(true);

    await upsertMediaRecord(mediaEnv(), {
      key,
      alt: "",
      storage: "r2",
      kind: "image",
      originalName: "alt-target.png",
    });
    await upsertMediaRecord(mediaEnv(), { key, alt: "a wheat field at dusk" });

    const row = await env.DB.prepare(
      "SELECT alt, kind, original_name FROM media WHERE key = ?1",
    )
      .bind(key)
      .first<{ alt: string; kind: string; original_name: string }>();

    expect(row?.alt).toBe("a wheat field at dusk");
    expect(row?.kind).toBe("image");
    expect(row?.original_name).toBe("alt-target.png");
  });
});

describe("the atomic delete claim", () => {
  it("REMOVES an uncited key and reports that it won", async () => {
    const { bytes, key } = await uploadKey("uncited", { width: 20, height: 20 });
    await env.MEDIA.put(key, bytes.buffer as ArrayBuffer);
    await upsertMediaRecord(mediaEnv(), { key, alt: "", storage: "r2", kind: "image" });

    expect(await claimMediaKeyForDelete(mediaEnv(), key)).toBe(true);
    await deleteMediaObject(mediaEnv(), key);

    expect(await env.MEDIA.get(key)).toBeNull();
    expect(
      await env.DB.prepare("SELECT key FROM media WHERE key = ?1").bind(key).first(),
    ).toBeNull();
  });

  it("KEEPS a cited key and reports that it lost", async () => {
    const { bytes, key } = await uploadKey("cited", { width: 20, height: 20 });
    await env.MEDIA.put(key, bytes.buffer as ArrayBuffer);
    await upsertMediaRecord(mediaEnv(), { key, alt: "", storage: "r2", kind: "image" });
    await env.DB.prepare(
      `INSERT INTO media_refs (media_key, source_type, source_id, form, detail)
       VALUES (?1, 'post', 'a-post', 'markdown-image', 'line 4')`,
    )
      .bind(key)
      .run();

    expect(await claimMediaKeyForDelete(mediaEnv(), key)).toBe(false);
    expect(await env.MEDIA.get(key)).toBeTruthy();
    expect((await mediaRefsFor(mediaEnv(), [key])).get(key)).toHaveLength(1);
  });

  it("OBSERVES THE `NOT EXISTS` THROUGH A PLANTED CONCURRENT CITATION (finding B009)", async () => {
    /* A citation landing after the caller's read and before the claim is the race, made
     * deterministic. A ref inserted before the read would not tell a read-then-delete apart. */
    const { bytes, key } = await uploadKey("raced", { width: 20, height: 20 });
    await env.MEDIA.put(key, bytes.buffer as ArrayBuffer);
    await upsertMediaRecord(mediaEnv(), { key, alt: "", storage: "r2", kind: "image" });

    const seenByTheCaller = (await mediaRefsFor(mediaEnv(), [key])).get(key) ?? [];
    expect(seenByTheCaller).toHaveLength(0);

    await env.DB.prepare(
      `INSERT INTO media_refs (media_key, source_type, source_id, form, detail)
       VALUES (?1, 'post', 'raced-in', 'markdown-image', 'line 9')`,
    )
      .bind(key)
      .run();

    /* Must lose: the check runs inside the statement, not on the caller's stale read. */
    expect(await claimMediaKeyForDelete(mediaEnv(), key)).toBe(false);

    expect(await env.MEDIA.get(key)).toBeTruthy();
    expect(
      await env.DB.prepare("SELECT key FROM media WHERE key = ?1").bind(key).first(),
    ).toBeTruthy();
  });

  it("reports that it lost when the key was already gone", async () => {
    /* false means cited OR absent, and the caller must refuse either way. */
    expect(await claimMediaKeyForDelete(mediaEnv(), "dustin-edwards-0123456789abcdef-1x1.png")).toBe(false);
  });
});

describe("the duplicates lens", () => {
  it("FILTERS IN SQL BEFORE THE PAGE IS CUT, so a page of twins is a full page", async () => {
    const digest = await crypto.subtle.digest("SHA-256", bytesFor("twin-bytes"));
    const twins = ["first copy", "second copy"].map((name) =>
      contentKey(digest, "png", { width: 10, height: 10 }, name),
    );
    const singles = await Promise.all(
      ["single-a", "single-b", "single-c"].map((seed) => pngKey(seed, { width: 10, height: 10 })),
    );
    /* The singles are newest, so an unfiltered first page would be all singles. */
    for (const [i, key] of [...twins, ...singles].entries()) {
      await upsertMediaRecord(mediaEnv(), {
        key,
        alt: "",
        storage: "r2",
        kind: "image",
        role: "content",
        uploadedAt: new Date(Date.UTC(2030, 0, 1 + i)).toISOString(),
      });
    }

    const known = await mediaTwins(mediaEnv());
    const { rows } = await listMediaPage(mediaEnv(), { lens: "duplicates", limit: 2 });

    expect(rows).toHaveLength(2);
    for (const row of rows) expect(known.has(row.key), row.key).toBe(true);
    expect(rows.map((row) => row.key).sort()).toEqual([...twins].sort());
  });
});

describe("emptying the trash", () => {
  async function trashedUpload(seed: string) {
    const { bytes, key } = await uploadKey(seed, { width: 20, height: 20 });
    await env.MEDIA.put(key, bytes.buffer as ArrayBuffer);
    await upsertMediaRecord(mediaEnv(), { key, alt: "", storage: "r2", kind: "image" });
    await trashMediaRecord(mediaEnv(), key);
    return key;
  }

  const trashedCount = async () => (await trashedMediaKeys(mediaEnv())).length;

  it("KEEPS a file a post body cites though media_refs has no row for it", async () => {
    const cited = await trashedUpload("trash-cited");
    const uncited = await trashedUpload("trash-uncited");
    await seedPost("cites-a-trashed-file", {
      status: "draft",
      title: "Cites it",
      body: `An image: ![alt](/media/${cited})`,
      publishAt: null,
    });
    expect((await mediaRefsFor(mediaEnv(), [cited])).get(cited)).toHaveLength(0);

    const result = (await adminMediaAction({
      intent: "empty-trash",
      [CONFIRM_FIELD]: String(await trashedCount()),
    })) as { message: string };

    expect(await env.MEDIA.get(cited)).toBeTruthy();
    expect(await mediaRow(cited)).toBeTruthy();
    expect(result.message).toContain(`${cited} (a post cites it)`);
    expect(await env.MEDIA.get(uncited)).toBeNull();
  });

  it("deletes NOTHING when the citation scan fails", async () => {
    const key = await trashedUpload("trash-scan-fails");
    /* Only the posts read fails, so the trash listing still works and the scan is the one that breaks. */
    const brokenDb = new Proxy(env.DB, {
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

    const result = (await adminMediaAction(
      { intent: "empty-trash", [CONFIRM_FIELD]: String(await trashedCount()) },
      { ...env, DB: brokenDb },
    )) as { message: string };

    expect(result.message).toMatch(/^Nothing was deleted: the reference scan failed/);
    expect(await env.MEDIA.get(key)).toBeTruthy();
    expect(await mediaRow(key)).toBeTruthy();
  });
});

describe("an unknown intent", () => {
  it("answers 400 with a sentence, not a silent 200", async () => {
    const result = (await adminMediaAction({ intent: "no-such-intent" })) as {
      data: { message: string };
      init: { status: number };
    };
    expect(result.init.status).toBe(400);
    expect(result.data.message).toContain("no-such-intent");
  });
});

describe("a thumbnail whose transform fails", () => {
  it("serves the original with a short cache life, and an SVG as an attachment", async () => {
    const key = "dustin-edwards-transform-fails-00000000000000bb.svg";
    await env.MEDIA.put(key, '<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
      httpMetadata: { contentType: "image/svg+xml" },
    });
    const failingImages = {
      input: () => {
        throw new Error("planted transform failure");
      },
    };

    const served = (await mediaLoader({
      params: { "*": key },
      request: new Request(`https://example.com/media/${key}?w=320`),
      context: routeContext(createExecutionContext(), { IMAGES: failingImages }),
    } as never)) as Response;

    expect(served.status).toBe(200);
    expect(served.headers.get("x-media-thumb")).toBe("original-fallback");
    expect(served.headers.get("cache-control")).not.toContain("immutable");
    expect(served.headers.get("content-disposition")).toContain("attachment");
  });
});

describe("the media palette", () => {
  it("is answered as JSON, which a document loader cannot do", async () => {
    const { key } = await uploadKey("palette-target", { width: 20, height: 20 });
    await upsertMediaRecord(mediaEnv(), {
      key,
      alt: "",
      storage: "r2",
      kind: "image",
      role: "content",
      originalName: "zanzibar-palette-target.png",
    });

    const middleware = adminMediaMiddleware[0] as unknown as (
      args: never,
      next: () => Promise<Response>,
    ) => Promise<Response>;
    const response = await middleware(
      {
        request: new Request("https://example.com/admin/media?palette=1&q=zanzibar", {
          headers: { accept: "application/json" },
        }),
        context: routeContext(),
        params: {},
      } as never,
      async () => new Response("the page, not the palette", { status: 500 }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as { results: Array<{ key: string }>; hasMore: boolean };
    expect(body.results.map((r) => r.key)).toContain(key);
  });
});
