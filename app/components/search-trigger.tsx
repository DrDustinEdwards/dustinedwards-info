import { Link } from "react-router";

import { ENHANCE_URLS } from "~/components/enhance";
import paletteDialogCss from "~/styles/palette-dialog.css?url";
import askCss from "~/styles/ask.css?url";

/**
 * The shortcut hint ships `hidden` and `theme.ts` unhides it once the listener is attached, so a
 * reader without script is never promised a shortcut. `data-palette` sits on the trigger, not the
 * document, so a page without this component has no palette rather than a broken one. The URL is
 * the palette bundle's, fetched on the gesture, never a <script> on the page.
 */
// One constant for the id, because a mismatched `aria-describedby` stops being announced silently.
const HINT_ID = "search-shortcut-hint";

export function SearchTrigger() {
  return (
    <>
      <Link
        to="/search"
        className="search-trigger"
        data-search-trigger=""
        data-palette={ENHANCE_URLS.palette}
        data-palette-css={`${paletteDialogCss},${askCss}`}
        aria-label="Search"
        aria-describedby={HINT_ID}
      >
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
      {/* Outside the anchor, or it would join the link's own content. */}
      {/* A placeholder: the chord is platform-dependent, so `theme.ts` writes the real text before it unhides this. */}
      <span id={HINT_ID} className="sr-only" data-search-hint="" hidden>
        Search
      </span>
    </>
  );
}
