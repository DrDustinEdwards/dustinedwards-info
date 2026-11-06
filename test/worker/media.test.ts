import { createExecutionContext, env } from "cloudflare:test";
import type { IntentResult } from "@dustinedwards/site-api/admin";
import { describe, expect, it } from "vitest";

import { mediaLibraryStore, mediaRefsFor } from "~/db";
import { carrelMediaAdapter } from "~/lib/carrel/media-adapter.server";
import { dimensionsFromKey } from "~/lib/media/classify.mjs";
import { measureDimensions } from "~/lib/media/core.server";
import { ALLOWED, uploadErrorSentence } from "~/lib/media/upload-contract.mjs";
import { uploadMediaTool } from "~/lib/operator/upload-media.server";
import { action as adminAction, middleware as adminMediaMiddleware } from "~/routes/admin.media._index";

import { bytesFor, envWithImages, pngKey, seedMediaRow } from "./media-fixtures";
import { routeContext } from "./route-helpers";
import { seedPost } from "./seed";

const mediaEnv = () => env as unknown as Env;

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

/** Through the operator's upload_media, the site's own upload path outside Carrel, into the same media library. */
async function upload(
  file: { name: string; type: string; body: string },
  dimensions: Dimensions,
  overrides: Record<string, unknown> = {},
) {
  const uploadEnv = { ...envWithImages(dimensions), ...overrides } as unknown as Parameters<typeof uploadMediaTool>[0];
  const data = btoa(String.fromCharCode(...bytesFor(file.body)));
  const result = await uploadMediaTool(uploadEnv, { data, type: file.type, name: file.name, decorative: true });
  if (!result.ok) return { status: result.status, url: undefined, key: "", error: result.error };
  const { url, key } = result.data as { url: string; key: string };
  return { status: 200, url, key, error: undefined };
}

async function adminMediaAction(fields: Record<string, string>, routeEnv: object = env) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return adminAction({
    request: new Request("https://example.com/admin/media", { method: "POST", body: form }),
    context: routeContext(createExecutionContext(), routeEnv),
  } as never);
}

/** The version the library would post for a file: the site's own, read the way the kit reads it. */
const versionOf = async (key: string) => (await carrelMediaAdapter(mediaEnv()).get(key))?.version ?? "";

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

  it("REFUSES an SVG with a sentence that says why, and stores nothing", async () => {
    const count = async () => (await env.MEDIA.list()).objects.length;
    const before = await count();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>';
    const { status, key, error } = await upload({ name: "vector.svg", type: "image/svg+xml", body: svg }, null);

    expect(status).toBe(415);
    expect(key).toBe("");
    expect(error).toBe(uploadErrorSentence("svg-refused"));
    expect(error).toMatch(/SVG is not accepted/);
    expect(await count()).toBe(before);
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

  it("lets the library's alt, trash and delete act on the raster key an upload produced", async () => {
    const { key } = await upload(
      { name: "managed.png", type: "image/png", body: "raster bytes: managed" },
      { width: 640, height: 480 },
    );

    const alt = (await adminMediaAction({ intent: "alt", ids: key, versions: await versionOf(key), alt: "a wheat field at dusk" })) as IntentResult;
    expect(alt.ok, alt.message).toBe(true);
    expect((await mediaRow(key))?.alt).toBe("a wheat field at dusk");

    // A site with a trash deletes only from it, and the kit asks for the count first.
    expect(((await adminMediaAction({ intent: "trash", ids: key, versions: await versionOf(key) })) as IntentResult).ok).toBe(true);
    const asked = (await adminMediaAction({ intent: "delete", ids: key, versions: await versionOf(key) })) as IntentResult;
    expect(asked.confirm?.typeToConfirm).toBe("1");
    expect(await env.MEDIA.get(key)).toBeTruthy();
    await adminMediaAction({ intent: "delete", ids: key, versions: await versionOf(key), confirm: "1" });
    expect(await env.MEDIA.get(key)).toBeNull();
    expect(await mediaRow(key)).toBeNull();
  });
});

describe("a stored object that can carry script", () => {
  const SCRIPT_CAPABLE = [
    "image/svg+xml",
    "text/html",
    "application/xhtml+xml",
    "text/xml",
    "application/xml",
  ];

  it("allows none of them at upload", () => {
    expect([...ALLOWED.keys()].filter((type) => SCRIPT_CAPABLE.includes(type))).toEqual([]);
  });
});

