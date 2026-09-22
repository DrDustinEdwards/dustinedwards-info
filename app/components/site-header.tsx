import { Link, NavLink } from "react-router";

import headerEnhanceUrl from "~/enhance/dist/header.js?url";

import { EnhancementScript } from "~/components/enhancement-script";
import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { SiteSpeculation } from "~/components/site-speculation";
import { ThemeToggle } from "~/components/theme-toggle";
import { NAV } from "~/lib/nav";
import { SITE } from "~/lib/seo";


/**
 * Public site header. Ruling 126: sticky and one line at every width, with the destinations
 * visible on desktop and behind a labeled Menu on narrow widths.
 *
 * THE MENU ARRIVED WITH A PAGE COUNT THAT NEEDED IT, not in anticipation. The line that used to
 * sit here said there was no disclosure widget and no mobile menu machinery; six destinations plus
 * two tools stopped fitting on one phone line, which is the condition that buys the widget.
 *
 * THE THRESHOLDS ARE RE-MEASURED, NEVER REASONED FROM. They are a property of the
 * current label widths, and a longer word moves them. A simulated element is not
 * the element, so a threshold is measured after the link lands.
 *
 * The desktop header is one line and does not wrap. The narrow header takes the ONE width
 * condition in the sheet, which is where the destinations move into the menu.
 *
 * Roster's LABEL and its PATH deliberately disagree: the path is the indexed
 * legacy URL, the label is what the page is called.
 *
 * The search entry point is an ordinary link, upgraded in place with script.
 * Nothing in the header depends on the palette existing.
 *
 * NO `prefetch="intent"`: the prop worked through React event handlers, which
 * exist only on a hydrated page, so on a plane that does not hydrate it was dead
 * configuration that reads as an optimization. Hover prepayment comes from
 * `SiteSpeculation`, which is declarative and needs no script.
 */
export function SiteHeader() {
  /*
   * NO LOADER READ. The single-button control reads the theme off
   * `<html data-theme>` through the cascade, so the header renders from its props
   * and the route table alone and cannot disagree with the document it sits in.
   */
  return (
    <header className="site-header" data-site-header="">
      <Link to="/" className="site-header-brand">
        {/* Decorative: the link's accessible name is the wordmark beside it, so
            naming the mark too would make a screen reader say it twice. Inline
            so the purple follows the theme token; see site-logo.tsx. */}
        <SiteLogoHeader className="site-header-mark" />
        {SITE.name}
      </Link>
      {/*
       * NAMED, because two unlabelled navigation landmarks on a page are
       * indistinguishable to a screen reader. The footer carried a label and the header
       * carried nothing.
       */}
      <nav className="site-header-nav" aria-label="Main">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      {/*
       * THE TOOLS SIT OUTSIDE THE NAV. They are the two controls a reader reaches for without
       * reading, they are not destinations, and keeping them out of the nav is what lets the
       * destinations drop to their own line while these stay beside the wordmark.
       */}
      <div className="site-header-tools">
        <SearchTrigger />
        {/*
         * THE HARD RULE 13 SUBSTITUTION THAT SAT HERE IS GONE, and so is the reason for
         * it: the control takes no theme at all, both buttons are always rendered, and the
         * cascade chooses between them. There is no value to pass and nothing to
         * substitute when `data` is absent.
         */}
        <ThemeToggle />
        {/*
         * THE MENU IS A `<details>`, so it opens with scripting off and the browser owns the
         * open state. Ruling 126: LABELLED "Menu", never an icon alone, because hidden
         * navigation is measurably less discoverable and the label is what pays for it.
         *
         * It is rendered at every width and hidden by the sheet above the mobile breakpoint,
         * which is the one place the header takes a width condition. Rendering it only on
         * narrow widths is not available to us: the server does not know the viewport, and
         * guessing from a user agent is how a desktop reader gets a phone header.
         */}
        <details className="site-header-menu" data-header-menu="">
          <summary className="site-header-menu-button">Menu</summary>
          {/*
           * THE SECOND "Main" LANDMARK IS NOT A DUPLICATE AT ANY MOMENT. Exactly one of the
           * two navs is displayed at a given width and `display: none` takes the other out of
           * the accessibility tree, so a screen reader is never offered two. Labeling this
           * one differently would name the same destinations twice over.
           */}
          <nav className="site-header-menu-panel" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </details>
      </div>
      {/*
       * It rides HERE rather than in root's Layout so its scope is exactly the
       * header's: every public page, never the admin plane, which does not render this
       * component.
       */}
      <SiteSpeculation />
      {/*
       * The menu's keyboard contract and the mobile header's partial persistence. Absent, the
       * menu still opens and the header simply stays static; see app/enhance/header.ts.
       */}
      <EnhancementScript src={headerEnhanceUrl} />
    </header>
  );
}
