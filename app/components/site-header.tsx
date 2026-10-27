import { ThemeForm } from "capsomer/react/theme-switch";
import { Link, useLocation, useMatches } from "react-router";

import { Enhance } from "~/components/enhance";
import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { SiteNavPanel } from "~/components/site-nav-panel";
import { SiteSpeculation } from "~/components/site-speculation";
import { buildNav, type NavItem } from "~/lib/nav";
import { type RunningHeadHandle, sectionOf } from "~/lib/running-head";
import { SITE } from "~/lib/seo";

const NAV_ID = "site-nav";

const CHEVRON = (
  <svg className="cap-site-header-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const inside = (item: NavItem, pathname: string) => pathname === item.to || pathname.startsWith(`${item.to}/`);

/**
 * A section and the panel that hangs from it: Capsomer's disclosure button (site-header.md, "Markup"), not a
 * link and not a menuitem, because everything the panel shows is a link. `popoverTarget` opens the panel with
 * no script; with script, Capsomer's behavior takes the click (it cancels the native toggle) and writes
 * `aria-expanded`. Inside the section the button carries the current page's underline (`data-current`).
 */
function NavEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  const here = inside(item, pathname);
  const panel = `${NAV_ID}-${item.menu.id}`;
  return (
    <li data-nav-menu="">
      <button
        type="button"
        className="cap-site-header-link"
        data-cap-part="panel-trigger"
        popoverTarget={panel}
        aria-expanded="false"
        aria-controls={panel}
        data-nav-button=""
        data-current={here ? "" : undefined}
        data-section={here ? "" : undefined}
      >
        <span className="site-nav-button-label">{item.label}</span>
        {CHEVRON}
      </button>
      <SiteNavPanel id={panel} label={item.label} menu={item.menu} pathname={pathname} />
    </li>
  );
}

/**
 * The running head under the header on every page but the home page, whose cover takes its place: the section's
 * number and trail, and the deepest route's folio (its `handle.folio`) or the site's name.
 */
function RunningHead({ pathname }: { pathname: string }) {
  const matches = useMatches();
  if (pathname === "/") return null;
  const section = sectionOf(pathname);
  let folio: string | null | undefined;
  for (const match of matches) {
    const handle = match.handle as RunningHeadHandle | undefined;
    if (handle?.folio) folio = handle.folio(match.loaderData) ?? folio;
  }
  return (
    <div className="tracks running-head-tracks">
      <div className="cap-running-head u-wide">
        <span className="cap-running-head-name">
          <span className="cap-running-head-no">{section.no}</span>
          <span className="running-head-trail">{section.trail.join(" · ")}</span>
        </span>
        <span className="cap-running-head-folio">{folio ?? SITE.name}</span>
      </div>
    </div>
  );
}

/**
 * The family letterhead (capsomer/components/site-header, `data-variant="letterhead"`), written by hand because
 * the public plane does not hydrate: the mark with "Dustin Edwards", the search box and the theme in the top row,
 * Home and the five sections in the second, pinned at the top inside the page's margins. Capsomer keeps the
 * inbox and account slots empty, so search and the theme sit where the admin's do. Every link is in this markup with no script; app/enhance/header.ts
 * wires Capsomer's behavior (the panels and the tips) on top. No `prefetch="intent"`: it needs React
 * handlers and this plane does not hydrate, so hover prefetch comes from `SiteSpeculation`.
 */
export function SiteHeader() {
  const { pathname } = useLocation();
  const nav = buildNav();
  return (
    <>
    <header className="cap-site-header site-header" data-cap="site-header" data-variant="letterhead" data-site-header="">
      <Link to="/" className="cap-site-header-logo site-header-brand" aria-label={SITE.name}>
        {/* Decorative: the name beside it is the link's name. */}
        <SiteLogoHeader className="site-header-mark" />
        {/* The headquarters site: "Dustin Edwards" alone, at the agency's size (Dustin, 2026-10-27). */}
        <span className="cap-site-header-names" aria-hidden="true">
          <span className="cap-site-header-agency">{SITE.name}</span>
        </span>
      </Link>
      <nav className="cap-site-header-sections site-header-nav" id={NAV_ID} aria-label="Site" data-site-nav="">
        <ul>
          <li>
            <Link to="/" className="cap-site-header-link" aria-current={pathname === "/" ? "page" : undefined}>
              Home
            </Link>
          </li>
          {nav.map((item) => (
            <NavEntry key={item.to} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>
      <div className="cap-site-header-tools site-header-tools">
        <SearchTrigger />
        {/* Capsomer's no-script theme form: each button posts to /theme, which sets the cookie the server reads,
            and with script the theme module switches at once. The admin plane's shell reads the same choice
            from localStorage ("cap-theme"). */}
        <ThemeForm action="/theme" prefKey="cap-theme" className="cap-site-header-icon cap-site-header-theme" />
        <Enhance module="theme" />
      </div>
      {/* Here rather than in root's Layout, so it never reaches the admin plane. */}
      <SiteSpeculation />
      {/* Absent, every link is still in the markup and every panel still opens; see app/enhance/header.ts. */}
      <Enhance module="header" />
    </header>
    <RunningHead pathname={pathname} />
    </>
  );
}
