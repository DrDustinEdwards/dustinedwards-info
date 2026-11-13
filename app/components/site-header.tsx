import { SiteHeader as CapSiteHeader } from "capsomer/react/site-header";
import { useLocation, useMatches } from "react-router";

import { SiteLogoHeader } from "~/components/site-logo";
import { SiteNavPanel } from "~/components/site-nav-panel";
import { buildNav, type NavItem } from "~/lib/nav";
import { type RunningHeadHandle, runningHeadSection } from "~/lib/running-head";
import { SITE } from "~/lib/seo";
import askCss from "~/styles/ask.css?url";
import listboxCss from "capsomer/listbox.css?url";
import buttonCss from "capsomer/button.css?url";
import commandMenuCss from "capsomer/command-menu.css?url";
import paletteDialogCss from "~/styles/palette-dialog.css?url";

const inside = (item: NavItem, pathname: string) =>
  pathname === item.to || pathname.startsWith(`${item.to}/`);

/**
 * The running head under the header on every page but the home page, whose cover takes its place: the section's
 * number and trail, and the deepest route's folio (its `handle.folio`) or the site's name. Hidden from screen readers, as in the
 * Capsid explorer: it sits outside every landmark and says only what the h1 and the breadcrumb say.
 */
function RunningHead({ pathname }: { pathname: string }) {
  const matches = useMatches();
  if (pathname === "/") return null;
  const section = runningHeadSection(pathname);
  let folio: string | null | undefined;
  for (const match of matches) {
    const handle = match.handle as RunningHeadHandle | undefined;
    if (handle?.folio) folio = handle.folio(match.loaderData) ?? folio;
  }
  return (
    <div className="cap-page tracks running-head-tracks" aria-hidden="true">
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
 * Capsomer's letterhead (capsomer/react/site-header, `variant="letterhead"`), rendered with no hydration because the
 * public plane sends no React: the mark with "Dustin Edwards" alone, Home and the five sections, each opening the
 * site's structured panel (site-nav-panel.tsx), then search and the no-script theme form. Every link is in this
 * markup with no script; app/enhance/header.ts wires Capsomer's behavior (the panels, the tips and search) on top.
 * The palette island starts on Command-K, with its stylesheets from the header (app/enhance/theme.ts). No
 * `prefetch="intent"`: hover prefetch comes from the rules file the Worker names in each public page's header
 * (workers/app.ts).
 */
export function SiteHeader() {
  const { pathname } = useLocation();
  return (
    <>
      <CapSiteHeader
        variant="letterhead"
        hydrate={false}
        logo={{
          href: "/",
          label: SITE.name,
          mark: <SiteLogoHeader className="site-header-mark" />,
        }}
        sections={[
          { id: "home", label: "Home", href: "/", current: pathname === "/" },
          ...buildNav().map((item) => ({
            id: item.menu.id,
            label: item.label,
            current: inside(item, pathname),
            panelClassName: "site-nav-panel",
            panel: <SiteNavPanel menu={item.menu} pathname={pathname} />,
          })),
        ]}
        search={{ action: "/search", label: "Search dustinedwards.info" }}
        // Capsomer's no-script theme form: each button posts to /theme, which sets the cookie the server reads,
        // and with script the theme module switches at once. The admin plane's shell reads the same choice
        // from localStorage ("cap-theme").
        themeAction="/theme"
        themePrefKey="cap-theme"
        attributes={{
          "data-palette": "",
          "data-palette-css": `${listboxCss},${commandMenuCss},${buttonCss},${paletteDialogCss},${askCss}`,
        }}
        toolsEnd={<template data-island="theme" />}
        // Absent, every link is still in the markup and every panel still opens; see app/enhance/header.ts.
        end={<template data-island="header" />}
      />
      <RunningHead pathname={pathname} />
    </>
  );
}
