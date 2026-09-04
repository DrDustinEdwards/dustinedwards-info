/**
 * The slug a duplicated post takes.
 *
 * Section F item 3: duplicate as template. The copy goes through `savePost` as
 * a NEW post, so it needs a slug nothing else is using, and the caller is the
 * only thing that can answer whether a candidate is free. So this produces the
 * ORDERED CANDIDATES and stays pure; the route walks them and stops at the
 * first with no committed file.
 *
 * ## WHY CANDIDATES RATHER THAN A LOOKUP CALLBACK
 *
 * A function taking an async `exists` would be the tidier signature and would
 * be untestable without a fake repository. This shape is a string in and an
 * array out, so `test/editor-duplicate.test.mjs` asserts the naming rule
 * directly and the route's job shrinks to "read files until one is missing".
 *
 * ## THE COPY-OF-A-COPY RULE, and it is the only interesting decision here
 *
 * A naive `${slug}-copy` turns `a-post-copy` into `a-post-copy-copy` and then
 * into `a-post-copy-copy-copy`, which is a slug nobody would type and a URL
 * nobody would want if the copy is ever published. The suffix is STRIPPED
 * first, so duplicating a duplicate produces `a-post-copy-2`, and the family
 * stays flat however many times the author presses the button.
 *
 * Every candidate satisfies `SLUG_PATTERN` by construction when the input does:
 * the base is a valid slug, and `-copy` and `-copy-<digits>` are valid
 * segments. Asserted in the test against the exported pattern rather than
 * argued for here, because rule 6 makes the pattern the owner of that fact.
 */

/**
 * The base a copy is named from: the input, with any `-copy` or `-copy-<n>`
 * suffix this module itself would have added taken back off.
 *
 * Anchored at the END and requiring the whole suffix, so a post legitimately
 * called `how-to-copy` keeps its name: `-copy` there is not preceded by the
 * hyphen boundary this needs plus... it IS `-copy` at the end, and that is the
 * accepted collision. Duplicating `how-to-copy` yields `how-to-copy-2` rather
 * than `how-to-copy-copy`, which is a worse name for nobody and a better one
 * for the common case. Recorded rather than hidden: the rule is textual and
 * cannot read intent.
 *
 * @param {string} slug
 * @returns {string}
 */
function baseOf(slug) {
  const stripped = slug.replace(/-copy(?:-\d+)?$/, "");
  // A slug that is nothing BUT the suffix (`copy`, or `-copy` normalised away
  // to the empty string) would produce candidates starting with a hyphen, which
  // no slug pattern accepts. The input stands in that case.
  return stripped === "" ? slug : stripped;
}

/**
 * The candidate slugs for a duplicate of `slug`, best first.
 *
 * @param {string} slug the post being duplicated
 * @param {number} [limit] how many candidates to offer
 * @returns {string[]}
 */
export function copySlugCandidates(slug, limit = 20) {
  const base = baseOf(slug);
  /** @type {string[]} */
  const out = [`${base}-copy`];
  // Starts at 2 because the unnumbered candidate above IS the first copy, so a
  // `-copy-1` would be a second name for the same position.
  for (let n = 2; out.length < limit; n += 1) out.push(`${base}-copy-${n}`);
  return out;
}
