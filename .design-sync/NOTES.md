# design-sync notes for dustinedwards.info

Repo-specific gotchas for the next sync. Read this before anything else.

## What this sync IS, and what it deliberately is not

This repository is an APPLICATION, not a design system: `private: true`, no
`main`/`module`/`exports`, no `dist/`, no Storybook. The sync is scoped, by
Dustin's decision on 2026-09-12, to **the CSS layer plus the components that
genuinely render standalone**. Anyone reading a thin component count should read
that as the scope, not as a shortfall.

- **In:** the 21 public-plane stylesheets (tokens, type, chrome, listings,
  prose), the two self-hosted Inter faces, and four exports from two files:
  `PostCard`, `Pagination`, `SiteLogo`, `SiteLogoHeader`.
- **Out, and why:** `site-header` and `site-footer` are page singletons.
  `theme-toggle`, `ask-panel`, `search-trigger`, `blog-enhancements`,
  `site-speculation` and `enhancement-script` exist to inject the nonced
  enhancement bundles hard rule 4 requires; `theme-toggle` additionally imports
  `~/enhance/dist/theme.js?url`, a Vite specifier esbuild does not resolve.
  Nothing there is composable by a design agent.
- **Out:** the `admin-*` stylesheets (the admin plane is exempt from the
  progressive enhancement law) and `katex*` (a generated artifact carrying
  twenty font faces whose binaries would have to ship too).

## The build

`cfg.buildCmd` is `node .design-sync/build-inputs.mjs` and it MUST run before
the converter. It writes two gitignored files the converter reads:
`ds-styles.css` and `tsconfig.paths.json`. The converter command is

    node .ds-sync/package-build.mjs --config .design-sync/config.json \
      --node-modules ./node_modules --entry .design-sync/ds-entry.tsx --out ./ds-bundle

`--entry` is required: there is no `dist/`, and without it the converter looks
for `node_modules/dustinedwards-info`, which does not exist. The entry walks up
to the repo's own `package.json`, so every `cfg.*` path is repo-root relative.

## Three converter defects this repo trips, all worked around on our side

None of these needed a `lib/` fork. If a future skill version fixes one, the
workaround is inert rather than wrong.

1. **The tsconfig reader cannot parse `tsconfig.cloudflare.json`.** It strips
   comments with a regex, and the `/*` inside a glob like `app/enhance/*.ts`
   opens a block comment it closes far away. The parse dies at line 36 and every
   `~/` import then fails to resolve. `build-inputs.mjs` emits a paths-only
   tsconfig with a string-aware scanner instead.
2. **`@font-face` url()s are resolved against the CSS ENTRY's directory**, not
   the sheet the rule came from. Left alone, `app.css`'s
   `url("./fonts/inter-latin-normal.woff2")` resolves to `.design-sync/fonts/`,
   nothing is copied, and the rule ships into `fonts/fonts.css` where
   `./fonts/x` means `fonts/fonts/x`. Dead src, no error, Inter silently becomes
   a system font. `build-inputs.mjs` rewrites every url() relative to
   `.design-sync/` and then ASSERTS each target exists.
3. **The validator greps `_ds_bundle.css` for `@import` without stripping
   comments.** `app.css` carries a long comment explaining why
   `@import "tailwindcss"` was removed, and that prose failed the gate twice as
   a missing import. `build-inputs.mjs` strips CSS comments, guarded by a rule
   count measured from the source sheets so a runaway regex cannot pass.

`cfg.extraFonts` was set at first and then REMOVED: once defect 2 was fixed the
extractor copies both faces itself, and leaving it set only produced a spurious
"add a matching @font-face" line.

## A fourth defect: the manifest scraper flattens `prefers-contrast`

The grounds and the measurements are the comment on `stripContrastTier` in
`build-inputs.mjs`, which stays where the code is. What belongs HERE is the fact
a re-sync needs: **the bundle deliberately ships without the
`prefers-contrast: more` tier**, and that is not an omission to repair.

Claude Design's self-check scrapes tokens by flattening the stylesheet WITHOUT
media context and taking the last value, so promoted values were reported as the
base palette. Measured 2026-09-12 in the uploaded `_ds_manifest.json`:
`--border` read as `#6e6459`, which is what `--border-strong` already is, so the
two arrived at the design agent as THE SAME COLOUR and hard rule 5 became
unfollowable. An agent cannot honour a distinction it cannot see.

Do not "fix" this by reordering the tier to win the scraper: a media block adds
no specificity, so the tier works only because it comes last, and moving it
would trade a wrong manifest for a wrong render.

## The `--surface-chrome` collision, and what it cost

The bar's token family was documented in `conventions.md` from the first sync,
under an "On chrome" heading: `--surface-chrome`, `--on-chrome`,
`--on-chrome-muted`, `--mark-on-chrome`, plus the standing rule that pinned bars
take `--border-strong`. The 2026-09 redesign invented `--bar-fill` anyway and
abandoned `--surface-chrome`, and that single substitution invalidated every
colour in the header at once, because the surrounding tokens are measured
against the token it replaced. The header was eventually restored
byte-identical to an earlier commit rather than repaired.

