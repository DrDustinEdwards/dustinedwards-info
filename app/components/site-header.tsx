import { Link, NavLink, useRouteLoaderData } from "react-router";

import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { ThemeToggle } from "~/components/theme-toggle";
import { SITE } from "~/lib/seo";

import type { loader as rootLoader } from "~/root";

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
 */
export function SiteHeader() {
  const data = useRouteLoaderData<typeof rootLoader>("root");

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
        <NavLink to="/blog" end>Blog</NavLink>
        <NavLink to="/projects">Projects</NavLink>
        <NavLink to="/playground">Playground</NavLink>
        <NavLink to="/phage-discovery">Roster</NavLink>
        <SearchTrigger />
        {/*
          JUSTIFIED SUBSTITUTION (hard rule 13). Ruled 2026-08-10,
          dustinedwards/decisions.md.

          `"system"` is NOT a fabricated stand-in for a value that went missing.
          It is the DOCUMENTED cookieless default: the absence of a `data-theme`
          attribute IS system mode, so this renders exactly what a first-time
          reader with no cookie gets. Contrast `STATUS_LABEL[s] ?? s`, which
          invented a label that had never been a real one.

          Throwing instead would blank the header on the ERROR-BOUNDARY path,
          where the root loader legitimately never ran and `data` is absent by
          design. That trades a recoverable error page for one carrying no
          navigation.

          The failure this could mask is already visible by other means: a
          loader that failed renders the error boundary, which is louder than a
          theme toggle showing its default.
        */}
        <ThemeToggle theme={data?.theme ?? "system"} />
      </nav>
    </header>
  );
}
