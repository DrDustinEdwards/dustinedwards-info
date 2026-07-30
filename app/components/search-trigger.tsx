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
 * THE HINT IS INSIDE THE CONTROL. It sat beside the anchor for a while, as its
 * own bordered box, because inside it the "/" had been a second run of link
 * text and clicking it navigated. Beside it, though, it read as a stray
 * character parked next to the icon. It is back inside, but now the anchor is
 * a single bordered control that the icon and the hint sit within, so the "/"
 * is part of the control rather than a second thing next to it, and a click on
 * it is a click on the control it labels. One border, one hover state, one
 * focus ring, one hit area.
 *
 * It is aria-hidden and not focusable, and it stays `hidden` until the palette
 * is actually listening, because until then pressing "/" does nothing and
 * advertising it would be a lie. That is also why it never appears in the no-JS
 * state: the shortcut it advertises exists only once the palette is live.
 *
 * NOT UNDERLINED, and that is still rule 2 rather than an exception to it. The
 * old ground was that the anchor rendered no text; it renders a "/" now, so it
 * takes the ordinary exemption instead, the one .search-chip and .btn take:
 * it carries a border, which is a non-colour affordance.
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
    <Link to="/search" className="search-trigger" data-search-trigger="" aria-label="Search">
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
      <kbd className="search-trigger-kbd" data-search-hint="" aria-hidden="true" hidden>
        /
      </kbd>
    </Link>
  );
}
