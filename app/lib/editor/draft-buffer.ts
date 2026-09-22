/**
 * The editor's crash net.
 *
 * Save equals commit here, so autosaving to the server would write git history every few seconds.
 * The buffer is LOCAL AND ONLY LOCAL, never the thing that publishes, and nothing here touches the
 * network.
 *
 * The key carries the BASE COMMIT the editor loaded against, because a buffer written on top of
 * commit A is not safely restorable over content loaded from commit B. Rather than offer a restore
 * that would silently revert someone else's change, a buffer from a different base never matches the
 * key.
 */

export type DraftBuffer = {
  /** ISO timestamp of the last local write. */
  at: string;
  /** Everything the form held, minus the fields the server owns. */
  fields: Record<string, string>;
};

/**
 * Fields that are never restored, because they describe the SESSION rather than
 * the author's work. Restoring a stale `headSha` would hand the save path a
 * precondition from a page load that is over.
 */
const NOT_AUTHORED = new Set(["headSha", "isNew", "firstPublished", "intent"]);

export function draftKey(slug: string, headSha: string) {
  // A new post has no base commit of its own, so it keys on the repo head it
  // was started from. That still changes when main moves, which is the
  // behavior we want.
  return `post-draft:${slug || "new"}:${headSha || "detached"}`;
}

/** Everything the form currently holds, as the buffer stores it. */
export function readForm(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string" && !NOT_AUTHORED.has(key)) out[key] = value;
  }
  return out;
}

export function writeBuffer(key: string, fields: Record<string, string>): string | null {
  try {
    const at = new Date().toISOString();
    window.localStorage.setItem(key, JSON.stringify({ at, fields } satisfies DraftBuffer));
    return at;
  } catch {
    // Private mode, quota, or storage disabled. The editor still works; it just
    // has no crash net, and saying so is better than pretending.
    return null;
  }
}

export function readBuffer(key: string): DraftBuffer | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftBuffer;
    return parsed && typeof parsed.at === "string" && parsed.fields ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Drops every buffer for a slug regardless of base commit.
 *
 * Used after a successful save, where the point is that the author's work is
 * now committed and no buffer for that post is worth keeping, including ones
 * written against earlier heads that would otherwise sit in storage forever.
 */
export function clearAllBuffersFor(slug: string) {
  try {
    const prefix = `post-draft:${slug || "new"}:`;
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

/**
 * Removes buffers written under the pre-Session-2 key scheme, `post-draft:<slug>` and
 * `post-draft:new`, which carried no base commit. A legacy key can never match a lookup and is never
 * offered, so it is dead storage rather than a hazard.
 *
 * A slug is kebab-case and cannot contain a colon, so the two schemes are told apart by counting
 * segments: three means current, two means legacy.
 */
export function purgeLegacyBuffers() {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("post-draft:")) continue;
      if (key.split(":").length === 2) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
    return doomed.length;
  } catch {
    return 0;
  }
}

/**
 * Whether a stored buffer is worth offering.
 *
 * "Newer than the loaded content" in practice means "says something different
 * from what the server just handed us". A buffer that matches the committed
 * file is not a recovery, it is noise, and offering it would train the author
 * to dismiss the banner without reading it.
 */
export function bufferDiffers(
  buffer: DraftBuffer,
  current: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(buffer.fields), ...Object.keys(current)]);
  for (const key of keys) {
    if ((buffer.fields[key] ?? "") !== (current[key] ?? "")) return true;
  }
  return false;
}
