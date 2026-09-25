import {
  claimMediaKeyForDelete,
  mediaCounts,
  mediaRecord,
  mediaRefsFor,
  mediaRoleCounts,
  restoreMediaRecord,
  setMediaTags,
  trashMediaRecord,
  upsertMediaRecord,
} from "~/db";
import { applyBulkTag } from "~/lib/admin/bulk-tag";
import { errorMessage } from "~/lib/error-message.mjs";
import { storageOf } from "./classify.mjs";
import { deleteMediaObject, isManagedKey } from "./core.server";
import { rebuildMediaIndex } from "./rebuild.server";
import { resolveCitations, type MediaCitation } from "./resolvers.server";
import { normaliseTags, parseTags } from "./tags.mjs";

/*
 * One handler per intent of the media library's action. The route keeps the dispatch and, for the
 * three destructive intents, the typed confirmation: check:destructive reads both off the route's
 * own action, so a handler here runs only once the route has let it.
 */

type Message = { message: string };

export async function bulkTagMedia(
  env: Env,
  form: FormData,
  intent: "bulk-add-tag" | "bulk-remove-tag",
): Promise<Message> {
  const keys = form.getAll("key").map(String).filter(Boolean);
  if (keys.length === 0) return { message: "Nothing selected." };

  const wanted = normaliseTags(String(form.get("tag") ?? ""))[0];
  if (!wanted) return { message: "Enter a tag first." };
  const adding = intent === "bulk-add-tag";

  // Rows already in the target state are skipped, so updated_at is not touched for nothing.
  const { done, skipped, failed } = await applyBulkTag({
    ids: keys,
    wanted,
    adding,
    missing: "no row",
    read: async (key) => {
      const row = await mediaRecord(env, key);
      return row ? { item: row, tags: parseTags(row.tags) } : null;
    },
    write: (key, _row, tags) => setMediaTags(env, key, tags),
  });

  return {
    message:
      `${adding ? "Tagged" : "Untagged"} ${done} of ${keys.length}` +
      (skipped > 0 ? `, ${skipped} already ${adding ? "tagged" : "untagged"}` : "") +
      "." +
      (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : ""),
  };
}

export async function setMediaTagsFromForm(env: Env, form: FormData): Promise<Message> {
  const key = String(form.get("key") ?? "");
  const tags = String(form.get("tags") ?? "").trim();

  /* An empty field does not clear; clearing needs `clear`, so an accident cannot wipe every tag. */
  const clearing = form.get("clear") !== null;
  if (!tags && !clearing) {
    return {
      message:
        `Nothing changed for ${key}. The tag field was empty, and an empty ` +
        `field does not clear tags. Remove them one at a time, or press ` +
        `Clear all.`,
    };
  }

  const saved = await setMediaTags(env, key, clearing ? "" : tags);
  return {
    message: saved.length
      ? `Tags saved for ${key}: ${saved.join(", ")}.`
      : `Tags cleared for ${key}.`,
  };
}

export async function bulkTrashMedia(env: Env, form: FormData): Promise<Message> {
  const keys = form.getAll("key").map(String).filter(Boolean);
  if (keys.length === 0) return { message: "Nothing selected." };
  let moved = 0;
  let already = 0;
  const failed: string[] = [];
  for (const key of keys) {
    try {
      const result = await trashMediaRecord(env, key);
      if (result.moved) moved += 1;
      else already += 1;
    } catch (error) {
      failed.push(`${key}: ${errorMessage(error)}`);
    }
  }
  return {
    message:
      `Moved ${moved} of ${keys.length} to the trash` +
      (already > 0 ? `, ${already} already there` : "") +
      ". Every address still works and no published page changes." +
      (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : ""),
  };
}

export async function trashMedia(env: Env, form: FormData): Promise<Message> {
  const key = String(form.get("key") ?? "");
  const { moved } = await trashMediaRecord(env, key);
  return {
    message: moved
      ? `${key} moved to the trash. Its address still works and any page using it is unchanged; this hides it from the library.`
      : `${key} was already in the trash.`,
  };
}

export async function restoreMedia(env: Env, form: FormData): Promise<Message> {
  const key = String(form.get("key") ?? "");
  const { restored } = await restoreMediaRecord(env, key);
  return {
    message: restored
      ? `${key} restored to the library.`
      : `${key} was not in the trash.`,
  };
}

/** Empties the trash the route has confirmed, keeping every key a post cites. */
export async function emptyMediaTrash(env: Env, keys: string[]): Promise<Message> {
  /* The same scan as the single delete: media_refs alone misses a citation the pipeline has not recorded. */
  const resolution = await resolveCitations(env, keys.filter(isManagedKey));
  if (!resolution.complete) {
    return {
      message:
        `Nothing was deleted: the reference scan failed (${resolution.failed.join(", ")}), ` +
        `so it cannot be confirmed that nothing cites these files.`,
    };
  }
  const deleted: string[] = [];
  const refused: string[] = [];
  for (const key of keys) {
    // Static rows have no object to remove, so emptying leaves them binned.
    if (!isManagedKey(key)) {
      refused.push(`${key} (static, nothing to delete)`);
      continue;
    }
    if ((resolution.citations.get(key) ?? []).length > 0) {
      refused.push(`${key} (a post cites it)`);
      continue;
    }
    const claimed = await claimMediaKeyForDelete(env, key);
    if (!claimed) {
      refused.push(`${key} (something cites it)`);
      continue;
    }
    try {
      await deleteMediaObject(env, key);
      deleted.push(key);
    } catch (error) {
      refused.push(`${key} (${errorMessage(error)})`);
    }
  }
  return {
    message:
      `Emptied ${deleted.length} of ${keys.length}.` +
      (refused.length ? ` Kept: ${refused.join("; ")}.` : ""),
  };
}

