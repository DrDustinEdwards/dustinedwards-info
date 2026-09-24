import { createExecutionContext, env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { claimMediaKeyForDelete, mediaRefsFor, upsertMediaRecord } from "~/db";
import { cloudflareContext } from "~/lib/context";
import { CONFIRM_FIELD } from "~/lib/destructive.mjs";
import { contentKey, dimensionsFromKey } from "~/lib/media/classify.mjs";
import { deleteMediaObject, isManagedKey, measureDimensions } from "~/lib/media/core.server";
import { ALLOWED } from "~/lib/media/upload-contract.mjs";
import { action as adminAction } from "~/routes/admin.media._index";
import { action as uploadAction } from "~/routes/admin.media.upload";
import { loader as mediaLoader } from "~/routes/media.$";

/**
 * The media path: what an upload puts where, and what a delete is allowed to
 * remove.
 *
 * ## OBSERVATION BOUNDARY
 *
 * R2 and D1 are the real miniflare-local stores. `IMAGES` is NOT: it is a
 * Cloudflare platform binding with no local emulation, so `measureDimensions`
 * would answer `null` for every image here and the dimension segment the key
 * carries could never appear. The cases below hand it a binding with a
 * RECORDED shape and say which shape, so what is under test is
 * `contentKey`'s use of the measurement rather than the measuring.
 *
 * The unmeasurable case is covered too, and not as an afterthought: an SVG
 * genuinely has no pixel dimensions, so a key with no dimension segment is a
 * correct key and not a degraded one.
 *
 * What this cannot see is the reconciliation between the live bucket and the
 * live index, which the deployed health check's media-index-drift watches.
 *
 * ## KEYS ARE UNIQUE PER CASE
 *
 * The pool shares one D1 and one R2 across the cases in a file, so two cases
 * uploading identical bytes would share a key by construction, which is exactly
 * what content addressing promises. One case's `media_refs` row would then
 * decide the next case's claim. Every case seeds its own bytes.
 */

const mediaEnv = () => env as unknown as Parameters<typeof upsertMediaRecord>[0];

/**
 * The env with an `IMAGES` binding that reports `dimensions`.
 *
 * `null` stands for a source with no intrinsic pixel size: the real binding
 * answers with an object carrying no `width`, which is what an SVG gets, and
 * `measureDimensions` returns null rather than recording a zero.
 */
function envWithImages(dimensions: { width: number; height: number } | null) {
  return {
    ...env,
    IMAGES: {
      info: async (stream: ReadableStream) => {
        /* Drained, because the real binding consumes the stream and a case that
         * left it open would not be exercising the same call. */
        await new Response(stream).arrayBuffer();
        return dimensions ?? { format: "image/svg+xml" };
      },
    },
  } as unknown as Parameters<typeof measureDimensions>[0];
}

/** Distinct bytes per case, so distinct content-addressed keys. */
function bytesFor(seed: string) {
  return new TextEncoder().encode(`fake-image-bytes:${seed}`);
}

async function uploadKey(seed: string, dimensions: { width: number; height: number } | null) {
  const bytes = bytesFor(seed);
  const measured = await measureDimensions(envWithImages(dimensions), bytes.buffer as ArrayBuffer);
  const key = contentKey(await crypto.subtle.digest("SHA-256", bytes), "png", measured);
  return { bytes, measured, key };
}

type Dimensions = { width: number; height: number } | null;

function routeContext(routeEnv: object) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: routeEnv as never, ctx: createExecutionContext() });
  return context;
}

/** Posts one file to the upload endpoint the way the editors do, and reads the JSON reply. */
async function upload(
  file: { name: string; type: string; body: string },
  dimensions: Dimensions,
  overrides: Record<string, unknown> = {},
) {
  const form = new FormData();
  form.append("file", new File([file.body], file.name, { type: file.type }));
  const response = (await uploadAction({
    request: new Request("https://example.com/admin/media/upload", { method: "POST", body: form }),
    context: routeContext({ ...envWithImages(dimensions), ...overrides }),
  } as never)) as Response;
  const body = (await response.json()) as { url?: string; key?: string };
  return { status: response.status, url: body.url, key: body.key ?? "" };
}

