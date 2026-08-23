import { Link, NavLink, useRouteLoaderData } from "react-router";

import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { SiteSpeculation } from "~/components/site-speculation";
import { ThemeToggle } from "~/components/theme-toggle";
import { NAV } from "~/lib/nav";
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
 *
 * THE LINK LIST MOVED TO `~/lib/nav`, because `SiteSpeculation` needs the same
 * paths and a second hand-written copy would drift silently: a link added
 * without a speculation entry still navigates, just slower. Four NavLinks
 * mapped from one array render exactly what four literals rendered.
 *
 * `prefetch="intent"` on the nav and the brand. react-router's `Link` defaults
 * to `prefetch="none"` (8.3.0, `lib/dom/lib.js`: `prefetch = "none"`), and
 * NavLink spreads its rest props into Link rather than setting its own, so
 * every menu click paid a round trip that a hover could have prepaid. It costs
 * the no-script plane NOTHING: the prefetch handlers are React event props and
 * the `<link>` elements are rendered from client state, so the server-rendered
 * anchors are byte-identical either way.
 */
export function SiteHeader() {
  const data = useRouteLoaderData<typeof rootLoader>("root");

  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand" prefetch="intent">
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
          <NavLink key={item.to} to={item.to} end={item.end} prefetch="intent">
            {item.label}
          </NavLink>
        ))}
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
      {/* Hover speculation for the paths this header links to. It rides HERE
          rather than in root's Layout so its scope is exactly the header's:
          every public page, never the admin plane, which does not render this
          component. See site-speculation.tsx for the nonce and the cost. */}
      <SiteSpeculation />
    </header>
  );
}