export async function setMediaAlt(env: Env, form: FormData): Promise<Message> {
  const key = String(form.get("key") ?? "");
  if (!isManagedKey(key)) return { message: "Not a managed media key." };
  // Saving alt rewrites no post: alt is contextual, so only future insertions pick it up.
  await upsertMediaRecord(env, { key, alt: String(form.get("alt") ?? "") });
  return { message: `Alt text saved for ${key}. Existing posts are unchanged.` };
}

/** The row count the rebuild confirmation shows. */
export async function mediaRowTotal(env: Env) {
  const before = await mediaCounts(env);
  return before.reduce((sum, row) => sum + Number(row.n), 0);
}

/** Runs the rebuild the route has confirmed and reports what the index holds after it. */
export async function rebuildMedia(env: Env): Promise<Message> {
  const report = await rebuildMediaIndex(env);
  const after = await mediaCounts(env);
  const total = after.reduce((sum, row) => sum + Number(row.n), 0);
  const breakdown = after
    .map((row) => `${row.n} ${row.storage}/${row.kind}`)
    .sort()
    .join(", ");
  const roles = await mediaRoleCounts(env);
  const roleBreakdown = roles
    .map((row) => `${row.n} ${row.role}`)
    .sort()
    .join(", ");

  const parts = [
    `Rebuilt from ${report.scannedObjects} R2 object(s) and ${report.scannedFiles} static ` +
      `file(s). The index now holds ${total} row(s): ${breakdown}`,
    `By role: ${roleBreakdown}`,
  ];
  if (report.removed > 0) {
    parts.push(`${report.removed} row(s) removed for sources that no longer exist`);
  }
  if (report.failures.length > 0) {
    parts.push(
      `${report.failures.length} could not be derived: ${report.failures.slice(0, 3).join("; ")}` +
        (report.failures.length > 3 ? ` and ${report.failures.length - 3} more` : ""),
    );
  }
  parts.push("Alt text, captions and focal points were preserved");
  return { message: `${parts.join(". ")}.` };
}

/** Deletes one object the route has confirmed, refusing a static key or anything cited. */
export async function deleteMedia(env: Env, key: string): Promise<Message> {
  // Refused in the action, not by hiding a button: a deleted row would return on the next rebuild.
  if (storageOf(key) === "static") {
    return {
      message:
        `Delete refused: ${key} is a static asset, served from the repo rather than R2. ` +
        `Remove it with a commit that deletes the file, then rebuild the index.`,
    };
  }

  if (!isManagedKey(key)) return { message: "Not a managed media key." };

  // Server side on a fresh read: a post may have cited the object since the page rendered.
  const [resolution, refs] = await Promise.all([
    resolveCitations(env, [key]),
    mediaRefsFor(env, [key]),
  ]);

  // Fail closed: a failed scan is not "nothing cites it".
  if (!resolution.complete) {
    return {
      message: `Delete refused: the reference scan failed (${resolution.failed.join(", ")}), so it cannot be confirmed that nothing cites this object.`,
    };
  }

  // The refcount: content-addressed keys let posts share a blob, so any citation blocks the delete.
  const rows = refs.get(key) ?? [];
  const citations = resolution.citations.get(key) ?? [];
  if (rows.length > 0 || citations.length > 0) {
    const sources = new Set(rows.map((row) => `${row.sourceType}:${row.sourceId}`));
    const refNote =
      rows.length > 0
        ? ` The pipeline recorded ${rows.length} reference(s) across ${sources.size} item(s).`
        : "";
    return {
      message: `Delete refused. ${describeCitations(citations)}${refNote}`,
    };
  }

  /* One statement claims the row only if nothing cites it now. Row first: an orphan object backfills. */
  if (!(await claimMediaKeyForDelete(env, key))) {
    return {
      message: `Delete refused: ${key} was cited or removed while this delete was being checked. Reload and try again.`,
    };
  }

  await deleteMediaObject(env, key);
  return { message: `Deleted ${key} and its row. Nothing cited it.` };
}

function describeCitations(citations: MediaCitation[]) {
  const byItem = new Map<string, MediaCitation[]>();
  for (const citation of citations) {
    const list = byItem.get(citation.id);
    if (list) list.push(citation);
    else byItem.set(citation.id, [citation]);
  }
  const parts = [...byItem.entries()].map(([id, list]) => {
    const forms = [...new Set(list.map((c) => c.form))].join(", ");
    return `${list[0]?.title ?? ""} (${id}: ${forms}, ${list.map((c) => c.detail).join("; ")})`;
  });
  return `Still cited by ${parts.length} post${parts.length === 1 ? "" : "s"}: ${parts.join(" and ")}.`;
}
