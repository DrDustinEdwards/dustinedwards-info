/**
 * SiteLogo previews.
 *
 * The mark carries NO intrinsic size: it is an `<svg>` with a viewBox and a
 * className, so a cell that renders it bare paints nothing at all. Every cell
 * here gives it a real class from the site (`.gate-mark`) or an explicit width,
 * which is also the honest instruction to anyone composing with it.
 *
 * The five purple paths take `.site-logo-brand`, which resolves to
 * `var(--brand)`. That is the component's whole documented claim, so the theme
 * cells below are the point of this file rather than decoration.
 */

import { SiteLogo } from "dustinedwards-info";

/** As the login card uses it: `.gate-mark` is the 4rem block in app.css. */
export function OnTheLoginCard() {
  return (
    <div className="gate-card" style={{ maxWidth: "22rem" }}>
      <SiteLogo className="gate-mark" />
      <h1>Sign in</h1>
      <p className="muted">This door is on the public plane and works without scripting.</p>
    </div>
  );
}

/** The mark alone at the size the login card draws it. */
export function AtLoginSize() {
  return <SiteLogo className="gate-mark" />;
}

/**
 * The two sizing classes the site actually hands it, at 4rem and 2rem.
 *
 * `className` is the ONLY prop: the component does not spread, so there is no
 * `style` escape hatch and sizing is a class decision. Composing with it means
 * either reusing one of these or writing a class of your own.
 */
export function TheTwoSizingClasses() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2rem" }}>
      <SiteLogo className="gate-mark" />
      <SiteLogo className="site-header-mark" />
    </div>
  );
}

/**
 * Light and dark side by side, which is the only cell that shows what the
 * component is FOR: one path list, no second file, and `--brand` resolving to
 * #4f2d7f against the light surface and #b7a5e0 against the dark one. The three
 * warm paths keep literal fills and are identical in both, by design.
 */
export function BothThemes() {
  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      <div data-theme="light" style={{ background: "var(--paper)", color: "var(--text)", padding: "1.5rem", flex: 1 }}>
        <SiteLogo className="gate-mark" />
      </div>
      <div data-theme="dark" style={{ background: "var(--paper)", color: "var(--text)", padding: "1.5rem", flex: 1 }}>
        <SiteLogo className="gate-mark" />
      </div>
    </div>
  );
}