async function adminMediaAction(fields: Record<string, string>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return adminAction({
    request: new Request("https://example.com/admin/media", { method: "POST", body: form }),
    context: routeContext(env),
  } as never);
}

async function serve(key: string) {
  return (await mediaLoader({
    params: { "*": key },
    request: new Request(`https://example.com/media/${key}`),
    context: routeContext(env),
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

    /* A digest of the bytes, so nothing public predicts it: the same name with
     * other bytes is another key. */
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
    /* A managed-key guard that predated the dimension segment once refused
     * every uploaded raster while looking correct. */
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
    /* A RASTER KEY, so this exercises the grammar the guard actually sees: the
     * predicate that lived on the module predated the dimension segment and
     * refused every uploaded raster while looking correct. */
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
    /*
     * RULING 2: alt is contextual as well as intrinsic, so posts keep whatever
     * alt they were written with and only future insertions pick this up. The
     * observable half here is that a partial upsert edits one column and blanks
     * nothing else.
     */
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
    /* The caller refuses on a lost claim, so the object survives. */
    expect(await env.MEDIA.get(key)).toBeTruthy();
    expect((await mediaRefsFor(mediaEnv(), [key])).get(key)).toHaveLength(1);
  });

  it("OBSERVES THE `NOT EXISTS` THROUGH A PLANTED CONCURRENT CITATION (finding B009)", async () => {
    /*
     * ## THE DEFECT, replayed rather than described
     *
     * The delete action read the citations, found none, and then deleted the
     * blob. Between those two steps a concurrent save can insert a `media_refs`
     * row, and the object was removed anyway, leaving the post that had just
     * cited it rendering a broken image.
     *
     * ## WHY THIS CASE IS SHAPED THE WAY IT IS
     *
     * The repair made the decisive step ONE statement, so the "is it still
     * unreferenced" test and the row removal cannot be separated. A case that
     * merely inserted a ref and then claimed would pass against the OLD code
     * too, because the old code read refs first as well. What distinguishes the
     * two is a citation landing AFTER the caller's read and BEFORE the claim:
     * the old code deleted, this one refuses.
     *
     * So the case performs the caller's read, finds nothing, THEN plants the
     * citation, THEN claims. That interleaving IS the race, made deterministic.
     */
    const { bytes, key } = await uploadKey("raced", { width: 20, height: 20 });
    await env.MEDIA.put(key, bytes.buffer as ArrayBuffer);
    await upsertMediaRecord(mediaEnv(), { key, alt: "", storage: "r2", kind: "image" });

    /* Step 1: the caller's check. Nothing cites it, so a delete looks safe. */
    const seenByTheCaller = (await mediaRefsFor(mediaEnv(), [key])).get(key) ?? [];
    expect(seenByTheCaller).toHaveLength(0);

    /* Step 2: a concurrent save lands a citation. This is the window. */
    await env.DB.prepare(
      `INSERT INTO media_refs (media_key, source_type, source_id, form, detail)
       VALUES (?1, 'post', 'raced-in', 'markdown-image', 'line 9')`,
    )
      .bind(key)
      .run();

    /* Step 3: the claim. It must LOSE, because the test is evaluated inside the
     * statement rather than in the caller's now-stale reading. */
    expect(await claimMediaKeyForDelete(mediaEnv(), key)).toBe(false);

    /* And the object the racing post cites is still there, which is the whole
     * point: the refusal is what keeps a live post's image alive. */
    expect(await env.MEDIA.get(key)).toBeTruthy();
    expect(
      await env.DB.prepare("SELECT key FROM media WHERE key = ?1").bind(key).first(),
    ).toBeTruthy();
  });

  it("reports that it lost when the key was already gone", async () => {
    /* A false return means EITHER cited OR absent, and the caller must refuse
     * either way. Both branches are covered so the return is never read as
     * meaning only one of them. */
    expect(await claimMediaKeyForDelete(mediaEnv(), "dustin-edwards-0123456789abcdef-1x1.png")).toBe(false);
  });
});
