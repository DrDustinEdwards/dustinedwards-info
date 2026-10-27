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

/**
 * The letterhead's search box (capsomer/site-header): a form to /search, so it works with no script; with
 * script a click opens the palette (`theme.ts`), which also answers Command-K or Control-K.
 */
export function SearchTrigger() {
  return (
    <>
      <form
        className="cap-site-header-search search-trigger"
        role="search"
        aria-label="Site"
        action="/search"
        method="get"
        data-search-trigger=""
        data-palette={ENHANCE_URLS.palette}
        data-palette-css={`${paletteDialogCss},${askCss}`}
      >
        <button type="submit" aria-label="Search">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </button>
        <input type="search" name="q" placeholder="Search" aria-label="Search" aria-describedby={HINT_ID} autoComplete="off" />
      </form>
      {/* A placeholder: the chord is platform-dependent, so `theme.ts` writes the real text before it unhides this. */}
      <span id={HINT_ID} className="sr-only" data-search-hint="" hidden>
        Search
      </span>
    </>
  );
}
