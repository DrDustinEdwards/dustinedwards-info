/**
 * THE SLUG AND POST-PATH RULES, split out of `pipeline.mjs` so a module that needs a constant
 * does not evaluate the renderer. `pipeline.mjs` imports shiki, katex, Plot and linkedom at its
 * top level, and a static import of ANY name from it put all of that into the Worker chunk every
 * cold isolate evaluates, including isolates that only ever serve a cached page. `pipeline.mjs`
 * re-exports every name here, so the build scripts and gates that import from it are unchanged.
 */

/**
 * What a slug may be, as ONE statement of the rule.
 *
 * Exported because the operator API needs the same predicate on its READ paths,
 * and a hand-copied regex there would be a second statement of a rule that can
 * drift. The write path has always enforced this through the schema below; the
 * read paths interpolated an unvalidated slug straight into a GitHub API path,
 * where `encodeURI` leaves `..`, `/` and `?` intact. Found by the external
 * audit of 2026-08-11.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The longest a slug may be, in characters.
 *
 * **A SECOND RULE RATHER THAN A LONGER PATTERN, deliberately.** A length bound
 * inside `SLUG_PATTERN` would need a lookahead carrying its own end anchor,
 * and `SLUG_ATTRIBUTE_PATTERN` below builds the HTML `pattern` attribute by
 * stripping the anchors off this source. It would strip the wrong one. Two
 * constants, each with one owner, applied wherever the shape rule is applied.
 *
 * ## WHY 120, AND WHY IT IS NOT THIS REPOSITORY'S NUMBER ALONE
 *
 * The MCP wrapper's `slugSchema` (`DrDustinEdwards/dustinedwards-mcp`,
 * `src/tools.ts`) has been `.min(1).max(120).regex(...)` since it was
 * written, and this side had no cap at all. Measured in the pre-cutover audit
 * 2026-09-11 (P2-02b): the admin UI could save a post whose slug the operator
 * tools could not name, so `get_post` and `save_post` would refuse at the
 * wrapper's schema before any request went out, and the only surface left that
 * could touch the post would be the one that created it.
 *
 * The site moved to the wrapper's number rather than the other way round,
 * because 120 is already the smaller bound and shrinking a surface nothing has
 * used is cheaper to reason about than widening a published one.
 *
 * NO GATE HERE CAN SEE THE WRAPPER'S COPY: it is a different repository with a
 * different build, and a restatement of its regex in a test would be a test of
 * the restatement. What `test/slug-length.test.mjs` does instead is pin THIS
 * side exactly at the boundary in both directions, so the cap cannot be
 * widened, narrowed or dropped without a failing test naming the number.
 */
export const SLUG_MAX_LENGTH = 120;

/**
 * The same rule in the shape an HTML `pattern` attribute takes.
 *
 * The attribute ANCHORS IMPLICITLY: the browser compiles it as `^(?:...)$`,
 * so the anchors in `SLUG_PATTERN.source` have to come off rather than being
 * handed over with the rest.
 *
 * ## WHY THIS IS A CONSTANT AND NOT AN EXPRESSION AT THE INPUT
 *
 * It WAS an expression at the input, for about an hour, and it was wrong. The
 * strip was written as a regex whose two anchor characters each needed a
 * backslash, and neither backslash survived the tool that wrote the file. What
 * reached disk was an alternation of two BARE anchors, which are zero-width, so
 * it replaced the empty string with the empty string: a no-op that shipped the
 * anchors it was written to remove.
 *
 * Nothing caught it. It typechecked, and the anchors are harmless inside the
 * browser's own anchoring, so the attribute still validated the same strings
 * and no gate and no render could tell the difference. What WAS false was the
 * comment directly above it, which said the anchors had been stripped.
 *
 * So the strip lives here, with no regex in it at all, and `check:tests`
 * drives it. A derivation that cannot be written wrong is better than one a
 * gate has to watch.
 */
export const SLUG_ATTRIBUTE_PATTERN = unanchor(SLUG_PATTERN.source);

/**
 * A regex source with its start and end anchors removed, if it had them.
 *
 * String methods on purpose: see above. This function is the reason the
 * defect it replaces cannot recur in it.
 *
 * @param {string} source
 * @returns {string}
 */
function unanchor(source) {
  let out = source.startsWith("^") ? source.slice(1) : source;
  if (out.endsWith("$")) out = out.slice(0, -1);
  return out;
}

/**
 * WHERE A POST LIVES IN THE REPOSITORY. Stated once, here.
 *
 * The URL allowlist rule says this string is stated ONCE, by the exported `postPath()`.
 * It was not: this module built the same path independently at `sourcePath`
 * below while `publish.server.ts` exported the canonical one, so the rule was
 * true of every consumer except the module that produces the artifact.
 *
 * It lives HERE rather than in `publish.server.ts` because this module cannot
 * import a `.server` file without dragging the server boundary into the build
 * scripts. Same neighborhood as `SLUG_PATTERN` on purpose, which is the same
 * class of rule and was consolidated for the same reason.
 *
 * @param {string} slug
 * @returns {string}
 */
export const postPath = (slug) => `content/posts/${slug}.md`;
