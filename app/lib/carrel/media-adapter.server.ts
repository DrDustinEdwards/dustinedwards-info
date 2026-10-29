// Carrel's media group (site-api v0.2.0) over the site's own media code: list over listMedia, upload
// over storeUpload, get and delete over the same reference check the admin library's delete runs.
// Alt text, tags and the trash (v0.4.0), the lenses and sorts (v0.6.0), and the focal point, caption
// and replace (v0.10.0) write the media index and, for the focal point and replace, the object itself
// through site-api's R2 helpers. Nothing here scans or deletes by a path of its own.

import {
  contentVersion,
  MediaId,
  MediaInUseError,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type MediaAdapter,
  type MediaItem,
  type MediaUse,
} from "@dustinedwards/site-api";
import { replaceObject, writeFocus, type R2BucketLike } from "@dustinedwards/site-api/r2";

import {
  claimMediaKeyForDelete,
  countMediaPage,
  mediaRecord,
  restoreMediaRecord,
  setMediaTags,
  trashMediaRecord,
  upsertMediaRecord,
} from "~/db";
import type { MediaRef } from "~/db/schema";
import { errorMessage } from "~/lib/error-message.mjs";
import { mediaDeleteVerdict, mediaUsage } from "~/lib/media/actions.server";
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
import { storeUpload } from "~/lib/media/upload.server";
import { parseTags } from "~/lib/media/tags.mjs";
import { ALLOWED, MAX_BYTES } from "~/lib/media/upload-contract.mjs";
import templateRefs from "../../../content/generated/template-refs.json";

/** Keys repository code references, from the build: a file one of them names is not unattached. */
const TEMPLATE_REF_KEYS = Object.keys(templateRefs.refs);

/**
 * What the admin library accepts, less SVG: an SVG is served as an attachment and never inserted
 * inline, so Carrel is not offered it. Computed from ALLOWED, so a type the site drops leaves here too.
 */
const CARREL_MEDIA_LIMITS = {
  maxBytes: MAX_BYTES,
  types: [...ALLOWED.keys()].filter((type) => type !== "image/svg+xml"),
};

/** An ISO time, or null for an index row with no upload event or one that does not parse. */
function isoOrNull(value: string | null) {
  if (!value) return null;
  // SQLite's datetime('now') has no zone and is UTC.
  const at = Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? `${value.replace(" ", "T")}Z` : value);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

/**
 * A file's version: what its editable metadata and its bytes are now. The index row's `updated_at` moves on
 * every write here and on a replace, and the fields themselves are in it so two writes in one second differ.
 */
function versionOf(object: MediaObject) {
  return contentVersion([object.key, object.updatedAt, object.alt, object.caption, object.focus, object.size, object.tags, object.trashedAt]);
}

/** One library object in the contract's terms. Deletable only where the site's own delete could act. */
async function itemOf(object: MediaObject): Promise<MediaItem> {
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
    version: await versionOf(object),
    focus: object.focus,
    caption: object.caption,
    tags: parseTags(object.tags),
    trashedAt: isoOrNull(object.trashedAt),
  };
}

/** The stored file a write names, at the version the writer loaded; a static asset is never written here. */
async function writable(env: Env, id: string, expectedVersion: string): Promise<MediaObject> {
  const row = await mediaRecord(env, id);
  if (!row || row.storage === "static") throw new NotFoundError("No such media.");
  const object = mediaObjectOf(row);
  const version = await versionOf(object);
  if (version !== expectedVersion) throw new VersionConflictError(version);
  return object;
}

