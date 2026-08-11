import { Link, NavLink, useRouteLoaderData } from "react-router";

import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { ThemeToggle } from "~/components/theme-toggle";
import { SITE } from "~/lib/seo";

import type { loader as rootLoader } from "~/root";

/**
 * Public site header. Brand plus the nav links the site currently earns.
 * It grows when there is a page to add, not in anticipation, so there is still
 * no disclosure widget and no mobile menu machinery. Two links is still under
 * the width where that becomes a real question; the third is where to look at
 * it again.
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
      <nav className="site-header-nav">
        <NavLink to="/blog">Blog</NavLink>
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
