// Three states, not two: post evidence cannot see an asset placed by route code, so without "in template"
// the roster photos read as orphans beside a delete button. "Unattached" is an ABSENCE of evidence, not
// "unused". A file both cited and referenced reports USED, the claim that can name a post.

export const USAGE_STATES = {
  used: {
    id: "used",
    label: "used",
    title: "Referenced by a post",
    note: "The usage tracker found this address in published content.",
  },
  template: {
    id: "template",
    label: "in template",
    title: "Placed by page code",
    note:
      "Found by scanning the repository, not the post index. A post-level " +
      "tracker will always report this file as unreferenced.",
  },
  unattached: {
    id: "unattached",
    label: "unattached",
    title: "No reference found",
    note:
      "Not found in posts or in repository code. Unattached is not the same as " +
      "unused: a file can still be linked from outside the site, and a path the " +
      "code builds at runtime is invisible to the scan. Verify before deleting.",
  },
};

export const USAGE_ORDER = ["used", "template", "unattached"];

/**
 * @param {{ postRefs: number, citations: number, templateRefs: number }} evidence
 * @returns {"used"|"template"|"unattached"}
 */
export function usageStateOf(evidence) {
  if (evidence.postRefs > 0 || evidence.citations > 0) return "used";
  if (evidence.templateRefs > 0) return "template";
  return "unattached";
}

/**
 * @param {string} state
 * @returns {{ id: string, label: string, title: string, note: string }}
 */
export function usageDescriptor(state) {
  return /** @type {Record<string, typeof USAGE_STATES.used>} */ (USAGE_STATES)[state]
    ?? USAGE_STATES.unattached;
}

/**
 * @param {string} state
 * @returns {number}
 */
export function usageRank(state) {
  const at = USAGE_ORDER.indexOf(state);
  return at < 0 ? USAGE_ORDER.length : at;
}

export const LARGE_FILE_BYTES = 1024 * 1024;

/**
 * `noAlt` applies to images only: a document takes no alt text.
 *
 *
 * @param {{ viewable: boolean, alt: string | null, size: number, twinCount: number }} row
 * @returns {Array<{ id: string, label: string }>}
 */
export function flagsFor(row) {
  /** @type {Array<{ id: string, label: string }>} */
  const out = [];
  if (row.twinCount > 0) out.push({ id: "duplicate", label: "duplicate" });
  if (row.viewable && !(row.alt ?? "").trim()) out.push({ id: "no-alt", label: "no alt" });
  if (row.size > LARGE_FILE_BYTES) out.push({ id: "large", label: "over 1 MB" });
  return out;
}

/**
 * One dot: on a 150px tile three is a rash. Ordered by what the reader can lose by not knowing.
 *
 *
 * @param {{ flags: Array<{ id: string, label: string }>, usage: string, twin: string | null }} row
 * @returns {{ id: string, title: string } | null}
 */
export function tileFlagFor(row) {
  /** @param {string} id */
  const has = (id) => row.flags.some((f) => f.id === id);
  if (has("duplicate")) {
    return { id: "duplicate", title: row.twin ? `Duplicate of ${row.twin}` : "Duplicate" };
  }
  if (row.usage === "unattached") return { id: "unattached", title: "No reference found" };
  if (has("no-alt")) return { id: "no-alt", title: "No alt text" };
  return null;
}

export const LENS_NOTES = {
  unattached:
    "No reference was found in posts or in repository code. That is not proof a " +
    "file is unused: check before deleting.",
  duplicates:
    "These files share a content hash with another file. Both addresses serve " +
    "the same bytes.",
  "no-alt":
    "Images published without alt text. Documents are not listed; they do not " +
    "take alt text.",
  large: "Large files slow the pages that embed them. Consider a smaller derivative.",
};

/**
 * @param {string} lens
 * @returns {string}
 */
export function lensNoteFor(lens) {
  return /** @type {Record<string, string>} */ (LENS_NOTES)[lens] ?? "";
}

/**
 * Offered, never applied: alt text nobody read is worse than a visibly empty field.
 *
 * @param {string} base a filename, no directory
 * @returns {string}
 */
export function suggestedAlt(base) {
  return base.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
}

/**
 * @param {string} key
 * @returns {string[]}
 */
export function suggestedTags(key) {
  const parts = key.split("/").filter(Boolean);
  /** @type {string[]} */
  const out = [];
  // A content-addressed key has no directory, and its first segment is a hash, not a label.
  const leading = parts[0];
  if (key.startsWith("/") && parts.length > 1 && leading) {
    out.push(leading.replace(/[-_]+/g, " "));
  }
  const year = key.match(/\b(20\d{2})\b/)?.[1];
  if (year) out.push(year);
  const term = key.match(/\b(spring|fall|summer|winter)\b/i)?.[1];
  if (term) out.push(term.toLowerCase());
  return [...new Set(out.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/**
 * An image goes in as `![alt](src)` and a document as `[title](href)`; an `<img>` for a PDF breaks the page.
 *
 * @param {{ url: string, viewable: boolean, alt: string | null, base: string }} row
 * @returns {Array<{ id: string, label: string, name: string, value: string }>}
 */
export function copySnippetsFor(row) {
  const alt = (row.alt ?? "").trim();
  const title = suggestedAlt(row.base);
  // `label` is what the button shows, `name` what a screen reader hears: the visible "Copy" group
  // heading supplies the verb only for sighted readers.
  if (row.viewable) {
    return [
      { id: "address", label: "Copy address", name: "Copy the address", value: row.url },
      { id: "markdown", label: "Markdown", name: "Copy the markdown image", value: `![${alt}](${row.url})` },
      { id: "html", label: "HTML tag", name: "Copy the HTML image tag", value: `<img src="${row.url}" alt="${alt}">` },
    ];
  }
  return [
    { id: "address", label: "Copy address", name: "Copy the address", value: row.url },
    { id: "markdown", label: "Markdown", name: "Copy the markdown link", value: `[${title}](${row.url})` },
    { id: "html", label: "HTML link", name: "Copy the HTML link", value: `<a href="${row.url}">${title}</a>` },
  ];
}
