/**
 * Media tags: normalisation, storage form, and the search clause's needle.
 *
 * PURE and `.mjs`, so the delimiter rule is executed by `node --test` rather
 * than trusted. That is not ceremony here. **This repo has already been bitten
 * by a delimiter choice in this exact table:** the two shipped media-ref writers
 * dedup with SPACE-joined keys while the tested helper uses NUL, so `("a|b","c")`
 * and `("a","b|c")` collide and silently drop a ref, unreachable today only
 * because `form` is a spaceless enum. A joined-string key with no rule about
 * what may appear inside a part is a defect waiting for its input.
 *
 * ## WHY A COLUMN AND NOT THE POSTS PATTERN
 *
 * Posts use `tags` plus `post_tags`, two tables and a join. Media does not, and
 * the basis is four differences rather than a preference:
 *
 *   1. **There is no public taxonomy.** A post tag has a slug, a display name, a
 *      count, and an archive page at `/blog?tag=`. A media tag is an admin
 *      organisational label with no page, no slug, and no reader. The join
 *      table's whole purpose is to make a tag a first-class ADDRESSABLE thing,
 *      and nothing addresses these.
 *   2. **Search decides it.** The library filter is one SQL `OR` chain over
 *      `original_name`, `key`, `alt` and `caption`, and tags must join it. As a
 *      column that is one more `LIKE` in the chain. As a join table it is a
 *      correlated subquery inside an OR, on the one query that also paginates,
 *      which is where this page has already been caught getting a total and a
 *      page from different predicates.
 *   3. **The row is DERIVED and rebuilt by reconciliation.** `alt` and `caption`
 *      are documented as the authored columns "recoverable from nothing", which
 *      is what makes a rebuild a merge instead of a truncate. Tags are the same
 *      kind of fact and belong in the same row, preserved by the same mechanism.
 *      A second table would need its own answer to what a rebuild does to it.
 *   4. **Scale.** 70 rows. Dedup, rename and counts are the join table's payoff
 *      and none of them is worth a table at this size.
 *
 * Recorded so a later session can overturn it on evidence rather than taste. The
 * thing that WOULD overturn it is a public media tag page, because that needs a
 * canonical row per tag and this shape has none.
 *
 * ## THE STORAGE FORM, AND THE ONE RULE THAT MAKES IT SAFE
 *
 * Stored DELIMITER-WRAPPED: `,alpha,beta,` rather than `alpha,beta`. The leading
 * and trailing commas are the entire reason an exact-tag match is possible with
 * `LIKE`:
 *
 *     exact tag "art"      LIKE '%,art,%'    matches ,art,  and not ,chart,
 *     free text  "art"     LIKE '%art%'      matches both, which is correct
 *                                            for a free-text box
 *
 * Without the wrapping, `LIKE '%art%'` is the only available match and an exact
 * filter for `art` would silently include `chart`. The empty list is stored as
 * the EMPTY STRING, not as `,`, so a row with no tags cannot match `%,%`.
 *
 * A comma is therefore forbidden inside a tag, and `normaliseTag` strips it
 * rather than rejecting the input: an admin typing a comma means a separator.
 */

/** The delimiter, stated once. Both the wrap and the split read it. */
export const TAG_DELIMITER = ",";

/** Longest a single tag may be. Keeps one pasted paragraph from becoming a tag. */
export const MAX_TAG_LENGTH = 32;

/** Most tags one asset may carry. A label set, not a description. */
export const MAX_TAGS = 12;

/**
 * One tag, normalised. Lowercase, trimmed, inner whitespace collapsed to a
 * single hyphen, delimiter removed, length capped.
 *
 * Returns "" for anything that normalises to nothing, and the callers drop
 * those rather than storing an empty element that would produce `,,` and make
 * every `%,x,%` needle unreliable.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function normaliseTag(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .toLowerCase()
    // The delimiter cannot survive inside a part. Removed rather than rejected:
    // a human typing a comma means "next tag", and the splitter upstream has
    // already acted on that reading.
    .split(TAG_DELIMITER)
    .join(" ")
    .trim()
    .replace(/\s+/g, "-")
    // Anything that is not a word character or a hyphen is dropped, so a tag can
    // never carry a `%` or `_`, which are LIKE wildcards and would turn a stored
    // value into a pattern.
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-+$/, "");
}

/**
 * A list of tags, normalised, deduplicated, sorted, and capped.
 *
 * SORTED, so two authors who typed the same set in different orders produce the
 * same stored bytes. A column whose value depends on typing order would make
 * every diff and every equality check unreliable.
 *
 * @param {unknown} input an array, or a delimited string
 * @returns {string[]}
 */
export function normaliseTags(input) {
  const parts = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(TAG_DELIMITER)
      : [];
  const seen = new Set();
  for (const part of parts) {
    const tag = normaliseTag(part);
    if (tag) seen.add(tag);
  }
  return [...seen].sort().slice(0, MAX_TAGS);
}

/**
 * The value stored in the column: delimiter-wrapped, or empty.
 *
 * @param {unknown} input
 * @returns {string}
 */
export function serialiseTags(input) {
  const tags = normaliseTags(input);
  if (tags.length === 0) return "";
  return `${TAG_DELIMITER}${tags.join(TAG_DELIMITER)}${TAG_DELIMITER}`;
}

/**
 * The stored value read back as a list. Total: any garbage reads as [].
 *
 * @param {unknown} stored
 * @returns {string[]}
 */
export function parseTags(stored) {
  if (typeof stored !== "string" || stored === "") return [];
  return normaliseTags(stored);
}

/**
 * The `LIKE` needle that matches ONE tag exactly.
 *
 * Returns null when the tag normalises to nothing, and the caller must treat
 * null as "no filter" rather than as a needle: `%,,%` would match every tagged
 * row, which is the vacuous filter this repo keeps finding in other shapes.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function exactTagNeedle(raw) {
  const tag = normaliseTag(raw);
  if (!tag) return null;
  return `%${TAG_DELIMITER}${tag}${TAG_DELIMITER}%`;
}
