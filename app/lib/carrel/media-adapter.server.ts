// Carrel's media group (site-api v0.2.0) over the site's own media code: list over listMedia, upload
// over storeUpload, get and delete over the same reference check the admin library's delete runs.
// Alt, tags, trash and restore (v0.4.0) call the admin library's own core writes (actions.server.ts).
// The focal point, caption and replace (v0.10.0) write the media index and, for the first and last,
// the object itself through site-api's R2 helpers. Every write lands on the version it names in one
// statement (writeMediaAtRev), so a stale one is a 409, never a lost update. Nothing here scans or
// deletes by a path of its own.
//
// v0.13.0 (site-api): duplicates by content hash, usage counts and the `used` sort, orientation and kind
// filters, import from an https address, credit and license, turns and mirrors through the Images binding, a
// byte history with revert (revisions.server.ts), the change log a screen polls (triggers on `media`), shrinking
// large pictures at upload, embedded credit, copyright, description and date, and suggested tags and alt text
// from Workers AI (suggest.server.ts). Not offered: the resize pass over stored pictures, because every
// address carries its picture's size, so a stored picture is never shrunk in place.

import {
  MediaId,
  MediaInUseError,
  MediaPlaceholder,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  transformFocus,
  turnsSize,
  type MediaAdapter,
  type MediaItem,
  type MediaLens,
  type MediaResize,
  type MediaTransformOp,
  type MediaUploaded,
  type MediaUse,
} from "@dustinedwards/site-api";
import { writeFocus, type R2BucketLike } from "@dustinedwards/site-api/r2";
import { editImage } from "@dustinedwards/site-runtime/image";
import { sha256Hex } from "@dustinedwards/site-runtime/encoding";

import {
  addMediaRevision,
  claimMediaKeyForDelete,
  countMediaPage,
  followMediaObject,
  mediaByHash,
  mediaChangeCursor,
  mediaChangedSince,
  mediaRecord,
  mediaRecords,
  mediaRefCounts,
  mediaTwins,
  writeMediaAtRev,
} from "~/db";
import type { MediaRef } from "~/db/schema";
import { errorMessage } from "~/lib/error-message.mjs";
import {
  applyMediaAlt,
  applyMediaRestore,
  applyMediaTags,
  applyMediaTrash,
  mediaDeleteVerdict,
  mediaUsage,
  settleMediaWrite,
  type MediaWrite,
  type MediaWriteOptions,
} from "~/lib/media/actions.server";
import { classify, dimensionsFromKey } from "~/lib/media/classify.mjs";
import {
  deleteMediaObject,
  isManagedKey,
  listMedia,
  measureDimensions,
  mediaObjectOf,
  type MediaObject,
} from "~/lib/media/core.server";
import type { MediaCitation } from "~/lib/media/resolvers.server";
import { readEmbedded } from "~/lib/media/embedded.server";
import { historyOf, revisionBytes, swapBytes } from "~/lib/media/revisions.server";
import { suggestFor } from "~/lib/media/suggest.server";
import { storeUpload } from "~/lib/media/upload.server";
import { normalizeTags, parseTags } from "~/lib/media/tags.mjs";
import { ALLOWED, MAX_BYTES } from "~/lib/media/upload-contract.mjs";
import templateRefs from "../../../content/generated/template-refs.json";

/**
 * What the admin library accepts, less SVG: an SVG is served as an attachment and never inserted
 * inline, so Carrel is not offered it. Computed from ALLOWED, so a type the site drops leaves here too.
 */
const CARREL_MEDIA_LIMITS = {
  maxBytes: MAX_BYTES,
  types: [...ALLOWED.keys()].filter((type) => type !== "image/svg+xml"),
};

/** An ISO time, or null for an index row with no upload event or one that does not parse. */
function isoOrNull(value: string) {
  const at = Date.parse(value);
  return value && !Number.isNaN(at) ? new Date(at).toISOString() : null;
}

