# What is already decided

Read this before designing anything for dustinedwards.info. It is short on purpose: each line is
something the site's code or platform fixes. Design choices are defaults a better design overrides;
accessibility and security are the fixed parts. `conventions.md` is the spec of intent; the
stylesheets are the values, and they win any disagreement.

## Where design work lives

This project is the design system: the synced bundle (`styles.css`, components, fonts, guidelines,
`_vendor/`, the compiled `_preview/*.js`), plus `templates/visual-system/`, the approved visual
system, which is the design authority and which a sync never overwrites.

Page mockups are not made here. Each is its own project with this design system attached, and it
reaches the site through **Export, Hand off to Claude Code**. A design change is built only from an
approved page. The approved pages are in the project **dustinedwards.info pages**
(`58092e7e-38bf-49fb-8f71-97251ee74445`).

## Tokens are measured

Every color pairing is measured by `check:contrast`. Use the tokens and the measurement holds;
compute a color yourself, or swap one side of a pair, and it does not. Popover elevation and pinned
bars take `--border-strong`, never `--border`.

## The wordmark outranks, deliberately

`.site-header-brand` carries its own `:visited` and `:hover` rules at a higher specificity than the
base anchor rules. Without them the site's own name turns visited-colored for every returning
reader. Do not "simplify" them away.

## Layering has one trap

The layer tokens are named and ordered, and **the dropdown layer sits below the pinned header**: a
menu on the dropdown layer renders under the header that opened it. An overlay takes the overlay
layer. Never write a raw `z-index`.

## Caching, which is in no stylesheet

- A response with no cache policy is refused, not cached: sharing is opt-in.
- A route that receives any cookie is served `private, no-store`.
- Cached public pages are stored per theme, so a page's HTML may not encode anything else that
  varies per reader. Per-reader content belongs in a script enhancement.

## Accessibility floors

- Both themes are first class, and a themed container owes both `background: var(--paper)` and
  `color: var(--text)`.
- Focus is always visible: `--brand`, 2px, 2px offset, square corners.
- An icon-only control needs an accessible name and an `aria-hidden` icon.
- Contrast is measured, not eyeballed; the thresholds belong to the check.
