/**
 * The dedup key for one media ref: media key, form, detail.
 *
 * Lives here rather than inline in `app/db/index.ts` for the reason
 * `blog-listing.mjs`, `records.mjs` and `ask-keys.mjs` do: it is pure derived
 * logic, and a plain `.mjs` with no imports can be loaded by the Worker AND by
 * a Node test. `app/db/index.ts` pulls in drizzle and several extensionless TS
 * imports, so nothing in it is reachable from `node:test` without a bundler.
 *
 * ## THE SEPARATOR IS THE WHOLE CORRECTNESS ARGUMENT
 *
 * `mediaRefStatements` deduplicates before a batch insert, because the
 * primary key is (media_key, source_type, source_id, form, detail) and
 * inserting the same tuple twice fails the ENTIRE batch rather than merging.
 *
 * NUL is the separator because it cannot occur in a media key, a form or a
 * detail, so the three-part join is unambiguous. **A printable separator would
 * COLLIDE:** under `|`, the refs `("a|b", "c")` and `("a", "b|c")` produce the
 * same key, so the second is dropped as a duplicate and a post citing two
 * different images silently records one. Covered in `test/media-ref-key.test.mjs`.
 *
 * ## WRITTEN AS AN ESCAPE, NOT A LITERAL BYTE
 *
 * The literal NUL made `app/db/index.ts` binary to git and to ripgrep from
 * 2026-08-02 to 2026-08-09: diffs rendered as `Bin n -> m` so changes rode in
 * unreviewed, and a directory-scoped search skipped the entire database layer.
 * The gates were never affected, because they read with Node's `readFileSync`,
 * which is NUL-transparent; the blindness was in review and search only.
 *
 * The second reason is worse than the tooling one. A literal NUL is invisible
 * in every editor, so the expression read as `${mediaKey}${form}`: a key with
 * NO separator at all. The escape makes the separator visible and the docblock
 * makes it survivable.
 *
 * @param {{ mediaKey: string, form: string, detail: string | null }} ref
 * @returns {string}
 */
export function mediaRefKey(ref) {
  return `${ref.mediaKey}\u0000${ref.form}\u0000${ref.detail ?? ""}`;
}
