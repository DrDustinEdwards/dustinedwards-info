import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED, MAX_BYTES } from "~/lib/media/upload-contract.mjs";
import { stubSources, type SourceStub } from "./source-stub";
import { bytesFor } from "./media-fixtures";
import { seedPost } from "./seed";
import { testEnv } from "./test-env";
import { ORIGIN, PREFIX, get, mediaCall } from "./carrel-api-fixtures";

let gh: SourceStub;

beforeEach(async () => {
  gh = await stubSources();
});

afterEach(async () => {
  await gh.restore();
});

/** Uploads through the API and answers the stored id. */
async function uploadThroughApi(seed: string, alt = "") {
  // site-api 0.19+ refuses an undescribed upload: no alt is the decorative choice.
  const query = new URLSearchParams({
    filename: `${seed}.png`,
    changeId: `chg-${seed}`,
    ...(alt ? { alt } : { decorative: "yes" }),
  });
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

type MediaJson = {
  id: string;
  version: string;
  focus?: string | null;
  caption?: string;
  sizesNeedPurge?: boolean;
};

const mediaItem = async (id: string) =>
  (await (await mediaCall("GET", `${PREFIX}/media/${id}`)).json()) as MediaJson;

function putJson(path: string, body: unknown) {
  return mediaCall("PUT", `${PREFIX}${path}`, { body: JSON.stringify(body) });
}

describe("media: focal point, caption and replace", () => {
  it("keeps a focal point on the object, where ./image crops around it, and moves the version", async () => {
    const id = await uploadThroughApi("focus-case");
    const before = await mediaItem(id);
    const response = await putJson(`/media/${id}/focus`, {
      focus: "0.25x0.4",
      expectedVersion: before.version,
      changeId: "chg-focus",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await testEnv.MEDIA.head(id))?.customMetadata?.focus).toBe("0.25x0.4");
    const after = await mediaItem(id);
    expect(after.focus).toBe("0.25x0.4");
    expect(after.version).not.toBe(before.version);
  });

  it("keeps a caption in the media index", async () => {
    const id = await uploadThroughApi("caption-case");
    const { version } = await mediaItem(id);
    const response = await putJson(`/media/${id}/caption`, {
      caption: "Plaques on a lawn",
      expectedVersion: version,
      changeId: "chg-caption",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await mediaItem(id)).caption).toBe("Plaques on a lawn");
  });

  it("replaces the bytes under the same address, clears the focal point and keeps the old bytes in the backup", async () => {
    const id = await uploadThroughApi("replace-case");
    let { version } = await mediaItem(id);
    const focused = await putJson(`/media/${id}/focus`, {
      focus: "0.1x0.9",
      expectedVersion: version,
      changeId: "chg-rf",
    });
    ({ version } = (await focused.json()) as MediaJson);
    const original = new Uint8Array(await (await testEnv.MEDIA.get(id))!.arrayBuffer());

    const query = new URLSearchParams({
      filename: "replace-case-2.png",
      changeId: "chg-replace",
      expectedVersion: version,
    });
    const response = await mediaCall(
      "PUT",
      `${PREFIX}/media/${id}/file?${query}`,
      { body: bytesFor("replace-case-2"), type: "image/png" },
      {},
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id, focus: null, sizesNeedPurge: false });
    expect(new Uint8Array(await (await testEnv.MEDIA.get(id))!.arrayBuffer())).toEqual(
      bytesFor("replace-case-2"),
    );
    // The library keeps a copy at replaced/<key>/<sha256>.
    const [kept] = (await testEnv.MEDIA_REVISIONS.list({ prefix: `replaced/${id}/` })).objects;
    expect(kept, "the old bytes were not kept").toBeDefined();
    expect(
      new Uint8Array(await (await testEnv.MEDIA_REVISIONS.get(kept!.key))!.arrayBuffer()),
    ).toEqual(original);
  });
});

