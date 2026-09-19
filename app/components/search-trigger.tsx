import { Link } from "react-router";

import paletteEnhanceUrl from "~/enhance/dist/palette.js?url";
import paletteDialogCss from "~/styles/palette-dialog.css?url";
import askCss from "~/styles/ask.css?url";

/**
 * The site-wide search entry point.
 *
 * WHAT SHIPS IS A LINK. Server-rendered, it is an anchor to /search, so a reader
 * with scripting off gets working search by clicking it. If the palette chunk
 * never loads, never finishes, or throws, the link is still a link.
 *
 * THE HONESTY CONTRACT: the shortcut hint ships `hidden` and `theme.ts` unhides
 * it, so the promise is made only once the listener is attached. A reader without
 * script is never told about a shortcut that does not exist for them.
 *
 * NO SCRIPT TAG HERE. THE ATTRIBUTE IS THE WHOLE CHANGE: `data-palette` carries
 * the hashed URL, and `theme.ts` imports it the first time a binding fires. The
 * bundle must still be PREBUILT, because `?url` copies the file verbatim with no
 * compilation and pointed at the source it serves raw TypeScript.
 *
 * The attribute goes on the trigger rather than the document, so a page without
 * this component has no palette instead of a broken one.
 */
/**
 * The id `aria-describedby` points at. A literal written twice is a description
 * that silently stops being announced the day one of them is edited, which is a
 * failure nothing paints. `check:browser` asserts the association resolves.
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
       * `.sr-only` would be wrong twice over: it would announce a shortcut to a
       * scriptless reader who does not have one, and `hidden` is what lets `theme.ts`
       * reveal it on exactly the right signal. OUTSIDE the anchor, or it would become
       * part of the link's own content.
       */}
      {/*
       * A PLACEHOLDER, NOT THE HINT. The chord is platform-dependent and the server
       * cannot know the platform, so `theme.ts` writes the real text here BEFORE it
       * unhides this, and this text is never announced.
       */}
      <span id={HINT_ID} className="sr-only" data-search-hint="" hidden>
        Search
      </span>
    </>
  );
}
