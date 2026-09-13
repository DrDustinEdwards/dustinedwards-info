import { SearchIcon } from "~/components/bar-icons";
import askCss from "~/styles/ask.css?url";
import paletteEnhanceUrl from "~/enhance/dist/palette.js?url";
import paletteDialogCss from "~/styles/palette-dialog.css?url";

/**
 * The bar's Search submit, and the three hashed URLs the command palette needs.
 *
 * IT IS ITS OWN MODULE for the same reason `search-trigger.tsx` was: these are
 * `?url` imports, and where they are imported decides which routes
 * `check:page-payload` treats as reachable. Keeping them in one leaf that the bar
 * renders reproduces the module shape the gate was measured against.
 *
 * With script, `enhance/theme.ts` upgrades `[data-search-trigger]`, cancels the
 * submit and opens the palette, loading the bundle and its two stylesheets from
 * these attributes. Without script this is a plain submit and the form GETs to
 * /search. The attributes are inert to a reader who has no script.
 */
export function BarSearchSubmit() {
  return (
    <button
      className="bar-ctrl"
      type="submit"
      aria-label="Search"
      data-search-trigger=""
      data-palette={paletteEnhanceUrl}
      data-palette-css={`${paletteDialogCss},${askCss}`}
    >
      <SearchIcon />
      <span className="u-visually-hidden">Search</span>
    </button>
  );
}
