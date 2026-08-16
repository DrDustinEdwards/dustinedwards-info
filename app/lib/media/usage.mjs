/**
 * THE THREE-STATE USAGE MODEL, which is the design's whole argument.
 *
 * PURE and `.mjs`: the loader, the gate and the tests all read one definition.
 *
 * ## WHY THREE AND NOT TWO
 *
 * The page shipped with two states, cited and uncited, and the uncited one was a
 * lie by omission. `media_refs` records what a post's RENDERER emitted;
 * `resolveCitations` scans the posts artifact for a literal URL. Both answer the
 * same question, "does a POST use this", and neither can see an asset placed by
 * ROUTE CODE. So the nine cohort photographs on the roster page, which the site
 * serves on every visit, read as unreferenced, on a page with a delete button.
 *
 * A binary that cannot express "the site places this, no post cites it" forces
 * every such file into the same bucket as a genuine orphan. The third state is
 * not a nicety; it is the difference between a true statement and a false one.
 *
 * ## THE THREE, AND WHAT EACH ONE IS EVIDENCE OF
 *
 *   USED         a post cites it. Evidence: `media_refs` rows written by the
 *                publish pipeline, or a literal URL found in the posts
 *                artifact. Precise and conservative respectively; the union is
 *                what fails closed.
 *
 *   IN TEMPLATE  repository source references it. Evidence:
 *                `content/generated/template-refs.json`, built by scanning
 *                `app/` and `workers/` for the literal path. This is the state
 *                that did not exist.
 *
 *   UNATTACHED   neither found anything. **This is an ABSENCE OF EVIDENCE and
 *                the copy says so.** It is not "unused": a constructed path is
 *                invisible to the scan, and an external site can link anything.
 *
 * ## PRECEDENCE, AND WHY USED WINS
 *
 * A file can be both cited by a post and referenced by source. It reports USED,
 * because that is the stronger and more specific claim: it names a post the
 * reader can open. Reporting the weaker one would hide the useful half.
 */

/**
 * The three states, with everything the UI needs to render one.
 *
 * **THE COLOURS ARE NOT THE MOCKUP'S.** Its dots are #6E8F62, #4F2D7F and
 * #CE7F44 as literals, and its muted label colour #A79C8A measures 2.34:1. This
 * table names TOKENS instead, resolved by the stylesheet, so a dot cannot
 * disagree with the palette and the participation assertion can see them.
 *
 * The `title` and `note` are the mockup's own words, kept, because they are the
 * part that does the work: a dot with no sentence beside it is a colour.
 */
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

/** In the order the Usage sort puts them: most attached first. */
export const USAGE_ORDER = ["used", "template", "unattached"];

/**
 * Which state one asset is in.
 *
 * TOTAL, and deliberately takes counts rather than the collections themselves,
 * so the caller does the joining once for a page of rows instead of this
 * function reaching into three data structures per call.
 *
 * @param {{ postRefs: number, citations: number, templateRefs: number }} evidence
 * @returns {"used"|"template"|"unattached"}
 */
export function usageStateOf(evidence) {
  // USED WINS, per the precedence note above: it is the stronger claim and the
  // only one that can name a post.
  if (evidence.postRefs > 0 || evidence.citations > 0) return "used";
  if (evidence.templateRefs > 0) return "template";
  return "unattached";
}

/**
 * The full descriptor for a state, for a component that should not be looking
 * anything up itself.
 *
 * @param {string} state
 * @returns {{ id: string, label: string, title: string, note: string }}
 */
export function usageDescriptor(state) {
  return /** @type {Record<string, typeof USAGE_STATES.used>} */ (USAGE_STATES)[state]
    ?? USAGE_STATES.unattached;
}

/**
 * Sort rank, so the Usage column orders by how attached a file is.
 *
 * @param {string} state
 * @returns {number}
 */
export function usageRank(state) {
  const at = USAGE_ORDER.indexOf(state);
  return at < 0 ? USAGE_ORDER.length : at;
}

/** A file over this many bytes is flagged large. One mebibyte, as the mockup. */
export const LARGE_FILE_BYTES = 1024 * 1024;

