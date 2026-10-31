// Front matter edits for every kind Carrel writes, on site-api's frontmatter module (`@dustinedwards/site-api/
// frontmatter`), which replaces one top-level key's block and returns every other block byte for byte: a status change
// must leave the keys the site does not know as they were.

import { RefusedError, type ContentStatus } from "@dustinedwards/site-api";
import { joinSource, readKey, setBlock, setRawKey, splitSource } from "@dustinedwards/site-api/frontmatter";

import { readState } from "~/lib/editor/publish-policy.mjs";

/** One top-level key of a source's front matter as text, "" when it has none. */
export const frontKey = (raw: string, key: string) => readKey(splitSource(raw).front, key);

/** A post's effective publication time, as the pipeline computes it: publish_at, else the date. */
export function effectivePublishAt(raw: string): number {
  return Date.parse(frontKey(raw, "publish_at").trim() || `${frontKey(raw, "date")}T00:00:00.000Z`);
}

/** Draft, scheduled or published, from the file itself, which is the only authority on status. */
export function statusOf(raw: string, now = Date.now()): ContentStatus {
  if (readState(raw).draft) return "draft";
  const at = frontKey(raw, "publish_at").trim();
  return at && Date.parse(at) > now ? "scheduled" : "published";
}

/** The source with its front matter edited; a source with none is refused, since its status cannot be set. */
export function editFront(raw: string, edit: (front: string) => string) {
  const split = splitSource(raw);
  if (split.front === null) throw new RefusedError("The source has no frontmatter block, so its status cannot be set.");
  return joinSource({ ...split, front: edit(split.front) });
}

/** Sets `draft`, and `publish_at` when given (null removes it), as JSON-quoted text. */
export function withPublication(raw: string, change: { draft: boolean; publishAt?: string | null }) {
  return editFront(raw, (front) => {
    let out = setRawKey(front, "draft", change.draft ? "true" : "false");
    if (change.publishAt === null) out = setBlock(out, "publish_at", []);
    else if (change.publishAt !== undefined) out = setRawKey(out, "publish_at", JSON.stringify(change.publishAt));
    return out;
  });
}

/** This site's older front matter keys and site-api's post fields (v0.17.0) that replace them. */
const LEGACY_POST_KEYS = [
  ["description", "excerpt"],
  ["part", "seriesPart"],
] as const;

/**
 * A post's source under site-api's post field keys: `description` becomes `excerpt` and `part` becomes `seriesPart`,
 * the value lines as they were. A file holding both keeps the package's. The pipeline reads either spelling, so every
 * stored file and revision still renders; Carrel reads and writes only these (`postFieldsOf`, `setPostFields`).
 */
export function withPostFieldKeys(raw: string) {
  const split = splitSource(raw);
  if (split.front === null) return raw;
  let front = split.front;
  for (const [legacy, key] of LEGACY_POST_KEYS) {
    if (!new RegExp(`^${legacy}:`, "m").test(front)) continue;
    front = new RegExp(`^${key}:`, "m").test(front)
      ? setBlock(front, legacy, [])
      : front.replace(new RegExp(`^${legacy}:`, "m"), `${key}:`);
  }
  return front === split.front ? raw : joinSource({ ...split, front });
}

/** A rename's file: the same source under its new slug. */
export const withSlug = (raw: string, slug: string) => editFront(raw, (front) => setRawKey(front, "slug", slug));

/**
 * A publish under a date of Carrel's choosing (site-api v0.17.0 `publishedAt`): the post's `date` is that day and its
 * `publish_at` that moment, which together are the publication time every page reads (effectivePublishAt).
 */
export const withPublishedAt = (raw: string, at: string) =>
  editFront(raw, (front) => setRawKey(setRawKey(front, "date", at.slice(0, 10)), "publish_at", JSON.stringify(at)));

/**
 * What a preview renders: the source with the keys a post cannot render without filled in where they are absent or
 * empty, so a draft with no front matter or no title previews as "Untitled" (site-api's conformance sends a bare
 * `# heading`). Only the preview does this; a save still refuses a post with no title.
 */
export function forPreview(raw: string, slug: string, today = new Date().toISOString().slice(0, 10)) {
  const split = splitSource(withPostFieldKeys(raw));
  let front = split.front ?? "draft: true";
  const fill = (key: string, value: string) => {
    if (!readKey(front, key).trim()) front = setRawKey(front, key, value);
  };
  fill("title", "Untitled");
  fill("slug", slug);
  fill("date", today);
  fill("excerpt", "Untitled");
  return split.front === null
    ? `---\n${front}\n---\n${raw}`
    : joinSource({ ...split, front });
}