/**
 * The ready-made views Carrel may ask for, each the admin library's own filter of the same name (listMediaPage).
 * The site's large threshold is the contract's LARGE_MEDIA_BYTES, one MiB.
 */
const LENSES: readonly MediaLens[] = ["unattached", "no-alt", "large", "duplicates", "license-expired", "oversized"];

/**
 * What an upload shrinks to unless it says `resize=no`: the longer edge kept, and the quality it is encoded at. Wide
 * enough that a phone photo (4032 pixels) keeps its size; a larger camera file is shrunk, its original kept in the
 * backup bucket and in the file's history.
 */
const RESIZE: MediaResize = { maxEdge: 4096, quality: 85 };

/** The quality a turn or a mirror encodes at: high, since each one re-encodes a lossy picture. */
const TRANSFORM_QUALITY = 92;

/** Pictures the Images binding re-encodes in their own type. A GIF is left out: it may be animated, and a turn would keep one frame. */
const REENCODED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
type Encoded = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

/** Each transform as editImage's options. A quarter turn is clockwise, as the contract's rotate-90 is. */
const TRANSFORMS: Record<MediaTransformOp, Pick<Parameters<typeof editImage>[2], "rotate" | "flip">> = {
  "rotate-90": { rotate: 90 },
  "rotate-180": { rotate: 180 },
  "rotate-270": { rotate: 270 },
  "flip-h": { flip: "h" },
  "flip-v": { flip: "v" },
};

