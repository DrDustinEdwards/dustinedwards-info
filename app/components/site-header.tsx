import { Link, NavLink } from "react-router";

import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { SiteSpeculation } from "~/components/site-speculation";
import { ThemeToggle } from "~/components/theme-toggle";
import { NAV } from "~/lib/nav";
import { SITE } from "~/lib/seo";


/**
 * Public site header. Brand plus the nav links the site currently earns.
 * It grows when there is a page to add, not in anticipation, so there is still
 * no disclosure widget and no mobile menu machinery.
 *
 * THIS IS THE FOURTH LINK, and the previous comment said the fourth is where
 * counting links stops and measuring starts. Measured 2026-08-14, and the
 * numbers are why Playground is here rather than in the footer:
 *
 *   header no-wrap threshold   3 links 537px   4 links 619px
 *   320px to 480px             identical: header 81px, wordmark on two lines
 *   nav overflow, page x-scroll   none at any width down to 320px
 *
 * The 619px figure is measured against THIS nav. A prediction of 629px was made
 * first from a probe anchor injected into the row, and it was 10px wide because
 * the probe rendered slightly broader than a real NavLink (nav content 413px
 * against the real 403px). Recorded because it is the general case: a simulated
 * element is not the element, so the threshold is re-measured after the link
 * actually lands, not before.
 *
 * The header is `flex-wrap: nowrap` and the only media query touching it is
 * `print`, so nothing here is breakpoint-dependent. At every real phone width
 * the header was ALREADY two lines with three links, so the fourth costs
 * nothing there; it only moves the wordmark's two-line threshold from 537px to
 * 629px. That band is accepted (ruled 2026-08-14). A disclosure widget would be
 * client state on a page that has none, so it stays refused: the row still does
 * not break, it reflows.
 *
 * The FIFTH link is the next place to look, and the same measurement decides
 * it. Re-measure rather than reasoning from these numbers: they are a property
 * of the current label widths, and a longer word moves them.
 *
 * Roster's LABEL and its PATH deliberately disagree. The path is
 * /phage-discovery because that is the indexed legacy URL the Worker takes over
 * at cutover; the label is what the page is called. NavLink matches on the
 * path, so `aria-current` still lands correctly.
 *
 * The search entry point is an ordinary link to /search. With scripting on it
 * is upgraded in place into a button that opens the command palette; with
 * scripting off it stays a link and search still works. Nothing in the header
 * depends on the palette existing.
 *
 * THE LINK LIST MOVED TO `~/lib/nav`, because `SiteSpeculation` needs the same
 * paths and a second hand-written copy would drift silently: a link added
 * without a speculation entry still navigates, just slower. Four NavLinks
 * mapped from one array render exactly what four literals rendered.
 *
 * NO `prefetch="intent"` any more, removed 2026-08-26 with the unhydration
 * arc. The prop worked through React event handlers, which exist only on a
 * hydrated page, and the public plane no longer hydrates: the props had
 * become dead configuration that reads as an optimisation, which is the
 * dead-code-that-looks-alive class rule 4's hook gate exists for. Hover
 * prepayment is not lost, because it never came from here alone:
 * `SiteSpeculation` below declares the same header destinations as
 * speculation rules, which are DECLARATIVE and work without any script or
 * hydration, so the hover speculation this comment used to promise is still
 * delivered, by the mechanism that survives.
 */
export function SiteHeader() {
  /*
   * NO LOADER READ SINCE 2026-08-29. This component called
   * `useRouteLoaderData` for exactly one value, the resolved theme, which it
   * handed to `ThemeToggle`. The single-button control reads the theme off
   * `<html data-theme>` through the cascade instead, so the header now renders
   * from its props and the route table alone and cannot disagree with the
   * document it sits in.
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
      {/* NAMED, because site-footer.tsx's own comment already says "The nav
          carries an aria-label because the header has one too, and two
          unlabelled navigation landmarks on a page are indistinguishable to a
          screen reader". The footer carried aria-label="Colophon" and the
          header carried nothing, so that sentence was false on every page and
          the pair it describes never existed. */}
      <nav className="site-header-nav" aria-label="Main">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
        <SearchTrigger />
        {/*
          THE HARD RULE 13 SUBSTITUTION THAT SAT HERE IS GONE, and so is the
          reason for it. This passed the resolved theme down with a fallback,
          ruled on 2026-08-10, which kept the header rendering on the
          error-boundary path where the root loader legitimately never ran.

          Since 2026-08-29 the control takes no theme at all: both of its
          buttons are always rendered and the cascade chooses between them from
          `<html data-theme>` and `prefers-color-scheme`. There is no value to
          pass and nothing to substitute when `data` is absent, so the
          error-boundary path renders the same markup as every other path by
          construction.
        */}
        <ThemeToggle />
      </nav>
      {/* Hover speculation for the paths this header links to. It rides HERE
          rather than in root's Layout so its scope is exactly the header's:
          every public page, never the admin plane, which does not render this
          component. See site-speculation.tsx for the nonce and the cost. */}
      <SiteSpeculation />
    </header>
  );
}
