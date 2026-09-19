import { Link, NavLink } from "react-router";

import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { SiteSpeculation } from "~/components/site-speculation";
import { ThemeToggle } from "~/components/theme-toggle";
import { NAV } from "~/lib/nav";
import { SITE } from "~/lib/seo";


/**
 * Public site header. It grows when there is a page to add, not in
 * anticipation, so there is still no disclosure widget and no mobile menu
 * machinery.
 *
 * THE THRESHOLDS ARE RE-MEASURED, NEVER REASONED FROM. They are a property of the
 * current label widths, and a longer word moves them. A simulated element is not
 * the element, so a threshold is measured after the link lands.
 *
 * The header wraps on BOTH the header and the nav, and the only media query
 * touching it is `print`, so nothing here is breakpoint-dependent.
 *
 * Roster's LABEL and its PATH deliberately disagree: the path is the indexed
 * legacy URL, the label is what the page is called.
 *
 * The search entry point is an ordinary link, upgraded in place with script.
 * Nothing in the header depends on the palette existing.
 *
 * NO `prefetch="intent"`: the prop worked through React event handlers, which
 * exist only on a hydrated page, so on a plane that does not hydrate it was dead
 * configuration that reads as an optimisation. Hover prepayment comes from
 * `SiteSpeculation`, which is declarative and needs no script.
 */
export function SiteHeader() {
  /*
   * NO LOADER READ. The single-button control reads the theme off
   * `<html data-theme>` through the cascade, so the header renders from its props
   * and the route table alone and cannot disagree with the document it sits in.
   */
  return (
    <header className="site-header">
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
        <SearchTrigger />
        {/*
         * THE HARD RULE 13 SUBSTITUTION THAT SAT HERE IS GONE, and so is the reason for
         * it: the control takes no theme at all, both buttons are always rendered, and the
         * cascade chooses between them. There is no value to pass and nothing to
         * substitute when `data` is absent.
         */}
        <ThemeToggle />
      </nav>
      {/*
       * It rides HERE rather than in root's Layout so its scope is exactly the
       * header's: every public page, never the admin plane, which does not render this
       * component.
       */}
      <SiteSpeculation />
    </header>
  );
}
