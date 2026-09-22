/**
 * SiteLogoHeader previews.
 *
 * The tight 36x50 crop, for the header. Same rule as SiteLogo: no intrinsic
 * size, `className` is the only prop, so a bare render paints nothing.
 *
 * REWRITTEN 2026-09-21 for ruling 118.2, which puts the FULL-COLOUR mark in the
 * header. These cells taught one ink: every path was `fill: currentColor` in
 * public-chrome.css, so the mark took `--text` from the brand link and moved to
 * `--brand` with it on hover. That rule is deleted and nothing replaced it, so
 * the mark now paints itself.
 *
 * THE VARIANT STORY, which is the whole contract: the five purple paths carry
 * no fill of their own and take `--brand` from app.css, so they move between
 * the two purples with the theme. The three warm paths carry literal fills as
 * presentation attributes and are IDENTICAL in both variants, which is why
 * binding them to tokens would make the mark render differently from the
 * ratified assets. One consequence a preview has to show rather than describe:
 * the mark no longer follows its ancestor's `color`, so hovering the wordmark
 * moves the word and leaves the drawing where it was.
 */

import { SiteLogoHeader } from "dustinedwards-info";

/** The shipped header: paper, one dust rule under the whole thing, ink wordmark, color mark. */
export function InTheHeader() {
  return (
    <header
      className="site-header"
      style={{
        background: "var(--paper)",
        borderBlockEnd: "var(--line-w) solid var(--dust)",
        padding: "1.375rem 1.5rem 1.125rem",
      }}
    >
      <a className="site-header-brand" href="/">
        <SiteLogoHeader className="site-header-mark" />
        <span>Dustin Edwards</span>
      </a>
    </header>
  );
}

/** The same header in dark: paper and ink move, and the mark's purple moves with them. */
export function InTheHeaderDark() {
  return (
    <div data-theme="dark">
      <header
        className="site-header"
        style={{
          background: "var(--paper)",
          borderBlockEnd: "var(--line-w) solid var(--dust)",
          padding: "1.375rem 1.5rem 1.125rem",
        }}
      >
        <a className="site-header-brand" href="/">
          <SiteLogoHeader className="site-header-mark" />
          <span>Dustin Edwards</span>
        </a>
      </header>
    </div>
  );
}

/**
 * The mark ignores its ancestor, proved. The same markup in containers that set
 * `color` directly: a wordmark beside it would follow, and the mark does not
 * move. The right-hand cell is the wordmark's hover ink, which is where one ink
 * used to drag the whole drawing over to purple.
 */
export function IgnoresCurrentColor() {
  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      <div style={{ background: "var(--paper)", color: "var(--text)", padding: "1.5rem", flex: 1 }}>
        <SiteLogoHeader className="site-header-mark" />
      </div>
      <div style={{ background: "var(--paper)", color: "var(--brand)", padding: "1.5rem", flex: 1 }}>
        <SiteLogoHeader className="site-header-mark" />
      </div>
    </div>
  );
}
