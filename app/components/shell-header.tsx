import { Link, NavLink } from "react-router";

import { MenuIcon, MoonIcon, SunIcon } from "~/components/bar-icons";
import { BarSearchSubmit } from "~/components/bar-search-submit";
import { EnhancementScript } from "~/components/enhancement-script";
import { SiteSpeculation } from "~/components/site-speculation";
import themeEnhanceUrl from "~/enhance/dist/theme.js?url";
import { SHELL_NAV } from "~/lib/shell-nav";
import { SITE } from "~/lib/seo";

/**
 * The Paper, Glass, Light bar. Ruling 65, Part A steps 3 and 6b.
 *
 * ONE BREAKPOINT, 64rem, and it is the same number as the third gutter step, so
 * the header introduces no figure of its own. Below it the six destinations
 * collapse into a `details` overflow; the two controls never collapse.
 *
 * NOTHING HERE HYDRATES. Every element is in the server HTML and works with
 * scripting off: the summary toggles by click, Enter and Space; search is a GET
 * form; the theme control is a POST form. Hard rule 4 keeps the public plane
 * unhydrated and hard rule 9 keeps the fallback mandatory, so this component
 * uses no state, no effect and no event handler.
 *
 * ## BOTH NAVS ARE IN THE DOM AND CSS HIDES ONE
 *
 * That is correct here and only here: `display: none` removes the hidden one
 * from the accessibility tree, so exactly ONE element labelled "Main" exists at
 * any width, and both hold the same six destinations in the same order. The
 * hide is CSS, never script.
 *
 * The SEARCH control is the opposite case and does NOT work this way; see the
 * comment on the form below.
 */
