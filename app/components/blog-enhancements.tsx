import { useEffect } from "react";

/**
 * Loads the blog reading enhancements, client side only.
 *
 * A dynamic import rather than a script tag: Vite then compiles and code-splits
 * the module into its own chunk, fetched only when a blog route renders. A
 * `?url` import does not do this. It copies the file verbatim as an asset, so
 * the browser is served raw TypeScript. Measured 2026-07-28, which is why this
 * component exists.
 *
 * Nothing renders. A reader with JavaScript disabled never fetches the chunk and
 * loses nothing but decoration.
 */
export function BlogEnhancements() {
  useEffect(() => {
    void import("~/enhance/blog");
  }, []);
  return null;
}