/** The file's version after a write, read back from the index. */
async function versionAfter(env: Env, id: string) {
  const row = await mediaRecord(env, id);
  if (!row) throw new Error(`${id} was written, but its index row cannot be read`);
  return versionOf(mediaObjectOf(row));
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
    lenses: ["unattached", "no-alt", "large"],
    // Every upload's address carries its size (-<w>x<h>), so replace refuses a picture of another size.
    replaceKeepsSize: true,

    async list(query) {
      const page = query.cursor && /^[1-9]\d{0,8}$/.test(query.cursor) ? Number(query.cursor) : 1;
      const trashed = query.trashed === "only";
      // The contract's name runs A to Z and the others largest or newest first, unless `dir` says otherwise.
      const dir = query.dir ?? (query.sort === "name" ? "asc" : "desc");
      // Bucket rows only: a static asset's key is a repo path, which is not a media id.
      const filter = {
        storedOnly: true,
        trashed,
        templateKeys: TEMPLATE_REF_KEYS,
        ...(query.q ? { q: query.q } : {}),
        ...(query.tag ? { tag: query.tag } : {}),
        ...(query.lens ? { lens: query.lens } : {}),
      };
      const [listed, total] = await Promise.all([
        listMedia(env, { ...filter, page, limit: query.limit, ...(query.sort ? { sort: query.sort, dir } : {}) }),
        countMediaPage(env, filter),
      ]);
      return {
        // A bucket key the id grammar cannot carry is left out rather than failing the whole page.
        items: await Promise.all(listed.objects.filter((o) => MediaId.safeParse(o.key).success).map(itemOf)),
        nextCursor: listed.hasMore ? String(listed.page + 1) : null,
        total,
        // The trash is always newest first.
        ...(query.sort && !trashed ? { sorted: { sort: query.sort, dir } } : {}),
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
      return { ...(await itemOf(mediaObjectOf(row))), usedBy: usesOf(usage.citations, usage.refs) };
    },

    async upload(input) {
      // A fresh ArrayBuffer, not `bytes.buffer`, which may be a larger allocation than the view.
      const bytes = new ArrayBuffer(input.bytes.byteLength);
      new Uint8Array(bytes).set(input.bytes);

      const stored = await storeUpload(env, { bytes, type: input.contentType, name: input.filename });
      if (!stored.ok) throw new RefusedError(stored.message);
      // The object landed and its row did not. Keys are content-addressed, so a retry is the repair.
      if (!stored.recorded) {
        throw new Error(`${stored.key} was stored but its index row was not written; send the upload again`);
      }
      if (input.alt) await upsertMediaRecord(env, { key: stored.key, alt: input.alt });

      const row = await mediaRecord(env, stored.key);
      if (!row) throw new Error(`${stored.key} was stored and recorded, but its index row cannot be read`);
      return itemOf(mediaObjectOf(row));
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

    // Alt is contextual, so saving it rewrites no post: only later insertions pick it up.
    async setAlt(id, input) {
      await writable(env, id, input.expectedVersion);
      await upsertMediaRecord(env, { key: id, alt: input.alt });
      return { version: await versionAfter(env, id) };
    },

    async setTags(id, input) {
      await writable(env, id, input.expectedVersion);
      await setMediaTags(env, id, input.tags);
      return { version: await versionAfter(env, id) };
    },

    // The trash only hides a file from the library: its address still works and no page changes.
    async trash(id, input) {
      await writable(env, id, input.expectedVersion);
      await trashMediaRecord(env, id);
      return { version: await versionAfter(env, id) };
    },

    async restore(id, input) {
      await writable(env, id, input.expectedVersion);
      await restoreMediaRecord(env, id);
      return { version: await versionAfter(env, id) };
    },

    // The object's customMetadata `focus` is what site-runtime ./image crops around; the index keeps the same
    // point for the admin library's cropped thumbnails. Object first: the index is re-derivable, R2 is the truth.
    async setFocus(id, input) {
      await writable(env, id, input.expectedVersion);
      await writeFocus(bucket, id, input.focus);
      await upsertMediaRecord(env, { key: id, ...focalColumns(input.focus) });
      return { version: await versionAfter(env, id) };
    },

    async setCaption(id, input) {
      await writable(env, id, input.expectedVersion);
      await upsertMediaRecord(env, { key: id, caption: input.caption });
      return { version: await versionAfter(env, id) };
    },

    async replace(id, input) {
      await writable(env, id, input.expectedVersion);
      const bytes = new ArrayBuffer(input.bytes.byteLength);
      new Uint8Array(bytes).set(input.bytes);
      const dimensions = await measureDimensions(env, bytes);
      // The key carries the picture's size (-<w>x<h>), and every page's srcset and aspect come from it.
      const named = dimensionsFromKey(id);
      if (named && (dimensions?.width !== named.width || dimensions?.height !== named.height)) {
        throw new RefusedError(
          `The new picture is ${dimensions ? `${dimensions.width}x${dimensions.height}` : "unmeasured"}, ` +
            `but this file's address says ${named.width}x${named.height}, which every page sizes it by. ` +
            `Upload it as a new file instead.`,
        );
      }
      // The old bytes are kept in the backup bucket before they go: the mirror would overwrite their twin, and
      // MEDIA is the one copy of an upload (wrangler.jsonc.example). Never deleted (check:destructive).
      const old = await env.MEDIA.get(id);
      if (!old) throw new NotFoundError("No such media.");
      await env.MEDIA_BACKUP.put(`replaced/${new Date().toISOString()}/${id}`, old.body, {
        httpMetadata: old.httpMetadata,
        customMetadata: old.customMetadata,
      });
      await replaceObject(bucket, id, { bytes: input.bytes, contentType: input.contentType });
      await upsertMediaRecord(env, {
        key: id,
        bytes: input.bytes.byteLength,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        focalX: null,
        focalY: null,
      });
      const row = await mediaRecord(env, id);
      if (!row) throw new Error(`${id} was replaced, but its index row cannot be read`);
      // The image route keys its cached sizes by the object's etag (site-runtime ./image 0.27.0), so none is stale.
      return { item: await itemOf(mediaObjectOf(row)), sizesNeedPurge: false };
    },
  };
}
