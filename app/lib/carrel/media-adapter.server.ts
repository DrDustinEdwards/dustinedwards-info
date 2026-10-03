// Carrel's media group (site-api v0.2.0) over the site's own media code: list over listMedia, upload
// over storeUpload, get and delete over the same reference check the admin library's delete runs.
// Nothing here stores, scans or deletes by a path of its own.

import {
  MediaId,
  MediaInUseError,
  NotFoundError,
  RefusedError,
  type MediaAdapter,
  type MediaItem,
  type MediaUse,
} from "@dustinedwards/site-api";

import { claimMediaKeyForDelete, mediaRecord, upsertMediaRecord } from "~/db";
import type { MediaRef } from "~/db/schema";
import { errorMessage } from "~/lib/error-message.mjs";
import { mediaDeleteVerdict, mediaUsage } from "~/lib/media/actions.server";
import { classify } from "~/lib/media/classify.mjs";
import {
  deleteMediaObject,
  isManagedKey,
  listMedia,
  mediaObjectOf,
  type MediaObject,
} from "~/lib/media/core.server";
import type { MediaCitation } from "~/lib/media/resolvers.server";
import { storeUpload } from "~/lib/media/upload.server";
import { ALLOWED, MAX_BYTES } from "~/lib/media/upload-contract.mjs";

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

/** One library object in the contract's terms. Deletable only where the site's own delete could act. */
function itemOf(object: MediaObject): MediaItem {
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
  };
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
  return {
    limits: CARREL_MEDIA_LIMITS,

    async list(query) {
      const page = query.cursor && /^[1-9]\d{0,8}$/.test(query.cursor) ? Number(query.cursor) : 1;
      // Bucket rows only: a static asset's key is a repo path, which is not a media id.
      const listed = await listMedia(env, { page, limit: query.limit, q: query.q, storedOnly: true });
      return {
        // A bucket key the id grammar cannot carry is left out rather than failing the whole page.
        items: listed.objects.filter((o) => MediaId.safeParse(o.key).success).map(itemOf),
        nextCursor: listed.hasMore ? String(listed.page + 1) : null,
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
      return { ...itemOf(mediaObjectOf(row)), usedBy: usesOf(usage.citations, usage.refs) };
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
  };
}
