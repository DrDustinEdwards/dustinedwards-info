# Building with dustinedwards.info

A personal site and Cloudflare showcase, not a general component library. Four
components ship here; the substance of the system is its **CSS custom
properties and semantic class names**, and that is what you design with.

## Setup

Load `styles.css` (it imports the fonts and the whole stylesheet closure).
Components come off the bundle global `window.DustinEdwards`.

There is **no theme provider and no root wrapper component**. The theme is an
attribute: `data-theme="light"` or `data-theme="dark"` on any element retokenises
that subtree, because both selectors are unqualified in the stylesheet. With no
attribute at all, `prefers-color-scheme` decides.

**A themed container MUST set both `background: var(--surface)` and
`color: var(--text)`.** Text colour is owned by the `body` rule, so a `<div
data-theme="dark">` that only sets a background inherits the *light* text colour
and its paragraphs render nearly invisible. This cost a preview cycle; it will
cost you one too.

`PostCard` and `Pagination` render react-router `<Link>`s and throw outside a
router. Wrap them in `MemoryRouter`, which the bundle exports for this purpose.

## The styling idiom

CSS custom properties plus semantic class names. **There is no utility-class
system, no `style` prop, and no theme-object props.** `SiteLogo` and
`SiteLogoHeader` take `className` and nothing else, so sizing is a class
decision, not an inline one. Write your own layout glue as ordinary CSS reading
the tokens below.

### Token families (all real, all defined in `styles.css`)

| Family | Names |
|---|---|
| Surfaces | `--surface` `--surface-chrome` `--surface-code` `--surface-popover` |
| Text | `--text` `--text-muted` `--text-heading` `--text-accent` `--text-disabled` `--text-danger` `--text-success` `--text-warning` |
| Brand | `--brand` `--brand-hover` `--brand-active` `--on-brand` |
| On chrome | `--on-chrome` `--on-chrome-muted` `--mark-on-chrome` |
| Borders | `--border` `--border-strong` `--border-danger` `--border-success` `--border-warning` |
| Tints | `--tint-brand` `--tint-danger` `--tint-success` `--tint-warning` |
| Type | `--font-sans` `--font-mono` |
| Focus | `--focus-ring` `--focus-ring-on-brand` `--focus-ring-on-chrome` |
| Charts | `--chart-purple` `--chart-cadet` `--chart-claret` `--chart-gold` `--chart-rust` `--chart-sage` |
| Layering | `--z-popover` `--z-dropdown` `--z-drawer` `--z-overlay` `--z-pinned-bar` |
| Layout | `--site-inset` `--control-h` |

**Popover elevation and pinned bars take `--border-strong`, never `--border`.**
That is a standing rule of the system, not a preference.

Links are `var(--brand)` and underlined by default, `var(--visited)` when
visited. Do not restate that on every anchor.

### Page vocabulary

`page` (the `<main>`, 2rem padding) wrapping `page-inner` (48rem, centred), with
`page-head` and `page-title` for the heading block. Long-form copy goes in
`prose`. Listings are `<ul class="post-list">`. Secondary text is `muted`. Tag
rows are `tag-chips` holding `tag-chip`. Chrome is `site-header` and
`site-shell-footer`; the login card is `gate-card` with `gate-mark`.

Components come off the bundle global `DustinEdwards`. Renaming it means
editing this file too, because the snippet below names it.

## Where the truth lives

Read `styles.css` and the files it imports before styling anything: they are the
real definitions and they beat this summary. Per-component API is in each
`<Name>.d.ts`, and usage in each `<Name>.prompt.md`.

## An idiomatic build

```jsx
const { MemoryRouter, PostCard, Pagination } = window.DustinEdwards;

<MemoryRouter>
  <main className="page">
    <div className="page-inner">
      <header className="page-head">
        <h1 className="page-title">Writing</h1>
        <p className="muted">Notes on building on Cloudflare.</p>
      </header>
      <ul className="post-list">
        <PostCard post={post} />
      </ul>
      <Pagination page={2} pageCount={5} hrefFor={(p) => `/blog?page=${p}`} />
    </div>
  </main>
</MemoryRouter>
```

`PostCard` renders an `<li>`, so it always needs that `post-list` parent.
