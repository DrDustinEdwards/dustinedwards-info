import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { claimMediaKeyForDelete, mediaRefsFor, upsertMediaRecord } from "~/db";
import { classify, contentKey, roleOf } from "~/lib/media/classify.mjs";
import { deleteMediaObject, isManagedKey, measureDimensions } from "~/lib/media/core.server";

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
 * live index, which is `check:media` and is network-only for the reason it
 * records.
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

describe("media upload", () => {
  it("puts the object in R2 under a CONTENT-ADDRESSED key carrying its dimensions", async () => {
    const { bytes, measured, key } = await uploadKey("addressed", { width: 800, height: 600 });

    /*
     * THE KEY IS A DIGEST OF THE BYTES, which is the security argument that
     * decided content addressing: the old key was derivable from public
     * information, so a draft post's images were reachable by guessing a slug
     * the sitemap publishes plus eight hex characters. A digest is a function
     * of bytes nobody outside has.
     */
    expect(key).not.toContain("posts/");
    expect(key).not.toContain("addressed");
    /*
     * AND IT CARRIES THE MEASUREMENT. Finding B002: dimensions are baked into
     * the gated HTML and the two writers measured them from two different
     * stores, one of which a clone cannot reach. The key carries `-<w>x<h>` so
     * both resolvers parse rather than fetch.
     */
    expect(measured).toEqual({ width: 800, height: 600 });
    expect(key).toContain("-800x600.png");

    await env.MEDIA.put(key, bytes.buffer as ArrayBuffer, {
      httpMetadata: {
        contentType: "image/png",
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: { originalName: "a photo.png" },
    });

    const object = await env.MEDIA.get(key);
    expect(object).toBeTruthy();
    /*
     * THE FILENAME LIVES ON THE OBJECT, not only in the row. A content-addressed
     * key cannot carry it and the D1 write is deliberately non-fatal, so the row
     * was the single source of a fact that could be lost silently.
     */
    expect(object?.customMetadata?.originalName).toBe("a photo.png");
    expect(object?.httpMetadata?.cacheControl).toContain("immutable");
  });

  it("keys a source with NO intrinsic size without a dimension segment", async () => {
    /* Null is a real answer and not a failure: an SVG has no pixel size, and
     * the `media` table records a NULL width for the same reason. */
    const { measured, key } = await uploadKey("vector", null);
    expect(measured).toBeNull();
    expect(key).not.toMatch(/-\d+x\d+\./);
  });

  it("writes the annotation row from the SAME measurement the key was built from", async () => {
    const { bytes, measured, key } = await uploadKey("annotated", { width: 1200, height: 675 });
    const { kind, mime } = classify(key);

    await upsertMediaRecord(mediaEnv(), {
      key,
      alt: "",
      storage: "r2",
      kind,
      role: roleOf(key),
      mime,
      bytes: bytes.byteLength,
      originalName: "annotated.png",
      uploadedAt: new Date().toISOString(),
      width: measured?.width ?? null,
      height: measured?.height ?? null,
    });

    const row = await env.DB.prepare(
      "SELECT key, width, height, original_name, alt FROM media WHERE key = ?1",
    )
      .bind(key)
      .first<{ key: string; width: number; height: number; original_name: string; alt: string }>();

    /* ONE MEASUREMENT MEANS THE ROW AND THE KEY CANNOT DISAGREE. */
    expect(row?.width).toBe(1200);
    expect(row?.height).toBe(675);
    expect(key).toContain(`-${row?.width}x${row?.height}.`);
    expect(row?.original_name).toBe("annotated.png");
    expect(row?.alt).toBe("");
  });

  it("keeps the object when the annotation write fails, because the upload already succeeded", async () => {
    /*
     * THE ROW WRITE IS NON-FATAL BY DESIGN: the object is in R2, the upload HAS
     * succeeded, and a D1 hiccup must not report failure for a write that
     * happened. The library lists from the BUCKET and treats a missing row as
     * empty metadata, so the worst case is an un-annotated object.
     *
     * Asserted at the stores rather than by reading the try/catch around the
     * call: the put lands, the row write throws, and the object is still there.
     */
    const { bytes, key } = await uploadKey("non-fatal", { width: 10, height: 10 });
    await env.MEDIA.put(key, bytes.buffer as ArrayBuffer);

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
    await expect(
      upsertMediaRecord(
        { ...env, DB: brokenDb } as unknown as Parameters<typeof upsertMediaRecord>[0],
        { key, alt: "" },
      ),
    ).rejects.toThrow();

    expect(await env.MEDIA.get(key)).toBeTruthy();
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
    expect(await claimMediaKeyForDelete(mediaEnv(), "0123456789abcdef-1x1.png")).toBe(false);
  });
});
