/**
 * The math half of the pipeline: the KaTeX options, and the one reader that
 * answers "does this rendered post carry math".
 *
 * ## DEPENDENCY-FREE, AND THAT IS THE WHOLE REASON IT IS A FILE
 *
 * `.mjs` and importing nothing, on the footing `records.mjs`, `query.mjs` and
 * `classify.mjs` stand on, with one extra constraint of its own: `blog-view.ts`
 * calls `htmlHasMath` on every post request, and `blog-view.ts` is imported by
 * the blog route. An `import katex` here would put a 280 kB renderer in that
 * route's server chunk so a one-line substring test could be asked.
 *
 * So the RENDERING side stays in `pipeline.mjs`, which already imports the
 * heavy things, and takes `KATEX_OPTIONS` from here. One owner for the options
 * object, no renderer on the read path.
 */

/**
 * THE KaTeX OPTIONS, in one place, because two callers must pass them.
 *
 * `remarkMathValidate` in `pipeline.mjs` renders with these to decide whether
 * the build fails, and `rehype-katex` renders with them to produce the markup.
 * If the two differed, an expression could pass validation and still reach
 * rehype-katex's error path, which is the exact hole the validator exists to
 * close. The vacuity rule's one-helper discipline, applied to an options object.
 *
 * `output: "htmlAndMathml"` is the ruled mode: the MathML tree carries the
 * meaning for a screen reader and the HTML tree carries the layout for a
 * sighted reader, and the stylesheet clips each away from the other audience.
 *
 * `strict: "error"` makes KaTeX throw on what it would otherwise only warn
 * about, a Unicode character outside its supported set being the realistic
 * case. Those warnings go to a console nobody is reading during a build, so the
 * real choice is between an error and silence, and silence is how a post ships
 * with a symbol that renders as a box.
 *
 * ## `throwOnError` IS DELIBERATELY ABSENT AND CANNOT BE SET HERE
 *
 * The obvious way to make a bad expression fail the build is
 * `rehypeKatex({ throwOnError: true })`, and it does nothing. READ IN THE
 * SHIPPED LIBRARY rather than assumed: `rehype-katex` 7.0.1 `Omit`s the option
 * from its type, sets it to `true` on its own `renderToString` call, CATCHES
 * what that throws, files a vfile message nothing in this pipeline reads, and
 * then renders a SECOND time with `strict: "ignore", throwOnError: false`. The
 * result is a red error box on the published page and a build that exits 0,
 * which is the silent-wrong-output class this repo forbids and which
 * `remarkUnknownDirectives` exists to prevent for directives.
 *
 * That is why `remarkMathValidate` exists as a separate pass, and why it must
 * render with THIS object rather than one of its own.
 */
export const KATEX_OPTIONS = /** @type {const} */ ({
  output: "htmlAndMathml",
  strict: "error",
});

/**
 * True when rendered post HTML carries math.
 *
 * THE HTML-SIDE READER, and the reason it exists rather than a stored column:
 * the route reads a D1 row, and that row's `html` is the only thing on it that
 * knows whether the post has math. A `has_math` column would be a second copy
 * of a fact the body already carries, and would cost a migration, a `schema.ts`
 * entry, a `test/schema-invariants.test.mjs` comparison and a sync path to keep it
 * true. This costs a substring test.
 *
 * The needle is `class="katex"`, the wrapper KaTeX puts around every expression
 * in both output modes, ANCHORED on the attribute so it cannot match the word
 * in prose or inside a highlighted code block about KaTeX. That anchoring is
 * load-bearing: this site publishes posts about its own build, so "a post that
 * mentions katex" is a real input rather than a hypothetical one.
 *
 * `check:content` asserts this agrees with the renderer's own AST flag for
 * every post in the corpus, so the two derivations argue rather than one being
 * trusted.
 *
 * @param {string | null | undefined} html
 */
export function htmlHasMath(html) {
  return typeof html === "string" && html.includes('class="katex"');
}