export function ShellHeader() {
  return (
    <header className="site-shell-header">
      <div className="site-shell-header-in">
        {/*
          The logo is an `a`, not a heading. One `h1` per page and it lives in
          `main`. It truncates with an ellipsis below about 355px, and the full
          name stays its accessible name because the text node is intact: the
          clipping is `text-overflow`, which is visual only.
        */}
        <Link to="/" className="site-shell-logo">
          {SITE.name}
        </Link>

        {/* 64rem and up. */}
        <nav className="site-shell-nav" aria-label="Main">
          {SHELL_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Below 64rem: the same six, in the same order. */}
        <details className="site-shell-overflow">
          <summary className="bar-ctrl" aria-label="Menu">
            <MenuIcon />
            <span className="u-visually-hidden">Menu</span>
          </summary>
          <nav className="site-shell-menu" aria-label="Main">
            {SHELL_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </details>

        {/*
          ONE FORM AT EVERY WIDTH, one `role="search"` landmark, one `bar-q`.

          RULED 2026-09-13. Part A asked the server to emit a link below 64rem
          and this form above it, "chosen by width class on the request". A
          server has no viewport width, this repo carries no width or device
          signal, and rule 20 says a new input to the body goes in the cache
          key, so branching on width would have put a width dimension into the
          themed `caches.default` entry.

          Below 64rem CSS hides the INPUT alone, which takes it out of the tab
          order and the accessibility tree and leaves a labelled Search button
          that submits to /search, the page carrying the real field. The form,
          the landmark and the label survive at every width, so nothing here is
          duplicated and nothing is chosen on the server.

          `role="search"` is the one role this shell writes, because there is no
          element that carries it.
        */}
        <form className="bar-search" method="get" action="/search" role="search">
          <label className="u-visually-hidden" htmlFor="bar-q">
            Search
          </label>
          {/*
            `bar-q`, not `q`: the home page renders its own Ask field at `q` and
            the two would collide on a page that carries both.
          */}
          <input id="bar-q" className="bar-search-input" name="q" type="search" autoComplete="off" />
          {/*
            THE PALETTE HANGS OFF THE BUTTON THE BAR ALREADY HAS, so keeping it
            reachable costs no bar UI at all, which is the only way build 2 can
            keep it without building a control that belongs to Part B page 3.

            With script: `enhance/theme.ts` upgrades `[data-search-trigger]`,
            cancels the submit and opens the palette, whose bundle and
            stylesheets it loads from the three hashed URLs below. Without
            script: this is a plain submit and the form GETs to /search. The
            attributes are inert to a reader who has no script to answer them.

            THE BUNDLE IS NOT DELETED AND NOT REWIRED INTO NEW UI. Whether the
            command palette survives the redesign is a product decision, and it
            should not be settled as a side effect of retiring the old header.
          */}
<BarSearchSubmit />
        </form>

        <ShellThemeControl />
      </div>
      {/*
        HOVER SPECULATION, carried over from the old header rather than lost
        with it. The rules are DOCUMENT rules: they match the links in the
        rendered document rather than a list of paths, so the six destinations
        are covered because they are anchors. It rides here rather than in
        root so its scope is exactly the public plane, which is the only plane
        that renders this component.

        Rule 4: prefetch is a JS-only extra and nothing may depend on it. A
        scriptless reader loses the speed and no function.
      */}
      <SiteSpeculation />
    </header>
  );
}

/**
 * The theme control, as TEXT rather than an icon, because step 6a forbids an
 * icon-only control anywhere in this system.
 *
 * ## WHY BOTH BUTTONS ARE RENDERED AND THE CASCADE CHOOSES
 *
 * The build-2 job asked the server to render the button as the opposite of the
 * current cookie. THE SERVER CANNOT DO THAT CORRECTLY, and the reason is the
 * "system" setting: it is the ABSENCE of the cookie, so a reader who has never
 * chosen has no cookie and the server does not know whether their machine is
 * in light or dark. A server-picked button would be wrong for exactly those
 * readers, and they are the default case.
 *
 * So both buttons ship and CSS picks, in three layers: a default that assumes
 * light, a `prefers-color-scheme: dark` layer for the machine's answer, and an
 * `html[data-theme]` layer that outranks it for a reader who has chosen. This
 * is the mechanism the existing icon control already uses, kept rather than
 * reinvented; only the paint is different.
 *
 * ## IT POSTS, IT DOES NOT GET
 *
 * RULED 2026-09-13: `/theme` already exists as a POST with an origin check, a
 * writable-theme refusal and a 303 to a validated `Referer`. Part A specified a
 * GET to a new `/prefs/theme`, and the `no-store`, `Vary: Cookie` and
 * speculation-exclusion machinery it listed existed only to patch the weakness
 * of a GET that writes a cookie: a GET can be linked, bookmarked and crawled,
 * where a form POST cannot be triggered by a link at all. The stronger route
 * was already here, so `/prefs/theme` was dropped rather than built.
 */
function ShellThemeControl() {
  return (
    <form method="post" action="/theme" className="bar-theme" data-theme-toggle="">
      <button
        type="submit"
        name="theme"
        value="dark"
        className="bar-ctrl bar-theme-option"
        data-when="light"
        aria-label="Switch to dark theme"
      >
        <SunIcon />
        <span className="bar-ctrl-label">Dark</span>
      </button>
      <button
        type="submit"
        name="theme"
        value="light"
        className="bar-ctrl bar-theme-option"
        data-when="dark"
        aria-label="Switch to light theme"
      >
        <MoonIcon />
        <span className="bar-ctrl-label">Light</span>
      </button>
      {/*
        THE ENHANCEMENT, restored rather than dropped.

        `app/enhance/theme.ts` binds a delegated submit listener to
        `[data-theme-toggle]` and flips `<html data-theme>` in place, which
        removes the round trip. Losing it was a REGRESSION this build nearly
        shipped: the first draft of this control carried neither the attribute
        nor the script, and check:page-payload reported `bundles 0 [none]` on
        every route. That read as the page getting cheaper when it was the page
        getting less capable, and it was masking the shell's own CSS growth in
        the totals.

        The control works without it, which is the point of hard rule 9: the
        form posts, the action writes the cookie, the next render carries the
        attribute. The bundle only removes the round trip.
      */}
      <EnhancementScript src={themeEnhanceUrl} />
    </form>
  );
}