/* Alt, tags and the trash (site-api v0.4.0), through the admin library's own core writes. */

const sendJson = (method: "PUT" | "POST", path: string, body: unknown) =>
  mediaCall(method, `${PREFIX}${path}`, { body: JSON.stringify(body) });

const listIds = async (query: string) =>
  (
    (await (await mediaCall("GET", `${PREFIX}/media?${query}`)).json()) as { items: MediaJson[] }
  ).items.map((i) => i.id);

describe("media: alt, tags and the trash", () => {
  it("REFUSES a stale version with 409 even within the same second, and keeps the first write", async () => {
    const id = await uploadThroughApi("alt-race");
    const { version } = await mediaItem(id);
    const first = await sendJson("PUT", `/media/${id}/alt`, {
      alt: "First",
      expectedVersion: version,
      changeId: "chg-alt-1",
    });
    expect(first.status, await first.clone().text()).toBe(200);
    const moved = ((await first.json()) as MediaJson).version;
    expect(moved).not.toBe(version);

    // Sent at once, from the same loaded version: updated_at alone could not tell these apart.
    const second = await sendJson("PUT", `/media/${id}/alt`, {
      alt: "Second",
      expectedVersion: version,
      changeId: "chg-alt-2",
    });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: "version-conflict", currentVersion: moved });
    expect(await mediaRowOf(id)).toMatchObject({ alt: "First" });
  });

  it("filters by tag, and trash hides a file from the library until it is restored", async () => {
    const id = await uploadThroughApi("tag-trash");
    let { version } = await mediaItem(id);
    const tagged = await sendJson("PUT", `/media/${id}/tags`, {
      tags: ["field-notes"],
      expectedVersion: version,
      changeId: "chg-tag",
    });
    expect(tagged.status, await tagged.clone().text()).toBe(200);
    ({ version } = (await tagged.json()) as MediaJson);
    expect(await listIds("tag=field-notes")).toEqual([id]);
    // The count is across every page, of the same rows the page lists.
    expect(
      (
        (await (await mediaCall("GET", `${PREFIX}/media?tag=field-notes&limit=1`)).json()) as {
          total?: number;
        }
      ).total,
    ).toBe(1);

    const trashed = await sendJson("POST", `/media/${id}/trash`, {
      expectedVersion: version,
      changeId: "chg-trash",
    });
    expect(trashed.status, await trashed.clone().text()).toBe(200);
    ({ version } = (await trashed.json()) as MediaJson);
    expect(await listIds("tag=field-notes")).toEqual([]);
    expect(await listIds("trashed=only&tag=field-notes")).toEqual([id]);
    // The object stays, so a page that uses it keeps rendering.
    expect(await testEnv.MEDIA.head(id)).not.toBeNull();

    const restored = await sendJson("POST", `/media/${id}/restore`, {
      expectedVersion: version,
      changeId: "chg-restore",
    });
    expect(restored.status, await restored.clone().text()).toBe(200);
    expect(await listIds("tag=field-notes")).toEqual([id]);
  });
});

/* The media library's v0.13.0 ideas: duplicates, turns with their history, the change log, embedded metadata,
 * the shrink at upload and the model's suggestions. Images has no local emulation and Anthropic is not called from a
 * test, so both are recorded shapes: the transformer appends what it was asked to do, so its output differs from its input. */

type Size = { width: number; height: number };