describe("the atomic delete claim", () => {
  /* The library's delete ends in the store's remove: the row goes only while no recorded citation names it. */
  const rowOf = (key: string) => env.DB.prepare("SELECT key FROM media WHERE key = ?1").bind(key).first();

  it("REMOVES an uncited key with its revisions", async () => {
    const { key } = await uploadKey("uncited", { width: 20, height: 20 });
    await seedMediaRow(key);
    await env.DB.prepare("INSERT INTO media_revisions (media_key, at, bytes, reason) VALUES (?1, '2030-01-01T00:00:00.000Z', 1, 'upload')").bind(key).run();

    expect(await mediaLibraryStore(mediaEnv()).remove(key)).toBe("removed");
    expect(await rowOf(key)).toBeNull();
    expect(await env.DB.prepare("SELECT id FROM media_revisions WHERE media_key = ?1").bind(key).first()).toBeNull();
  });

  it("OBSERVES THE `NOT EXISTS` THROUGH A PLANTED CONCURRENT CITATION (finding B009)", async () => {
    /* A citation landing after the caller's read and before the claim is the race, made
     * deterministic. A ref inserted before the read would not tell a read-then-delete apart. */
    const { key } = await uploadKey("raced", { width: 20, height: 20 });
    await seedMediaRow(key);

    const seenByTheCaller = (await mediaRefsFor(mediaEnv(), [key])).get(key) ?? [];
    expect(seenByTheCaller).toHaveLength(0);

    await env.DB.prepare(
      `INSERT INTO media_refs (media_key, source_type, source_id, form, detail)
       VALUES (?1, 'post', 'raced-in', 'markdown-image', 'line 9')`,
    )
      .bind(key)
      .run();

    /* Must lose: the check runs inside the statement, not on the caller's stale read. */
    expect(await mediaLibraryStore(mediaEnv()).remove(key)).toBe("in-use");
    expect(await rowOf(key)).toBeTruthy();
  });
});

describe("emptying the trash", () => {
  async function trashedUpload(seed: string) {
    const { bytes, key } = await uploadKey(seed, { width: 20, height: 20 });
    await env.MEDIA.put(key, bytes.buffer as ArrayBuffer);
    await seedMediaRow(key, { trashed_at: "2030-01-01 00:00:00" });
    return key;
  }

  const trashedCount = async () =>
    (await env.DB.prepare("SELECT count(*) AS n FROM media WHERE storage = 'r2' AND trashed_at IS NOT NULL").first<{ n: number }>())?.n ?? 0;

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
      confirm: String(await trashedCount()),
    })) as IntentResult;

    expect(await env.MEDIA.get(cited)).toBeTruthy();
    expect(await mediaRow(cited)).toBeTruthy();
    expect(result.outcomes?.find((o) => o.id === cited)).toMatchObject({ ok: false, usedBy: [expect.objectContaining({ id: "cites-a-trashed-file" })] });
    expect(await env.MEDIA.get(uncited)).toBeNull();
  });
});

describe("an unknown intent", () => {
  it("is refused with a sentence, and changes nothing", async () => {
    const result = (await adminMediaAction({ intent: "no-such-intent" })) as IntentResult;
    expect(result).toMatchObject({ ok: false, message: expect.any(String) });
  });
});

describe("quick search", () => {
  it("is answered as JSON, which a document loader cannot do", async () => {
    const { key } = await uploadKey("palette-target", { width: 20, height: 20 });
    await seedMediaRow(key, { original_name: "zanzibar-palette-target.png" });

    const middleware = adminMediaMiddleware[0] as unknown as (
      args: never,
      next: () => Promise<Response>,
    ) => Promise<Response>;
    const response = await middleware(
      {
        request: new Request("https://example.com/admin/media?q=zanzibar", {
          headers: { accept: "application/json" },
        }),
        context: routeContext(),
        params: {},
      } as never,
      async () => new Response("the page, not the search", { status: 500 }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as { rows: Array<{ key: string }> };
    expect(body.rows.map((r) => r.key)).toContain(key);
  });
});
