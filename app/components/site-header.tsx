import { searchHtml } from "capsomer/behavior/site-header";
import { ThemeForm } from "capsomer/react/theme-switch";
import { Link, useLocation, useMatches } from "react-router";

import { SiteLogoHeader } from "~/components/site-logo";
import { SiteNavPanel } from "~/components/site-nav-panel";
import { buildNav, type NavItem } from "~/lib/nav";
import { type RunningHeadHandle, sectionOf } from "~/lib/running-head";
import { SITE } from "~/lib/seo";
import askCss from "~/styles/ask.css?url";
import paletteDialogCss from "~/styles/palette-dialog.css?url";

const NAV_ID = "site-nav";

/**
 * Capsomer's search icon and its field (searchHtml, the markup letterheadHtml writes): a link to /search with no
 * script; app/enhance/header.ts wires it to answer from the site's /search as the person types. Its own wrapper
 * is taken off so the element below is the one Capsomer's markup names.
 */
const SEARCH_INNER = searchHtml({ action: "/search", label: "Search dustinedwards.info" }).replace(/^<div[^>]*>|<\/div>$/g, "");

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
    <div className="cap-page tracks running-head-tracks">
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
 * The family letterhead (capsomer/components/site-header, `data-variant="letterhead"`), in the markup Capsomer's
 * letterheadHtml writes, by hand only because the public plane does not hydrate and the sections open the site's
 * own panels: the mark with "Dustin Edwards" (the headquarters' name, which Capsomer sets where the other sites'
 * names sit), Home and the five sections, then search and the theme. Every link is in this markup with no script;
 * app/enhance/header.ts wires Capsomer's behavior (the panels, the tips and search) on top. The palette island
 * starts on Command-K, with its stylesheets from the header (app/enhance/theme.ts); the header no longer opens it. No
 * `prefetch="intent"`: it needs React handlers and this plane does not hydrate, so hover prefetch comes from
 * the rules file the Worker names in each public page's header (workers/app.ts).
 */
export function SiteHeader() {
  const { pathname } = useLocation();
  const nav = buildNav();
  return (
    <>
    <header
      className="cap-site-header"
      data-cap="site-header"
      data-variant="letterhead"
      data-site-header=""
      data-palette=""
      data-palette-css={`${paletteDialogCss},${askCss}`}
    >
      <Link to="/" className="cap-site-header-logo" aria-label={SITE.name}>
        {/* Decorative: the name beside it is the link's name. */}
        <SiteLogoHeader className="site-header-mark" />
        <span className="cap-site-header-names" aria-hidden="true">
          <span className="cap-site-header-agency">{SITE.name}</span>
        </span>
      </Link>
      <nav className="cap-site-header-sections" id={NAV_ID} aria-label="Site" data-site-nav="">
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
      <div className="cap-site-header-tools">
        <div className="cap-site-header-search" data-cap-part="search" dangerouslySetInnerHTML={{ __html: SEARCH_INNER }} />
        {/* Capsomer's no-script theme form: each button posts to /theme, which sets the cookie the server reads,
            and with script the theme module switches at once. The admin plane's shell reads the same choice
            from localStorage ("cap-theme"). */}
        <ThemeForm action="/theme" prefKey="cap-theme" className="cap-site-header-icon cap-site-header-theme" />
        <template data-island="theme" />
      </div>
      {/* Absent, every link is still in the markup and every panel still opens; see app/enhance/header.ts. */}
      <template data-island="header" />
    </header>
    <RunningHead pathname={pathname} />
    </>
  );
}
