// Local only: save equals commit, so a server autosave would write git history every few seconds.
// The key carries the base commit so a buffer written over commit A is never restored over B.

export type DraftBuffer = {
  at: string;
  fields: Record<string, string>;
};

/** Session fields, never restored: a stale headSha would be a precondition from a page load that is over. */
const NOT_AUTHORED = new Set(["headSha", "isNew", "firstPublished", "intent"]);

export function draftKey(slug: string, headSha: string) {
  return `post-draft:${slug || "new"}:${headSha || "detached"}`;
}

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
    // Private mode, quota, or storage disabled: the editor works without a crash net.
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
    // Storage unavailable: nothing to clear.
  }
}

/** A slug cannot contain a colon, so a two-segment key is the legacy scheme that carried no base commit. */
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

/** A buffer matching the committed file is noise, and offering it would train the author to dismiss the banner. */
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
