/**
 * The editor's crash net.
 *
 * Ruling 5 of the redesign spec: save equals commit here, so autosaving to the
 * server would write git history every few seconds. The buffer is therefore
 * local and only local, and it is never the thing that publishes. Nothing in
 * this module touches the network.
 *
 * The key carries the BASE COMMIT the editor loaded against, and that is the
 * interesting part. A buffer written on top of commit A is not safely
 * restorable over content loaded from commit B: main moved, and the text the
 * author was editing may no longer be the text that is there. Rather than
 * offering a restore that would silently revert someone else's change, a buffer
 * from a different base simply does not match the key and is never offered.
 * The editor's own conflict rule refuses the save in that situation anyway, so
 * this keeps the two in step.
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
  // behaviour we want.
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

export function clearBuffer(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do. A buffer that cannot be cleared is offered again and
    // declined again, which is annoying rather than dangerous.
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
