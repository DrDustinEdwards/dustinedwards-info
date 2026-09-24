// Imports nothing: blog-view.ts calls htmlHasMath on every post request, and importing katex here
// would put a 280 kB renderer in the blog route's server chunk.

/**
 * Shared by remarkMathValidate and rehype-katex: if they differed, an expression could pass validation
 * and still reach rehype-katex's error path. strict: "error" because KaTeX otherwise only warns, and
 * the symbol ships as a box. throwOnError is useless: rehype-katex 7.0.1 catches the throw and
 * re-renders a red error box with the build exiting 0, which is why remarkMathValidate exists.
 */
export const KATEX_OPTIONS = /** @type {const} */ ({
  output: "htmlAndMathml",
  strict: "error",
});

/**
 * Anchored on the attribute so prose or code blocks about KaTeX do not match.
 * @param {string | null | undefined} html
 */
export function htmlHasMath(html) {
  return typeof html === "string" && html.includes('class="katex"');
}
