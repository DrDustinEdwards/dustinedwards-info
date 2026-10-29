// Carrel's media group (site-api v0.2.0) over the site's own media code: list over listMedia, upload
// over storeUpload, get and delete over the same reference check the admin library's delete runs.
// Alt, tags, trash and restore (v0.4.0) call the admin library's own core writes (actions.server.ts).
// The focal point, caption and replace (v0.10.0) write the media index and, for the first and last,
// the object itself through site-api's R2 helpers. Every write lands on the version it names in one
// statement (writeMediaAtRev), so a stale one is a 409, never a lost update. Nothing here scans or
// deletes by a path of its own.

import {
  MediaId,
  MediaInUseError,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type MediaAdapter,
  type MediaItem,
  type MediaLens,
  type MediaUse,
} from "@dustinedwards/site-api";
import { replaceObject, writeFocus, type R2BucketLike } from "@dustinedwards/site-api/r2";

import {
  claimMediaKeyForDelete,
  countMediaPage,
  followMediaObject,
  mediaRecord,
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
const LENSES: readonly MediaLens[] = ["unattached", "no-alt", "large"];

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
    version: versionOf(object.rev),
    tags: parseTags(object.tags),
    // D1's datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC, which Date.parse would read as local time.
    trashedAt: object.trashedAt ? isoOrNull(object.trashedAt.replace(/^(\S+) (\S+)$/, "$1T$2Z")) : null,
    focus: object.focus,
    caption: object.caption,
  };
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

    async list(query) {
      const page = query.cursor && /^[1-9]\d{0,8}$/.test(query.cursor) ? Number(query.cursor) : 1;
      const trashed = query.trashed === "only";
      // The contract's defaults: added and size run largest first, name A to Z.
      const sort = query.sort ?? "added";
      const dir = query.dir ?? (sort === "name" ? "asc" : "desc");
      // Bucket rows only: a static asset's key is a repo path, which is not a media id.
      const filter = { q: query.q, tag: query.tag, trashed, lens: query.lens, templateKeys: TEMPLATE_KEYS, storedOnly: true };
      const [listed, total] = await Promise.all([
        listMedia(env, { ...filter, page, limit: query.limit, sort, dir }),
        countMediaPage(env, filter),
      ]);
      return {
        // A bucket key the id grammar cannot carry is left out rather than failing the whole page.
        items: listed.objects.filter((o) => MediaId.safeParse(o.key).success).map(itemOf),
        nextCursor: listed.hasMore ? String(listed.page + 1) : null,
        total,
        // The trash is always newest-trashed first (listMediaPage), so it claims no sort it did not apply.
        ...(trashed ? {} : { sorted: { sort, dir } }),
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
      if (input.alt) {
        const written = await applyMediaAlt(env, stored.key, input.alt);
        if (!written.ok) throw new Error(`${stored.key} was stored, but its alt text was not saved (${written.reason})`);
      }

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
      // Checked before any object changes; the package's own check ran on a read, and this one is the write's.
      await claim(env, id, input.expectedVersion);
      // The old bytes are kept in the backup bucket before they go: the mirror would overwrite their twin, and
      // MEDIA is the one copy of an upload (wrangler.jsonc.example). Never deleted (check:destructive).
      const old = await env.MEDIA.get(id);
      if (!old) throw new NotFoundError("No such media.");
      await env.MEDIA_BACKUP.put(`replaced/${new Date().toISOString()}/${id}`, old.body, {
        httpMetadata: old.httpMetadata,
        customMetadata: old.customMetadata,
      });
      await replaceObject(bucket, id, { bytes: input.bytes, contentType: input.contentType });
      await followMediaObject(env, id, {
        bytes: input.bytes.byteLength,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        focalX: null,
        focalY: null,
      });
      const row = await mediaRecord(env, id);
      if (!row) throw new Error(`${id} was replaced, but its index row cannot be read`);
      // The image route keys its cached sizes by the object's etag (site-runtime ./image 0.27.0), so none is stale.
      return { item: itemOf(mediaObjectOf(row)), sizesNeedPurge: false };
    },
  };
}
