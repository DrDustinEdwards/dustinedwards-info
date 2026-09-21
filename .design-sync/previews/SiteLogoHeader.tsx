/**
 * SiteLogoHeader previews.
 *
 * The tight 36x50 crop, for the header. Same rule as SiteLogo: no intrinsic
 * size, `className` is the only prop, so a bare render paints nothing.
 *
 * REWRITTEN 2026-09-21, because these cells were teaching a header that no
 * longer exists. They drew a purple bar with `--surface-chrome` hardcoded
 * inline and told the canvas the mark takes a light `--mark-on-chrome` variant
 * inside it. Ruling 117 made the header PAPER and PR #54 shipped it: the five
 * chrome role tokens now have zero paint consumers in any public sheet, so the
 * variant those cells existed to show is gone.
 *
 * THE VARIANT STORY THAT IS ACTUALLY TRUE, and it is simpler: every path in the
 * mark is `fill: currentColor` (public-chrome.css), so the mark inherits the
 * brand link's ink rather than carrying a fill of its own. On paper that is
 * `--text`, because the wordmark is the page's NAME and not a control, and
 * ruling 117 keeps purple for things a reader clicks. Hover moves both to
 * `--brand` together. One ink, decided by the ancestor, which is still exactly
 * the kind of thing a preview has to show rather than describe.
 */

import { SiteLogoHeader } from "dustinedwards-info";

/** The shipped header: paper, one dust rule under the whole thing, ink wordmark. */
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

/** The same header in dark: paper and ink both move, and the mark moves with them. */
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
 * currentColor, proved. The same markup in containers that set `color`
 * directly: the mark follows with no prop and no variant class, which is the
 * whole contract. The right-hand cell is the hover ink.
 */
export function FollowsCurrentColor() {
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
