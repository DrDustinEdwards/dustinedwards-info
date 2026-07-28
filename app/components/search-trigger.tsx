import { useEffect } from "react";
import { Link } from "react-router";

/**
 * The site-wide search entry point.
 *
 * WHAT SHIPS IS A LINK. Server-rendered, it is an anchor to /search and nothing
 * more, so a reader with scripting off gets working search by clicking it. The
 * palette chunk, when it loads, finds this element by its data attribute and
 * upgrades it into a button that opens the dialog. If the chunk never loads,
 * never finishes, or throws, the link is still a link.
 *
 * The chunk is separate from the blog enhancement bundle on purpose: this one
 * is site-wide and that one is blog-only, so merging them would make every
 * homepage visit pay for reading enhancements it will never use.
 *
 * A dynamic import rather than a `?url` import. Vite code-splits a dynamic
 * import into its own chunk; `?url` copies the file verbatim as an asset and
 * serves the browser raw TypeScript. Measured on this repo 2026-07-28.
 */
export function SearchTrigger() {
  useEffect(() => {
    void import("~/enhance/palette");
  }, []);

  return (
    <Link
      to="/search"
      className="search-trigger"
      data-search-trigger=""
      // The shortcut hint is hidden until the palette is live, because until
      // then pressing Ctrl+K does nothing and advertising it would be a lie.
      data-shortcut-hint="hidden"
    >
      <span className="search-trigger-label">Search</span>
      <kbd className="search-trigger-kbd" aria-hidden="true" hidden>
        /
      </kbd>
    </Link>
  );
}
