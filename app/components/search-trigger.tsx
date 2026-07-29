import { useEffect } from "react";
import { Link } from "react-router";

/**
 * The site-wide search entry point.
 *
 * WHAT SHIPS IS A LINK. Server-rendered, it is an anchor to /search carrying a
 * magnifying glass and an accessible name, so a reader with scripting off gets
 * working search by clicking it. The palette chunk, when it loads, finds it by
 * its data attribute and upgrades it into a control that opens the dialog. If
 * the chunk never loads, never finishes, or throws, the link is still a link.
 *
 * THE HINT IS A SIBLING, NOT A CHILD. It used to sit inside the anchor, which
 * made the "/" part of the link: it rendered as a second run of anchor text
 * pointing at /search, and clicking it navigated. A keyboard hint is not a
 * destination. It now sits outside the anchor, is aria-hidden, is not
 * focusable, and stays `hidden` until the palette is actually listening,
 * because until then pressing "/" does nothing and advertising it would be a
 * lie. That is also why it never appears in the no-JS state: the shortcut it
 * advertises exists only once the palette is live.
 *
 * NOT UNDERLINED, and that is rule 2 rather than an exception to it. Rule 2
 * reaches an anchor "whose only visual distinction from adjacent non-link text
 * is color". This anchor renders no text at all, so there is no adjacent text
 * it could be mistaken for and nothing for a colour cue to be carrying.
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
    <span className="search-trigger-wrap">
      <Link
        to="/search"
        className="search-trigger"
        data-search-trigger=""
        aria-label="Search"
      >
        {/* Inline SVG per the repo's bundle-leanness rule. aria-hidden because
            the anchor already carries its accessible name. */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </Link>
      <kbd className="search-trigger-kbd" data-search-hint="" aria-hidden="true" hidden>
        /
      </kbd>
    </span>
  );
}