/** An IMAGES binding that measures by `size` (or `sizeAfter` once a transform has run) and marks what it transformed. */
function imagesThatTransform(
  size: Size = { width: 10, height: 10 },
  sizeAfter: (steps: string) => Size = () => size,
) {
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
          const marked = new Uint8Array([
            ...bytes,
            ...new TextEncoder().encode(`${marker}${JSON.stringify(steps)}`),
          ]);
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
  const [artist, copyright, taken, offset] = [
    ascii(fields.artist),
    ascii(fields.copyright),
    ascii(fields.taken),
    ascii(fields.offset),
  ];
  entry(10, 0x013b, 2, artist.length, place(artist));
  entry(22, 0x8298, 2, copyright.length, place(copyright));
  entry(34, 0x8769, 4, 1, 50);
  view.setUint16(50, 2);
  entry(52, 0x9003, 2, taken.length, place(taken));
  entry(64, 0x9011, 2, offset.length, place(offset));
  const body = tiff.subarray(0, dataAt);
  const length = 2 + 6 + body.length;
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    length >> 8,
    length & 0xff,
    0x45,
    0x78,
    0x69,
    0x66,
    0,
    0,
    ...body,
    0xff,
    0xd9,
  ]);
}

const uploadQuery = (seed: string, extra: Record<string, string> = {}) =>
  new URLSearchParams({
    filename: `${seed}.png`,
    changeId: `chg-${seed}`,
    ...("alt" in extra ? {} : { decorative: "yes" }),
    ...extra,
  });

const objectBytes = async (id: string) =>
  new Uint8Array(await (await testEnv.MEDIA.get(id))!.arrayBuffer());

type Revision = { rev: string; reason: string; current: boolean };