Two things follow for the next sync, and neither is obvious from the code:

- **Accuracy was never the failure.** `conventions.md` was right and was
  hand-maintained and was still ignored, which is why the guidance is now
  GENERATED (`scripts/build-guidelines.mjs`) and why the prohibitions ride in
  the README header, where the 32,000-char inline ceiling guarantees they are
  read rather than hoped over.
- **A renamed token silently invalidates the vocabulary the canvas holds.**
  `conventions.md` enumerates real token names; when one is renamed in the
  sheets and not here, the design agent is sent names that resolve to nothing.
  Re-run that check rather than assuming it.

## Known render warns (a warn not listed here is NEW)

- `[TOKENS_MISSING] --shiki-light, --shiki-light-bg, --shiki-dark,
  --shiki-dark-bg`. Legitimate: the markdown pipeline's syntax highlighter sets
  these inline on rendered code blocks at build time, so no stylesheet defines
  them. Non-blocking, do not chase.
- `_ds_bundle.css fonts: 2 dead @font-face block(s) dropped` on every build.
  Also legitimate and slightly misreported: the working faces are in
  `fonts/fonts.css`, which `styles.css` imports FIRST, and the drop removes the
  duplicates that would otherwise shadow them. The converter's own drop regex
  backtracks around a quoted `./fonts/` url, which is why it fires at all.

## Preview authoring, learned the hard way

- **A themed wrapper must set `color: var(--text)` as well as
  `background: var(--surface)`.** Text colour is owned by the `body` rule, so a
  `<div data-theme="dark">` with only a background inherits the LIGHT text
  colour. The first `PostCard.DarkTheme` capture rendered with its description
  invisible, and it passed the mechanical render check: only reading the sheet
  caught it.
- `PostCard` renders an `<li>` and every cell wraps it in
  `<ul className="post-list">`.
- `SiteLogo` and `SiteLogoHeader` forward `className` ONLY. They do not spread,
  so a `style` prop is silently dropped: a sizes cell written with inline widths
  rendered three identical marks. Size via a real class.
- `Pagination` returns `null` at `pageCount <= 1`, so there is deliberately no
  cell for it; one would look like a broken preview.
- Post content in the previews is real frontmatter from `content/posts/*.md`.

## Verification environment

`playwright@1.61.1` is the version that pins chromium build 1228, which is what
is already cached in `~/AppData/Local/ms-playwright/`. Install it in `.ds-sync/`
with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; a different playwright wants a
different build and fails with `Executable doesn't exist`. The repo itself uses
puppeteer, not playwright, so there is nothing to reuse from its devDeps.

## Re-sync risks

- **The stylesheet list in `build-inputs.mjs` WAS hand-maintained and went
  stale, exactly as this note predicted.** `app/styles/shell.css` was imported
  by `root.tsx` and missing from `SHEETS`, so the sheet defining `.tracks`, the
  redesign's own grid, never reached the canvas. `check:design-sheets` now holds
  the list against `root.tsx`, the non-admin routes and the non-admin
  components, in both directions and including cascade order, so this is an
  instrument rather than a diff somebody remembers to run. Ruling 111.
  Note what it covers: cascade imports, `?url` side-loads and CSS-level
  `@import`. `katex.generated.css` is its one named exclusion.
- **Cascade order is load-bearing and is not alphabetical.** `SHEETS` reproduces
  `root.tsx`'s deliberate order; sorting it would move the cascade.
- The conventions header enumerates real token and class names. They were all
  verified against the built stylesheet on 2026-09-12; re-run that validation
  rather than assuming, since a renamed token would send the design agent
  vocabulary that resolves to nothing.
- `globalName` is `DustinEdwards` and the conventions snippet names it. Changing
  it means editing `conventions.md` too.
- The `.d.ts` contracts come from source `.tsx`, not from shipped types, because
  there are none. A prop rename in `app/components/` is picked up on rebuild;
  nothing warns that it changed.

## THE UPLOAD MUST NEVER DELETE THE CANVAS'S OWN WORK

**`part-a/`, `part-b/`, `references/` and `uploads/` are NEVER named in a
plan's `deletes`.** Read this before any upload, and especially before a
no-anchor one.

There is no import direction. The upload rewrites `components/**`, `tokens/**`,
`guidelines/**`, the bundles and `README.md` on every run, and `remote-diff.mjs`
compares the local build against the sync's OWN `_ds_sync.json` sidecar rather
than against the project's contents. So a canvas-side edit to any synced path is
invisible to the diff and then silently overwritten. Canvas work lives in those
four directories precisely because they are outside the writes list, and that is
the only thing protecting it.

The hazard is specific and it is in the skill's own instructions. On a re-sync
with NO ANCHOR (a re-adopted or recovered project) the skill says to review
`list_files` for "files this build doesn't produce" and put those paths in the
plan's `deletes`. Those four directories are exactly that, by construction. A
session following the instruction literally would delete the handoffs and the
96 reference shots. Exclude them explicitly, every time.

Ruling 110.