/**
 * THE PER-ROW FLAGS, in the mockup's own order.
 *
 * These are QUALITY observations, not states: a file can carry all three at
 * once, which is why they are a list rather than an enum. The list is also what
 * the list view prints in its Usage column and what the tile's corner dot picks
 * its most urgent member from.
 *
 * `noAlt` applies to IMAGES ONLY. A document does not take alt text, so
 * flagging one would invent an obligation and put a permanent warning on 31 of
 * 70 rows. The lens note says this in words.
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
 * The single flag a grid tile shows in its corner, or null.
 *
 * ONE DOT, because a tile is 150px and three dots on it is a rash rather than a
 * signal. The mockup's precedence is kept exactly: duplicate, then unattached,
 * then no alt. It is ordered by how much the reader can lose by not knowing:
 * a duplicate wastes storage, an unattached file might be deleted by mistake,
 * a missing alt is a defect but not a risk.
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

/**
 * THE LENS NOTES, which explain what a narrowed view is actually claiming.
 *
 * The mockup's words, with one correction that matters. Its `unattached` note
 * says "no reference was found in posts or in repository code", which is true
 * here BECAUSE the repository scan now exists; before this session it would
 * have been a false claim about a check nothing ran. The sentence and the scan
 * ship together or neither ships.
 */
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
 * SUGGESTED ALT TEXT, from the filename, offered and never applied.
 *
 * A filename is a weak description and this is honest about that: it is a
 * SUGGESTION with a button, so the author accepts it deliberately. Writing it
 * automatically would fill the corpus with alt text nobody read, which is worse
 * than an empty field because an empty field is visibly a defect.
 *
 * Same transform as the document card's title, deliberately: the reader has
 * already seen `edwards 2024 phage genomics` on the tile, so the suggestion
 * matches what they are looking at rather than introducing a second spelling.
 *
 * @param {string} base a filename, no directory
 * @returns {string}
 */
export function suggestedAlt(base) {
  return base.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
}

/**
 * SUGGESTED TAGS, from the path.
 *
 * The mockup's rule, kept: the leading directory, any four-digit year, and a
 * season word. These are the three things a path in this library actually
 * encodes, and each one is a label somebody would otherwise type by hand.
 *
 * Deduplicated and lowercased, because the tag store is case-insensitive and
 * offering `2019` twice is not two suggestions.
 *
 * @param {string} key
 * @returns {string[]}
 */
export function suggestedTags(key) {
  const parts = key.split("/").filter(Boolean);
  /** @type {string[]} */
  const out = [];
  // The leading directory, but only for a real path. A content-addressed key
  // has no directory, and its first segment is a hash, which is not a label.
  if (key.startsWith("/") && parts.length > 1) out.push(parts[0].replace(/[-_]+/g, " "));
  const year = key.match(/\b(20\d{2})\b/);
  if (year) out.push(year[1]);
  const term = key.match(/\b(spring|fall|summer|winter)\b/i);
  if (term) out.push(term[1].toLowerCase());
  return [...new Set(out.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/**
 * THE COPY SNIPPETS, whose LABELS AND CONTENT both depend on what the file is.
 *
 * The mockup makes this distinction and it is a real one: an image goes in a
 * post as `![alt](src)` and a document goes in as `[title](href)`, so a control
 * labelled HTML has to produce a different thing for each. Offering an `<img>`
 * tag for a PDF produces a broken page, and the label is what stops somebody
 * pressing it.
 *
 * The alt text rides along in the image forms, because a snippet with an empty
 * alt is a snippet somebody ships with an empty alt.
 *
 * @param {{ url: string, viewable: boolean, alt: string | null, base: string }} row
 * @returns {Array<{ id: string, label: string, value: string }>}
 */
export function copySnippetsFor(row) {
  const alt = (row.alt ?? "").trim();
  const title = suggestedAlt(row.base);
  if (row.viewable) {
    return [
      { id: "address", label: "Copy address", value: row.url },
      { id: "markdown", label: "Markdown", value: `![${alt}](${row.url})` },
      { id: "html", label: "HTML tag", value: `<img src="${row.url}" alt="${alt}">` },
    ];
  }
  return [
    { id: "address", label: "Copy address", value: row.url },
    { id: "markdown", label: "Markdown", value: `[${title}](${row.url})` },
    { id: "html", label: "HTML link", value: `<a href="${row.url}">${title}</a>` },
  ];
}