describe("media: the v0.13.0 library", () => {
  it("answers an upload of bytes it already holds with that file, under any name, and stores nothing new", async () => {
    const id = await uploadThroughApi("duplicate-case");
    const before = await mediaCount();
    const response = await mediaCall(
      "POST",
      `${PREFIX}/media?${uploadQuery("duplicate-case-renamed")}`,
      {
        body: bytesFor("duplicate-case"),
        type: "image/png",
      },
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id, duplicateOf: id });
    expect(await mediaCount()).toBe(before);
  });

  it("mirrors a picture in place, keeps the old bytes in its history, and a revert puts them back", async () => {
    const overrides = { IMAGES: imagesThatTransform() };
    const id = await uploadThroughApi("transform-case");
    const original = await objectBytes(id);
    const { version } = await mediaItem(id);

    const turned = await mediaCall(
      "POST",
      `${PREFIX}/media/${id}/transform`,
      { body: JSON.stringify({ op: "flip-h", expectedVersion: version, changeId: "chg-flip" }) },
      overrides,
    );
    expect(turned.status, await turned.clone().text()).toBe(200);
    const after = (await turned.json()) as MediaJson & { asNewFile: boolean };
    expect(after).toMatchObject({ id, asNewFile: false });
    expect(await objectBytes(id)).not.toEqual(original);

    const history = (await (
      await mediaCall("GET", `${PREFIX}/media/${id}/history`, {}, overrides)
    ).json()) as { revisions: Revision[] };
    expect(history.revisions.map((r) => [r.reason, r.current])).toEqual([
      ["transform", true],
      ["upload", false],
    ]);

    const reverted = await mediaCall(
      "POST",
      `${PREFIX}/media/${id}/revert`,
      {
        body: JSON.stringify({
          to: history.revisions[1]!.rev,
          expectedVersion: after.version,
          changeId: "chg-revert",
        }),
      },
      overrides,
    );
    expect(reverted.status, await reverted.clone().text()).toBe(200);
    expect(await objectBytes(id)).toEqual(original);
  });

  it("reverts to a copy kept before v0.24.0, where its revision row names it", async () => {
    const id = await uploadThroughApi("legacy-copy-case");
    const { version } = await mediaItem(id);
    // As the site's own history wrote it: the copy at replaced/<time>/<key>, its revision row naming it, then the current bytes.
    const copyKey = `replaced/2026-01-02T03:04:05.000Z/${id}`;
    await testEnv.MEDIA_REVISIONS.put(copyKey, bytesFor("legacy-copy-case-before"));
    await testEnv.DB.prepare("DELETE FROM media_revisions WHERE media_key = ?1").bind(id).run();
    await testEnv.DB.prepare(
      "INSERT INTO media_revisions (media_key, at, bytes, width, height, reason, sha256, copy_key) VALUES (?1, '2026-01-01T00:00:00.000Z', 1, 10, 10, 'upload', '', ?2), (?1, '2026-01-02T03:04:05.000Z', 1, 10, 10, 'replace', '', NULL)",
    )
      .bind(id, copyKey)
      .run();

    const history = (await (await mediaCall("GET", `${PREFIX}/media/${id}/history`)).json()) as {
      revisions: Revision[];
    };
    expect(history.revisions.map((r) => [r.reason, r.current])).toEqual([
      ["replace", true],
      ["upload", false],
    ]);
    const reverted = await mediaCall("POST", `${PREFIX}/media/${id}/revert`, {
      body: JSON.stringify({
        to: history.revisions[1]!.rev,
        expectedVersion: version,
        changeId: "chg-legacy-revert",
      }),
    });
    expect(reverted.status, await reverted.clone().text()).toBe(200);
    expect(await objectBytes(id)).toEqual(bytesFor("legacy-copy-case-before"));
  });

  it("turns a picture that is not square into a new file with its alt, leaving the old one as it was", async () => {
    const overrides = {
      IMAGES: imagesThatTransform({ width: 20, height: 10 }, () => ({ width: 10, height: 20 })),
    };
    const upload = await mediaCall(
      "POST",
      `${PREFIX}/media?${uploadQuery("turn-case", { alt: "A wide chart" })}`,
      { body: bytesFor("turn-case"), type: "image/png" },
      overrides,
    );
    const { id, version } = (await upload.json()) as MediaJson;
    const original = await objectBytes(id);

    const turned = await mediaCall(
      "POST",
      `${PREFIX}/media/${id}/transform`,
      { body: JSON.stringify({ op: "rotate-90", expectedVersion: version, changeId: "chg-turn" }) },
      overrides,
    );
    expect(turned.status, await turned.clone().text()).toBe(200);
    const made = (await turned.json()) as MediaJson & {
      asNewFile: boolean;
      width: number;
      height: number;
      alt: string;
    };
    expect(made).toMatchObject({ asNewFile: true, width: 10, height: 20, alt: "A wide chart" });
    expect(made.id).not.toBe(id);
    expect(made.id).toMatch(/-10x20\.png$/);
    expect(await objectBytes(id)).toEqual(original);
    expect((await mediaItem(id)).version).toBe(version);
  });

  it("says what changed since a cursor, and names a file deleted for good", async () => {
    const first = (await (await mediaCall("GET", `${PREFIX}/media?limit=1`)).json()) as {
      changeCursor: string;
    };
    const id = await uploadThroughApi("changes-case");
    type Changes = {
      items: MediaJson[];
      removed: string[];
      changeCursor: string;
      moreChanges: boolean;
    };
    const changed = (await (
      await mediaCall("GET", `${PREFIX}/media?changedSince=${first.changeCursor}`)
    ).json()) as Changes;
    expect(changed.items.map((i) => i.id)).toContain(id);
    expect(changed.removed).toEqual([]);

    expect(
      (await mediaCall("DELETE", `${PREFIX}/media/${id}?changeId=chg-changes-delete`)).status,
    ).toBe(200);
    const after = (await (
      await mediaCall("GET", `${PREFIX}/media?changedSince=${changed.changeCursor}`)
    ).json()) as Changes;
    expect(after.removed).toEqual([id]);
    expect(after.items.map((i) => i.id)).not.toContain(id);
  });

  it("fills credit, license and the date taken from a JPEG's EXIF, and names what it filled", async () => {
    const bytes = exifJpeg({
      artist: "Example Photographer",
      copyright: "CC BY 4.0",
      taken: "2024:05:06 14:30:00",
      offset: "+01:00",
    });
    const query = new URLSearchParams({
      filename: "exif-case.jpg",
      changeId: "chg-exif",
      decorative: "yes",
    });
    const response = await mediaCall("POST", `${PREFIX}/media?${query}`, {
      body: bytes,
      type: "image/jpeg",
    });
    expect(response.status, await response.clone().text()).toBe(201);
    expect(await response.json()).toMatchObject({
      credit: "Example Photographer",
      license: "CC BY 4.0",
      takenAt: "2024-05-06T14:30:00+01:00",
      embedded: ["credit", "license", "takenAt"],
    });
  });

  it("shrinks a large picture at upload, unless asked not to, and keeps the original", async () => {
    const overrides = {
      IMAGES: imagesThatTransform({ width: 8000, height: 6000 }, () => ({
        width: 4096,
        height: 3072,
      })),
    };
    const response = await mediaCall(
      "POST",
      `${PREFIX}/media?${uploadQuery("resize-case")}`,
      { body: bytesFor("resize-case"), type: "image/png" },
      overrides,
    );
    expect(response.status, await response.clone().text()).toBe(201);
    const shrunk = (await response.json()) as MediaJson & {
      width: number;
      resizedFrom?: Size & { bytes: number };
    };
    expect(shrunk).toMatchObject({
      width: 4096,
      resizedFrom: { width: 8000, height: 6000, bytes: bytesFor("resize-case").length },
    });
    const [kept] = (await testEnv.MEDIA_REVISIONS.list({ prefix: `replaced/${shrunk.id}/` }))
      .objects;
    expect(kept, "the original was not kept").toBeDefined();
    expect(
      new Uint8Array(await (await testEnv.MEDIA_REVISIONS.get(kept!.key))!.arrayBuffer()),
    ).toEqual(bytesFor("resize-case"));

    const kept2 = await mediaCall(
      "POST",
      `${PREFIX}/media?${uploadQuery("resize-no-case", { resize: "no" })}`,
      { body: bytesFor("resize-no-case"), type: "image/png" },
      overrides,
    );
    expect(await kept2.json()).toMatchObject({ width: 8000, height: 6000 });
  });

  it("suggests tags and alt text from the model, in the contract's spelling, and applies neither", async () => {
    const id = await uploadThroughApi("suggest-case");
    const sent: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
      sent.push(String(url), init?.body ?? "");
      return Response.json({
        id: "msg_1",
        type: "message",
        role: "assistant",
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              alt: "Three brass plaques set in a lawn.",
              tags: ["Plaques", "lawn", "lawn", "not a tag!"],
            }),
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      });
    }) as typeof fetch;
    let response: Response;
    try {
      response = await mediaCall(
        "GET",
        `${PREFIX}/media/${id}/suggestions`,
        {},
        { ANTHROPIC_API_KEY: "sk-ant-test", IMAGES: imagesThatTransform() },
      );
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({
      id,
      alt: "Three brass plaques set in a lawn.",
      tags: ["plaques", "lawn"],
    });
    expect(sent[0]).toBe("https://api.anthropic.com/v1/messages");
    expect(sent[1]).toContain('"media_type":"image/jpeg"');
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
      mediaDuplicates: true,
      mediaUsage: true,
      mediaFilters: true,
      mediaImport: true,
      mediaCredit: true,
      mediaTransform: true,
      mediaHistory: true,
      mediaChanges: true,
      mediaResize: { maxEdge: 2560, quality: 85 },
      mediaEmbedded: true,
      mediaSuggestions: true,
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
    expect((await mediaCall("GET", `${ORIGIN}/api/carrel/v2/media`)).status).toBe(404);
    expect((await mediaCall("GET", `${ORIGIN}/api/carrel/media`)).status).toBe(404);
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
    const response = await mediaCall(
      "POST",
      `${PREFIX}/media?filename=huge.png&changeId=chg-huge`,
      {
        body: bytes,
        type: "image/png",
      },
    );
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
      message: expect.stringMatching(
        /could not check where its files are used, so nothing was done \(the reference scan failed \(posts\)\)/,
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