/** A view's bytes as a fresh ArrayBuffer, not `bytes.buffer`, which may be a larger allocation than the view. */
function bufferOf(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/** Runs one edit through the Images binding (site-runtime's editImage) and answers the new bytes, in the picture's own type. */
async function reencode(env: Env, body: ReadableStream | Uint8Array, edit: Pick<Parameters<typeof editImage>[2], "rotate" | "flip" | "maxEdge">, format: Encoded, quality: number) {
  const response = await editImage(env.IMAGES, body, { ...edit, format, quality });
  return new Uint8Array(await response.arrayBuffer());
}

/** Keys repository code references: unattached also leaves these out, as in the admin library. */
const TEMPLATE_KEYS = Object.keys((templateRefs as { refs: Record<string, string[]> }).refs);

/**
 * A file's version is its index row's `rev`, which every write to alt, caption, tags, focal point, trash
 * state or bytes bumps in the same statement that checks it (writeMediaAtRev), so two writes in one second differ.
 */
const versionOf = (rev: number) => `r${rev}`;

/** The rev a version names, or -1 (which no row holds) for anything this site never answered. */
function revOf(version: string) {
  return /^r(0|[1-9]\d{0,15})$/.test(version) ? Number(version.slice(1)) : -1;
}

/** One library object in the contract's terms. Deletable only where the site's own delete could act. */
function itemOf(object: MediaObject, usedCount?: number): MediaItem {
  return {
    id: object.key,
    url: object.url,
    filename: object.originalName ? object.originalName.slice(0, 300) : null,
    contentType: object.mime ?? classify(object.key).mime,
    bytes: object.size,
    width: object.width && object.width > 0 ? object.width : null,
    height: object.height && object.height > 0 ? object.height : null,
    alt: object.alt,
    uploadedAt: isoOrNull(object.uploaded),
    deletable: isManagedKey(object.key),
    version: versionOf(object.rev),
    tags: parseTags(object.tags),
    // D1's datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC, which Date.parse would read as local time.
    trashedAt: object.trashedAt ? isoOrNull(object.trashedAt.replace(/^(\S+) (\S+)$/, "$1T$2Z")) : null,
    focus: object.focus,
    caption: object.caption,
    ...(usedCount === undefined ? {} : { usedCount }),
    // The upload's LQIP, where it is a placeholder the contract can carry (a small raster data: URI).
    placeholder: object.placeholder && MediaPlaceholder.safeParse(object.placeholder).success ? object.placeholder : null,
    color: null,
    credit: object.credit,
    license: object.license,
    sourceUrl: object.sourceUrl,
    licenseExpires: object.licenseExpires,
    takenAt: object.takenAt,
    downloadUrl: object.url,
  };
}

/** Items with their usage counts: the pipeline's recorded citations, one count query for the page. */
async function itemsWithUse(env: Env, objects: MediaObject[]): Promise<MediaItem[]> {
  const listed = objects.filter((o) => MediaId.safeParse(o.key).success);
  const counts = await mediaRefCounts(env, listed.map((o) => o.key));
  return listed.map((o) => itemOf(o, counts.get(o.key) ?? 0));
}

/** Carrel's writes never reach a static asset, and name the version they were loaded at. */
const versioned = (expectedVersion: string): MediaWriteOptions => ({ expectedRev: revOf(expectedVersion), storedOnly: true });

/** A core write's outcome as the contract's answer or error. */
function answer(write: MediaWrite, id: string, refusal = `${id} is not an upload.`): { version: string } {
  if (write.ok) return { version: versionOf(write.rev) };
  switch (write.reason) {
    case "missing":
      throw new NotFoundError("No such media.");
    case "stale":
      throw new VersionConflictError(versionOf(write.rev), "The file changed since it was loaded.");
    case "static":
      throw new RefusedError(`${id} is one of the site's own static assets, which this API never changes.`);
    case "unmanaged":
      throw new RefusedError(refusal);
  }
}

/**
 * Claims the version for a write that must touch R2 before the index: the rev moves first, in one statement, so a
 * stale writer is refused before any object changes. If the object write then fails, the version has moved and
 * nothing else has, so the caller reloads and sends it again.
 */
async function claim(env: Env, id: string, expectedVersion: string) {
  const options = versioned(expectedVersion);
  return answer(settleMediaWrite(await writeMediaAtRev(env, id, {}, options), options), id);
}

/** "XxY" as the index's two columns. The package has already checked the spelling (focusOf). */
function focalColumns(focus: string | null) {
  if (focus === null) return { focalX: null, focalY: null };
  const [x, y] = focus.split("x").map(Number);
  return { focalX: x ?? null, focalY: y ?? null };
}

/**
 * Every use the check found: each resolver citation, then each recorded reference from an item no
 * citation already names, since a recorded reference alone refuses the delete too.
 */
function usesOf(citations: MediaCitation[], refs: MediaRef[]): MediaUse[] {
  const uses: MediaUse[] = citations.map((c) => ({
    type: c.type,
    id: c.id,
    title: c.title.slice(0, 1000),
    detail: c.detail.slice(0, 500),
  }));
  const named = new Set(citations.map((c) => `${c.type}:${c.id}`));
  for (const ref of refs) {
    if (named.has(`${ref.sourceType}:${ref.sourceId}`)) continue;
    uses.push({
      type: ref.sourceType,
      id: ref.sourceId,
      title: ref.sourceId,
      detail: `recorded ${ref.form}${ref.detail ? `, ${ref.detail}` : ""}`.slice(0, 500),
    });
  }
  return uses;
}

export function carrelMediaAdapter(env: Env): MediaAdapter {
  // The binding's `put` takes a wider `onlyIf` than the helpers' narrow interface names; the shapes they use agree.
  const bucket = env.MEDIA as unknown as R2BucketLike;
  return {
    limits: CARREL_MEDIA_LIMITS,

    lenses: LENSES,
    // Every upload's address carries its size (-<w>x<h>), so replace refuses a picture of another size.
    replaceKeepsSize: true,
    // v0.13.0
    usage: true,
    filters: true,
    resize: RESIZE,
    readsEmbedded: true,
    // The package checks every address and each redirect before this fetch runs (importRefusal, fetchImport).
    importFetch: ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)) as typeof fetch,

    async list(query) {
      const page = query.cursor && /^[1-9]\d{0,8}$/.test(query.cursor) ? Number(query.cursor) : 1;
      const trashed = query.trashed === "only";
      // The contract's defaults: added and size run largest first, name A to Z, used most used first.
      const sort = query.sort ?? "added";
      const dir = query.dir ?? (sort === "name" ? "asc" : "desc");
      // Bucket rows only: a static asset's key is a repo path, which is not a media id.
      const filter = {
        q: query.q,
        tag: query.tag,
        trashed,
        lens: query.lens,
        templateKeys: TEMPLATE_KEYS,
        storedOnly: true,
        orientation: query.orientation,
        fileKind: query.kind,
        maxEdge: RESIZE.maxEdge,
      };
      // The cursor first: a change that lands while the page is read is in the next poll, not lost between them.
      const changeCursor = String(await mediaChangeCursor(env));
      const [listed, total] = await Promise.all([
        listMedia(env, { ...filter, page, limit: query.limit, sort: sort === "used" ? "usage" : sort, dir }),
        countMediaPage(env, filter),
      ]);
      return {
        // A bucket key the id grammar cannot carry is left out rather than failing the whole page.
        items: await itemsWithUse(env, listed.objects),
        nextCursor: listed.hasMore ? String(listed.page + 1) : null,
        total,
        // The trash is always newest-trashed first (listMediaPage), so it claims no sort it did not apply.
        ...(trashed ? {} : { sorted: { sort, dir } }),
        changeCursor,
      };
    },

    async get(id) {
      const row = await mediaRecord(env, id);
      if (!row || row.storage === "static") return null;
      const usage = await mediaUsage(env, id);
      if (!usage.complete) {
        throw new RefusedError(
          `The detail is refused: the reference scan failed (${usage.failed.join(", ")}), ` +
            `so this file's uses are unknown.`,
        );
      }
      const usedBy = usesOf(usage.citations, usage.refs);
      const twins = ((await mediaTwins(env)).get(id) ?? [])
        .filter((t) => MediaId.safeParse(t.key).success)
        .slice(0, 50)
        .map((t) => ({ id: t.key, filename: t.originalName ? t.originalName.slice(0, 300) : null }));
      return { ...itemOf(mediaObjectOf(row), usedBy.length), usedBy, twins };
    },

    async upload(input) {
      // Read before any shrink, which drops the metadata with the pixels.
      const found = readEmbedded(input.bytes, input.contentType);

      // Shrunk to RESIZE unless the upload said no; the original is kept below, so nothing is lost.
      let bytes = input.bytes;
      let resizedFrom: MediaUploaded["resizedFrom"];
      if (input.resize && REENCODED.has(input.contentType)) {
        const size = await measureDimensions(env, bufferOf(input.bytes));
        if (size && Math.max(size.width, size.height) > RESIZE.maxEdge) {
          bytes = await reencode(env, input.bytes, { maxEdge: RESIZE.maxEdge }, input.contentType as Encoded, RESIZE.quality);
          resizedFrom = { width: size.width, height: size.height, bytes: input.bytes.byteLength };
        }
      }

      const stored = await storeUpload(env, { bytes: bufferOf(bytes), type: input.contentType, name: input.filename });
      if (!stored.ok) throw new RefusedError(stored.message);
      // The object landed and its row did not. Keys are content-addressed, so a retry is the repair.
      if (!stored.recorded) {
        throw new Error(`${stored.key} was stored but its index row was not written; send the upload again`);
      }
      if (input.alt) {
        const written = await applyMediaAlt(env, stored.key, input.alt);
        if (!written.ok) throw new Error(`${stored.key} was stored, but its alt text was not saved (${written.reason})`);
      }

      const before = await mediaRecord(env, stored.key);
      if (!before) throw new Error(`${stored.key} was stored and recorded, but its index row cannot be read`);
      // The embedded fields fill only what is empty; an import keeps the address it came from.
      const embedded = (["credit", "license", "caption", "takenAt"] as const).filter((field) => found[field] && !before[field]);
      const fill = Object.fromEntries(embedded.map((field) => [field, found[field]]));
      if (embedded.length > 0 || input.sourceUrl) {
        await writeMediaAtRev(env, stored.key, { ...fill, ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}) }, { storedOnly: true });
      }
      if (resizedFrom) {
        // The original in the backup bucket and in the file's history, as the revision the shrink replaced.
        const backupKey = `resized/${new Date().toISOString()}/${stored.key}`;
        await env.MEDIA_BACKUP.put(backupKey, bufferOf(input.bytes), { httpMetadata: { contentType: input.contentType } });
        const at = new Date().toISOString();
        await addMediaRevision(env, {
          mediaKey: stored.key,
          at,
          bytes: resizedFrom.bytes,
          width: resizedFrom.width,
          height: resizedFrom.height,
          reason: input.sourceUrl ? "import" : "upload",
          sha256: input.sha256 ?? (await sha256Hex(input.bytes)),
          backupKey,
        });
        await addMediaRevision(env, { mediaKey: stored.key, at, bytes: stored.bytes, width: stored.width, height: stored.height, reason: "resize", sha256: before.sha256 });
      }

      const row = await mediaRecord(env, stored.key);
      if (!row) throw new Error(`${stored.key} was stored and recorded, but its index row cannot be read`);
      return {
        ...itemOf(mediaObjectOf(row), 0),
        ...(embedded.length > 0 ? { embedded: [...embedded] } : {}),
        ...(resizedFrom ? { resizedFrom } : {}),
      };
    },

    async delete(id) {
      // First, before any scan: an id the index has never held is a 404.
      const row = await mediaRecord(env, id);
      if (!row) throw new NotFoundError("No such media.");

      let verdict: Awaited<ReturnType<typeof mediaDeleteVerdict>>;
      try {
        verdict = await mediaDeleteVerdict(env, id);
      } catch (error) {
        throw new RefusedError(
          `Nothing was deleted: the reference check could not complete (${errorMessage(error)}).`,
        );
      }

      switch (verdict.kind) {
        case "static":
        case "unmanaged":
          throw new RefusedError(
            `${id} is not an upload: the site derives it, so it is never deleted through this API.`,
          );
        case "scan-failed":
          throw new RefusedError(
            `Nothing was deleted: the reference scan failed (${verdict.failed.join(", ")}), ` +
              `so it cannot be confirmed that nothing uses this file.`,
          );
        case "cited":
          throw new MediaInUseError(usesOf(verdict.citations, verdict.refs));
        case "clear":
          break;
      }

      /* One statement claims the row only if nothing cites it now. Row first: an orphan object backfills. */
      if (!(await claimMediaKeyForDelete(env, id))) {
        throw new RefusedError(`${id} was cited or removed while this delete was being checked. Try again.`);
      }
      await deleteMediaObject(env, id);
    },

    async setAlt(id, input) {
      return answer(
        await applyMediaAlt(env, id, input.alt, versioned(input.expectedVersion)),
        id,
        `${id} is not an upload: the site derives it, so its alt text is not edited here.`,
      );
    },

    async setTags(id, input) {
      // The contract's spelling is the site's, so a tag the site's normalizer would change is refused, never altered.
      const spelled = normalizeTags(input.tags);
      const changed = input.tags.find((tag) => !spelled.includes(tag));
      if (changed !== undefined || spelled.length !== new Set(input.tags).size) {
        throw new RefusedError(`The tag ${changed ?? input.tags.join(", ")} is not in the site's spelling.`);
      }
      return answer(await applyMediaTags(env, id, spelled, versioned(input.expectedVersion)), id);
    },

    // A trashed file keeps its object and address, so a page that uses it is unchanged. Trashing a file
    // already in the trash, at the version it holds, answers that version.
    async trash(id, input) {
      return answer(await applyMediaTrash(env, id, versioned(input.expectedVersion)), id);
    },

    async restore(id, input) {
      return answer(await applyMediaRestore(env, id, versioned(input.expectedVersion)), id);
    },

    // The object's customMetadata `focus` is what site-runtime ./image crops around; the index keeps the same
    // point for the admin library's cropped thumbnails. Object before the index's columns: R2 is the truth.
    async setFocus(id, input) {
      const claimed = await claim(env, id, input.expectedVersion);
      await writeFocus(bucket, id, input.focus);
      await followMediaObject(env, id, focalColumns(input.focus));
      return claimed;
    },

    async setCaption(id, input) {
      const options = versioned(input.expectedVersion);
      return answer(settleMediaWrite(await writeMediaAtRev(env, id, { caption: input.caption }, options), options), id);
    },

    async replace(id, input) {
      const dimensions = await measureDimensions(env, bufferOf(input.bytes));
      // The key carries the picture's size (-<w>x<h>), and every page's srcset and aspect come from it.
      const named = dimensionsFromKey(id);
      if (named && (dimensions?.width !== named.width || dimensions?.height !== named.height)) {
        throw new RefusedError(
          `The new picture is ${dimensions ? `${dimensions.width}x${dimensions.height}` : "unmeasured"}, ` +
            `but this file's address says ${named.width}x${named.height}, which every page sizes it by. ` +
            `Upload it as a new file instead.`,
        );
      }
      // Checked before any object changes; the package's own check ran on a read, and this one is the write's.
      await claim(env, id, input.expectedVersion);
      const current = await mediaRecord(env, id);
      if (!current) throw new NotFoundError("No such media.");
      // The old bytes are kept in the backup bucket and the file's history before they go: the mirror would
      // overwrite their twin, and MEDIA is the one copy of an upload (wrangler.jsonc.example). Never deleted.
      await swapBytes(
        env,
        current,
        { bytes: input.bytes, contentType: input.contentType, width: dimensions?.width ?? null, height: dimensions?.height ?? null, reason: "replace" },
        { focalX: null, focalY: null },
      );
      const row = await mediaRecord(env, id);
      if (!row) throw new Error(`${id} was replaced, but its index row cannot be read`);
      // The image route keys its cached sizes by the object's etag (site-runtime ./image 0.27.0), so none is stale.
      return { item: itemOf(mediaObjectOf(row)), sizesNeedPurge: false };
    },

    // ---------- v0.13.0

    async findByHash(sha256) {
      const row = await mediaByHash(env, sha256);
      return row && MediaId.safeParse(row.key).success ? itemOf(mediaObjectOf(row)) : null;
    },

    async setCredit(id, input) {
      const options = versioned(input.expectedVersion);
      const { credit, license, sourceUrl, licenseExpires } = input;
      return answer(settleMediaWrite(await writeMediaAtRev(env, id, { credit, license, sourceUrl, licenseExpires }, options), options), id);
    },

    // Through the Images binding, in the picture's own type. A quarter turn of a picture that is not square comes
    // here as a new file (`asNewFile`), since its address carries its size; anything else turns in place.
    async transform(id, input) {
      const row = await mediaRecord(env, id);
      if (!row) throw new NotFoundError("No such media.");
      const type = row.mime ?? classify(id).mime;
      if (!REENCODED.has(type)) {
        throw new RefusedError(`A ${type} picture is not turned here: a GIF may be animated, and a turn would keep one frame.`);
      }
      const object = await env.MEDIA.get(id);
      if (!object) throw new NotFoundError("No such media.");
      const bytes = await reencode(env, object.body, TRANSFORMS[input.op], type as Encoded, TRANSFORM_QUALITY);
      const swapped = turnsSize(input.op);
      const width = swapped ? row.height : row.width;
      const height = swapped ? row.width : row.height;
      // The focal point moves with the picture rather than being cleared.
      const focus = transformFocus(mediaObjectOf(row).focus, input.op);

      if (input.asNewFile) {
        // The old file stays as it was, so a stale version is refused here rather than claimed.
        if (row.rev !== revOf(input.expectedVersion)) throw new VersionConflictError(versionOf(row.rev), "The file changed since it was loaded.");
        const stored = await storeUpload(env, { bytes: bufferOf(bytes), type, name: row.originalName ?? id });
        if (!stored.ok) throw new RefusedError(stored.message);
        if (!stored.recorded) throw new Error(`${stored.key} was stored but its index row was not written; send the turn again`);
        const { alt, caption, tags, credit, license, sourceUrl, licenseExpires, takenAt } = row;
        await writeMediaAtRev(env, stored.key, { alt, caption, tags, credit, license, sourceUrl, licenseExpires, takenAt, ...focalColumns(focus) }, { storedOnly: true });
        if (focus) await writeFocus(bucket, stored.key, focus);
        const made = await mediaRecord(env, stored.key);
        if (!made) throw new Error(`${stored.key} was stored and recorded, but its index row cannot be read`);
        await addMediaRevision(env, { mediaKey: stored.key, at: new Date().toISOString(), bytes: stored.bytes, width: stored.width, height: stored.height, reason: "transform", sha256: made.sha256 });
        return { item: itemOf(mediaObjectOf(made)), sizesNeedPurge: false };
      }

      await claim(env, id, input.expectedVersion);
      await swapBytes(env, row, { bytes, contentType: type, width, height, reason: "transform" }, focalColumns(focus));
      // replaceObject dropped the old point with the old bytes; the moved one goes back on the object for ./image.
      if (focus) await writeFocus(bucket, id, focus);
      const after = await mediaRecord(env, id);
      if (!after) throw new Error(`${id} was turned, but its index row cannot be read`);
      return { item: itemOf(mediaObjectOf(after)), sizesNeedPurge: false };
    },

    async history(id) {
      const row = await mediaRecord(env, id);
      if (!row || row.storage === "static") return null;
      return historyOf(env, row);
    },

    // The package has checked that `to` is an earlier revision of this size; the bytes come back from the copy that
    // revision kept, as a new revision, so a revert is itself undone by another.
    async revert(id, input) {
      const row = await mediaRecord(env, id);
      if (!row) throw new NotFoundError("No such media.");
      const kept = await revisionBytes(env, id, input.to);
      if (!kept) throw new NotFoundError("This file has no such earlier version, or its copy is gone.");
      await claim(env, id, input.expectedVersion);
      await swapBytes(
        env,
        row,
        { bytes: kept.bytes, contentType: row.mime ?? classify(id).mime, width: kept.row.width, height: kept.row.height, reason: "revert" },
        { focalX: null, focalY: null },
      );
      const after = await mediaRecord(env, id);
      if (!after) throw new Error(`${id} was reverted, but its index row cannot be read`);
      return { item: itemOf(mediaObjectOf(after)), sizesNeedPurge: false };
    },

    // From the change log the triggers on `media` write: every insert, update and delete of an upload's row.
    async changes({ since, limit }) {
      if (!/^(0|[1-9]\d{0,15})$/.test(since)) throw new RefusedError("That change cursor is not this site's; reload the library.");
      const head = await mediaChangeCursor(env);
      const from = Number(since);
      if (from > head) throw new RefusedError("That change cursor is not this site's; reload the library.");
      const changed = await mediaChangedSince(env, from, head, limit);
      const more = changed.length > limit;
      const taken = changed.slice(0, limit).filter((c) => MediaId.safeParse(c.key).success);
      const rows = new Map((await mediaRecords(env, taken.map((c) => c.key))).map((row) => [row.key, row]));
      const present = taken.flatMap((c) => {
        const row = rows.get(c.key);
        return row && row.storage !== "static" ? [mediaObjectOf(row)] : [];
      });
      return {
        items: await itemsWithUse(env, present),
        removed: taken.filter((c) => !rows.has(c.key)).map((c) => c.key),
        cursor: String(more ? changed[limit - 1]!.seq : head),
        more,
      };
    },

    // Never applied: Carrel and the admin library show them, and a person accepts each as an alt or tags write.
    async suggest(id) {
      const row = await mediaRecord(env, id);
      if (!row || row.storage === "static") return null;
      if (row.kind !== "image") throw new RefusedError("Only a picture gets suggested tags and alt text.");
      const object = await env.MEDIA.get(id);
      if (!object) return null;
      try {
        return await suggestFor(env, object);
      } catch (error) {
        throw new RefusedError(`No suggestion was made: ${errorMessage(error)}`);
      }
    },
  };
}
