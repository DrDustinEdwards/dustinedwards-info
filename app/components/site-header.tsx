import { ThemeForm } from "capsomer/react/theme-switch";
import { Link, useLocation, useMatches } from "react-router";

import { Enhance } from "~/components/enhance";
import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { Icon, SiteNavPanel } from "~/components/site-nav-panel";
import { SiteSpeculation } from "~/components/site-speculation";
import { HeaderTip } from "~/components/header-tip";
import { buildNav, type Menu, type NavIcon, type NavItem } from "~/lib/nav";
import { type RunningHeadHandle, sectionOf } from "~/lib/running-head";
import { SITE } from "~/lib/seo";

const NAV_ID = "site-nav";
const SHEET_ID = "site-sheet";
const SHEET_TITLE_ID = "site-sheet-title";


/*
 * Invoker commands (`commandfor`, `command`): the menu button opens the sheet and its Close button closes it
 * with no script, where the browser has them. React 19 has no props for them yet, so they are spread as
 * plain attributes, which React writes as they are.
 */
const opens = { command: "show-modal", commandfor: SHEET_ID } as Record<string, string>;
const closes = { command: "close", commandfor: SHEET_ID } as Record<string, string>;

const glyph = (body: React.ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {body}
  </svg>
);

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

type SheetLink = { to: string; label: string; icon?: NavIcon };

/** A section's links for the phone's sheet, grouped as its desktop panel groups them, each once. */
function sheetLinks(menu: Menu): SheetLink[] {
  const [hub, ...quick] = menu.footer;
  const all: SheetLink[] = [
    ...(hub ? [hub] : []),
    ...menu.tiles,
    ...menu.tiles.flatMap((tile) => (tile.also ? [tile.also] : [])),
    ...menu.rows.flatMap((row) => [
      ...(row.to ? [{ to: row.to, label: row.title, icon: row.icon }] : []),
      ...(row.links ?? []),
    ]),
    ...(menu.spotlight ? [{ to: menu.spotlight.to, label: menu.spotlight.title }] : []),
    ...quick,
  ];
  const seen = new Set<string>();
  return all.filter((link) => (seen.has(link.to) ? false : (seen.add(link.to), true)));
}

function SheetRow({ link, pathname }: { link: SheetLink; pathname: string }) {
  return (
    <li>
      <Link to={link.to} aria-current={link.to === pathname ? "page" : undefined}>
        <span className="cap-site-header-sheet-icon" aria-hidden="true">
          {link.icon ? <Icon name={link.icon} /> : null}
        </span>
        <span className="cap-site-header-sheet-name">{link.label}</span>
      </Link>
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
 * Capsomer's site header (capsomer/components/site-header/site-header.md), written by hand because the public
 * plane does not hydrate: 56px, sticky, full width; the site's logo, its five sections on the right after the
 * divider, then Search and the theme, with the avatar's slot held empty after it so the theme sits where the admin's does. Under 768px it is one row, and a Menu button opens
 * the sheet with every section's links. Every link is in this markup with no script; app/enhance/header.ts
 * wires Capsomer's behavior (the panels, the tips, the sheet) on top. No `prefetch="intent"`: it needs React
 * handlers and this plane does not hydrate, so hover prefetch comes from `SiteSpeculation`.
 */
export function SiteHeader() {
  const { pathname } = useLocation();
  const nav = buildNav();
  return (
    <>
    <header className="cap-site-header site-header" data-cap="site-header" data-links="right" data-site-header="">
      <Link to="/" className="cap-site-header-logo site-header-brand">
        {/* Decorative: the wordmark beside it is the link's name, so naming the mark would read twice. */}
        <SiteLogoHeader className="site-header-mark" />
        {SITE.name}
      </Link>
      <nav className="cap-site-header-sections site-header-nav" id={NAV_ID} aria-label="Site" data-site-nav="">
        <ul>
          {nav.map((item) => (
            <NavEntry key={item.to} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>
      <div className="cap-site-header-tools site-header-tools">
        <div className="cap-site-header-extras">
          <SearchTrigger />
        </div>
        {/* Capsomer's no-script theme form: each button posts to /theme, which sets the cookie the server reads,
            and with script the theme module switches at once. The admin plane's shell reads the same choice
            from localStorage ("cap-theme"). */}
        <ThemeForm action="/theme" prefKey="cap-theme" className="cap-site-header-icon cap-site-header-theme" />
        <Enhance module="theme" />
        {/* The avatar's slot, held empty: the admin header has the avatar here, so the theme button sits at the
            same place on every page. Sign in is the footer's Admin link (Dustin, 2026-10-15). */}
        <div className="cap-site-header-account site-header-account-slot" aria-hidden="true" />
        <button
          type="button"
          className="cap-site-header-icon cap-site-header-menu"
          aria-label="Menu"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-controls={SHEET_ID}
          data-header-menu=""
          {...opens}
        >
          {glyph(<path d="M4 7h16M4 12h16M4 17h16" />)}
          <HeaderTip text="Menu" />
        </button>
      </div>
      <dialog
        className="cap-dialog cap-site-header-sheet"
        data-cap="dialog"
        data-placement="bottom"
        id={SHEET_ID}
        aria-labelledby={SHEET_TITLE_ID}
      >
        <div className="cap-dialog-header">
          <h2 id={SHEET_TITLE_ID} className="cap-dialog-title cap-site-header-sheet-title" tabIndex={-1}>
            {SITE.name} menu
          </h2>
        </div>
        <div className="cap-dialog-body">
          <nav aria-labelledby={SHEET_TITLE_ID}>
            {nav.map((item) => (
              <div key={item.to}>
                <div className="cap-site-header-sheet-label">{item.label}</div>
                <ul className="cap-site-header-sheet-list">
                  {sheetLinks(item.menu).map((link) => (
                    <SheetRow key={link.to} link={link} pathname={pathname} />
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <button
          type="button"
          className="cap-site-header-icon cap-dialog-close"
          data-cap-part="close"
          aria-label="Close"
          {...closes}
        >
          {glyph(<path d="M6 6l12 12M18 6 6 18" />)}
        </button>
      </dialog>
      {/* Here rather than in root's Layout, so it never reaches the admin plane. */}
      <SiteSpeculation />
      {/* Absent, every link is still in the markup and every panel still opens; see app/enhance/header.ts. */}
      <Enhance module="header" />
    </header>
    <RunningHead pathname={pathname} />
    </>
  );
}
