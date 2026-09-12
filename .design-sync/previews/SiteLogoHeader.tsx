/**
 * SiteLogoHeader previews.
 *
 * The tight 36x50 crop, for the header. Same rule as SiteLogo: no intrinsic
 * size, `className` is the only prop, so a bare render paints nothing.
 *
 * THE CELL THAT MATTERS IS `InTheHeaderBar`. Inside `.site-header` the brand
 * paths take `--mark-on-chrome` rather than `--brand`, by a (0,2,0) selector in
 * public-chrome.css that deliberately beats `.site-logo-brand` at (0,1,0). That
 * variant assignment is invisible in any render outside the chrome, which is
 * exactly the kind of thing a preview has to show rather than describe.
 */

import { SiteLogoHeader } from "dustinedwards-info";

/** On the purple chrome, where the mark is the light variant in BOTH themes. */
export function InTheHeaderBar() {
  return (
    <header
      className="site-header"
      style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--surface-chrome)", padding: "0.75rem 1.25rem" }}
    >
      <SiteLogoHeader className="site-header-mark" />
      <span style={{ color: "var(--on-chrome)", fontWeight: 650 }}>Dustin Edwards</span>
    </header>
  );
}

/** The same bar under the dark theme: the chrome surface changes, the mark does not. */
export function InTheHeaderBarDark() {
  return (
    <div data-theme="dark">
      <header
        className="site-header"
        style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--surface-chrome)", padding: "0.75rem 1.25rem" }}
      >
        <SiteLogoHeader className="site-header-mark" />
        <span style={{ color: "var(--on-chrome)", fontWeight: 650 }}>Dustin Edwards</span>
      </header>
    </div>
  );
}

/**
 * OFF the chrome, where the same markup follows `--brand` instead. Side by side
 * with the cells above this is the whole variant story: one component, two
 * fills, decided by an ancestor rather than by a prop.
 */
export function OffTheChrome() {
  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      <div data-theme="light" style={{ background: "var(--surface)", color: "var(--text)", padding: "1.5rem", flex: 1 }}>
        <SiteLogoHeader className="site-header-mark" />
      </div>
      <div data-theme="dark" style={{ background: "var(--surface)", color: "var(--text)", padding: "1.5rem", flex: 1 }}>
        <SiteLogoHeader className="site-header-mark" />
      </div>
    </div>
  );
}
