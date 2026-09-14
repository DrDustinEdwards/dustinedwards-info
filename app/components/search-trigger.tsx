import { Link } from "react-router";

import paletteEnhanceUrl from "~/enhance/dist/palette.js?url";
import paletteDialogCss from "~/styles/palette-dialog.css?url";
import askCss from "~/styles/ask.css?url";

/**
 * The site-wide search entry point.
 *
 * WHAT SHIPS IS A LINK. Server-rendered, it is an anchor to /search carrying a
 * magnifying glass and an accessible name, so a reader with scripting off gets
 * working search by clicking it. The palette chunk, when it loads, finds it by
 * its data attribute and upgrades it into a control that opens the dialog. If
 * the chunk never loads, never finishes, or throws, the link is still a link.
 *
 * ## THE HINT IS NO LONGER PAINTED, ordered by Dustin on aesthetics 2026-08-29
 *
 * A visible `<kbd>/</kbd>` sat inside this control. It had already moved twice,
 * from beside the anchor to inside it, chasing a shape that did not read as a
 * stray character parked next to an icon. The ruling is that it should not be
 * painted at all: the header carries less chrome without it, and the control
 * is a plain icon again.
 *
 * **THE SHORTCUT IS Cmd/Ctrl-K, AND THE BARE SLASH IS GONE.** This paragraph
 * said "still binds / and Cmd-K, and pressing / still opens the palette" until
 * 2026-09-14; the slash was retired in the Part A review for colliding with
 * find-in-page and the sentence was not moved with it. MEASURED on the wire the
 * day it was corrected: "/" did not open the palette and Ctrl-K did. Where a
 * reader LEARNS the chord is two places that cost no
 * pixels: the `title`, which a pointer user gets on hover, and an
 * `aria-describedby` region, which a screen reader announces after the control's
 * name. Both are discoverable and neither draws a box in the header.
 *
 * **THE HONESTY CONTRACT SURVIVES THE MOVE, and it had to.** The old badge was
 * server-rendered `hidden` and unhidden by the script, so a reader without
 * script was never told about a shortcut that does not exist for them. The
 * description keeps exactly that property by the same mechanism: it ships
 * `hidden` and `theme.ts` unhides it, so the promise is still made only once
 * the listener is attached. The `title` is set by the same script for the same
 * reason, and the server renders none.
 *
 * NOT UNDERLINED, and the ground moves BACK with the badge. It renders no text
 * again, which was the original exemption; it also still carries a border, so
 * it would take the ordinary .search-chip exemption either way. Rule 2 is
 * satisfied twice over rather than by a technicality.
 *
 * The bundle is separate from the blog enhancement bundle on purpose: this one
 * is site-wide and that one is blog-only, so merging them would make every
 * homepage visit pay for reading enhancements it will never use.
 *
 * ## NO SCRIPT TAG HERE SINCE 2026-08-27. THE ATTRIBUTE IS THE WHOLE CHANGE.
 *
 * This rendered a nonced `<script type="module">` for the palette bundle, so
 * every document on the site downloaded and parsed a search dialog in order to
 * offer a keyboard shortcut. The bundle is the largest thing on the public
 * plane and almost nobody opens it.
 *
 * What ships now is `data-palette`, carrying the same hashed URL the script tag
 * carried. `app/enhance/theme.ts` is on every page already, holds the "/" key,
 * the Cmd-K chord and this element's click, and imports that URL the first time
 * one of them fires. The bundle must still be PREBUILT for the same reason it
 * always was: `?url` copies the file verbatim with no compilation, so pointed at
 * the .ts source it serves the browser raw TypeScript (measured 2026-07-28).
 *
 * The attribute goes on the trigger rather than on the document, so the element
 * that needs the palette is the element that names it, and a page without this
 * component simply has no palette instead of a broken one.
 */
/**
 * The id `aria-describedby` points at. One statement, two attributes.
 *
 * A literal written twice is a description that silently stops being announced
 * the day one of them is edited, which is a failure nothing paints and nobody
 * sees. `check:browser` asserts the association resolves.
 */
const HINT_ID = "search-shortcut-hint";

export function SearchTrigger() {
  return (
    <>
      <Link
        to="/search"
        className="search-trigger"
        data-search-trigger=""
        data-palette={paletteEnhanceUrl}
        data-palette-css={`${paletteDialogCss},${askCss}`}
        aria-label="Search"
        aria-describedby={HINT_ID}
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
      {/*
        THE DESCRIPTION, NOT A BADGE. `.sr-only` rather than `hidden` would be
        wrong twice over: it would announce a shortcut to a scriptless reader
        who does not have one, and `hidden` is what lets `theme.ts` reveal it on
        exactly the signal the badge used to wait for.

        OUTSIDE the anchor, deliberately. An `aria-describedby` target may sit
        anywhere in the document, and putting it inside would make it part of
        the link's own content, which is what made the old badge a second run of
        link text.
      */}
      {/*
        A PLACEHOLDER, NOT THE HINT. This read "Press slash to search" until
        2026-09-14. The bare slash was retired in efc0dab the day before and
        this string was not moved with it; because the element ships `hidden`
        nothing painted the lie, and a reader with script got it unhidden and
        announced verbatim. The chord is platform-dependent and
        the server cannot know the platform, so `theme.ts` writes the real text
        here BEFORE it unhides this, and this text is never announced.
      */}
      <span id={HINT_ID} className="sr-only" data-search-hint="" hidden>
        Search
      </span>
    </>
  );
}
