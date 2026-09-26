# design-sync notes for dustinedwards.info

Repo-specific gotchas for the next sync. Read this before anything else.

## What this sync IS, and what it deliberately is not

This repository is an APPLICATION, not a design system: `private: true`, no
`main`/`module`/`exports`, no `dist/`, no Storybook. The sync is scoped, by
Dustin's decision on 2026-09-12, to **the CSS layer plus the components that
genuinely render standalone**. Anyone reading a thin component count should read
that as the scope, not as a shortfall.

- **In:** the public-plane stylesheets (tokens, type, chrome, listings, prose),
  the self-hosted faces they declare, and the exports `.design-sync/ds-entry.tsx`
  re-exports, currently `SiteLogo` and `SiteLogoHeader`. Those three sets each
  have ONE owner and this line names none of their contents: the sheet list is
  `SHEETS` in `build-inputs.mjs`; the faces are whatever the
  url() extractor copies into `ds-bundle/fonts/`; the components are the entry's
  re-exports. This bullet said "21 stylesheets, the two Inter faces, and four
  exports: PostCard, Pagination, SiteLogo, SiteLogoHeader" until 2026-09-21,
  by which time the real numbers were 29 sheets and three faces and PostCard and
  Pagination had been deleted from the repo. A count restated in prose is a
  second owner and this is what it costs.
- **Out, and why:** `site-header` and `site-footer` are page singletons.
  `theme-toggle`, `ask-panel`, `search-trigger`, `blog-enhancements`,
  `site-speculation` and `enhancement-script` exist to inject the nonced
  enhancement bundles the no-framework-script rule requires; `theme-toggle` additionally reaches
  `virtual:enhance`, a Vite virtual module no other bundler resolves.
  Nothing there is composable by a design agent. The header and footer still
  reach the pane, as PREVIEW CARDS rather than components; see "The preview
  cards" below.
- **Out:** the `admin-*` stylesheets (the admin plane is exempt from the
  progressive enhancement law) and `katex*` (a generated artifact carrying
  twenty font faces whose binaries would have to ship too).
- **Out, and the one most likely to be re-added by mistake:** `post-row`, whose
  `PostRow` and `Pager` replaced `PostCard` and `Pagination` in PR #62. The
  listing reaches the canvas as CSS VOCABULARY ONLY, through `listing.css` and
  `entry-list.css` in `SHEETS`; neither export is in `ds-entry.tsx`. The two
  authored previews for the deleted components were orphaned for a while before
  anyone noticed, because a preview for something the entry does not export is
  never looked for and so never warns. They were deleted on 2026-09-21. If the
  listing is ever wanted as components, the entry is what changes first.

## The build

**RUN `npm run design:resync`. It is the whole command.** It rebuilds the two
guideline folders (`build-capsid-guidelines.mjs`, then `build-guidelines.mjs`),
regenerates the derived inputs and then runs the staged driver, in that order,
stopping at the first step that fails. Flags pass through, so `npm run design:resync -- --remote
<sidecar.json>` is the anchored run.

`scripts/ds-resync.mjs` exists because **`cfg.buildCmd` IS NOT A HOOK AND
NOTHING EXECUTES IT.** In the staged skill that key appears only in
`lib/common.mjs`'s list of known config names; the driver's build stage spawns
`package-build.mjs` directly. So `build-inputs.mjs` was a step a human had to
remember, and on 2026-09-21 a run went green against a `ds-styles.css` fourteen
hours older than its sheets: a superseded `public-chrome.css` compiled in, the
light header drew its wordmark white on paper at 1.06:1, and every grade
downstream measured that CSS and passed it. **A green verdict does not prove the
CSS entry was regenerated**, which is why the proof is now mechanical rather than
remembered:

- the wrapper regenerates first, so the forget path is closed by construction;
- the stamp beside the inputs records CONTENT HASHES of the sheets, the
  generator and the flatten. No gate reads it since ruling 150, so a driver
  invoked directly around the wrapper is no longer caught; use the wrapper.

The fix could not live in the driver: `.ds-sync/` is gitignored and re-copied
from the skill bundle every sync, so a patch there is gone at the next skill
version. If a future skill version does execute `cfg.buildCmd`, the wrapper's
stage 0 becomes a redundant no-op rather than wrong.

The generator writes three gitignored files: `ds-styles.css`,
`tsconfig.paths.json` and `readme-header.md`. Underneath, the driver runs

    node .ds-sync/resync.mjs --config .design-sync/config.json \
      --node-modules ./node_modules --entry .design-sync/ds-entry.tsx --out ./ds-bundle

which the wrapper supplies, and a flag given on the command line wins over it.
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
two arrived at the design agent as THE SAME COLOUR and the border-strong rule became
unfollowable. An agent cannot honor a distinction it cannot see.

Do not "fix" this by reordering the tier to win the scraper: a media block adds
no specificity, so the tier works only because it comes last, and moving it
would trade a wrong manifest for a wrong render.

## The bundle's faces swap, and the rewrite stays as a guard

**The sync ships `font-display: swap`, and the generator throws if an `optional`
face survives.** The grounds are the comment on `swapFontDisplay` in
`build-inputs.mjs`: `optional` kept every cold preview on the `Inter Fallback`
face (local Arial), and the wordmark drew regular-weight Arial while computing
Inter 700. Graded `needs-work` on 2026-09-23 on three cells; with `swap` they
drew Inter.

**The site moved to `swap` too, the same day**, for the same reason on first
visits (the comment on the Inter face in `app/app.css`). So the rewrite now
finds nothing and the generator logs `0 optional face(s) set to swap`. That is
expected, not a broken step. It stays because it costs nothing and catches the
site going back to `optional`.

## The `--surface-chrome` collision, and what it cost

The bar's token family was documented in `conventions.md` from the first sync,
under an "On chrome" heading: `--surface-chrome`, `--on-chrome`,
`--on-chrome-muted`, `--mark-on-chrome`, plus the standing rule that pinned bars
take `--border-strong`. The 2026-09 redesign invented `--bar-fill` anyway and
abandoned `--surface-chrome`, and that single substitution invalidated every
color in the header at once, because the surrounding tokens are measured
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
- `_ds_bundle.css fonts: N dead @font-face block(s) dropped` on every build.
  Also legitimate and slightly misreported: the working faces are in
  `fonts/fonts.css`, which `styles.css` imports FIRST, and the drop removes the
  duplicates that would otherwise shadow them. The converter's own drop regex
  backtracks around a quoted `./fonts/` url, which is why it fires at all.
  **N is one per shipped face, so it tracks the font count rather than being a
  fixed number**: it read 2 while Inter normal and italic were the whole set and
  reads 3 now that Source Serif 4 ships with them. A count that moved because a
  face was added is not a new warn.

## Preview authoring, learned the hard way

- `SiteLogo` and `SiteLogoHeader` forward `className` ONLY. They do not spread,
  so a `style` prop is silently dropped: a sizes cell written with inline widths
  rendered three identical marks. Size via a real class.
- Post content in the previews is real frontmatter from `content/posts/*.md`.
- The two entries here for `PostCard` and `Pagination` went on describing how to
  author their cells for nine days after PR #62 deleted both components, and the
  previews themselves survived alongside. Nothing warned, for the reason the
  scope bullet above now gives. A preview note outliving its component is the
  cheap version of this failure; the expensive version was the header.

## Verification environment

`playwright@1.61.1` is the version that pins chromium build 1228, which is what
is already cached in `~/AppData/Local/ms-playwright/`. Install it in `.ds-sync/`
with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; a different playwright wants a
different build and fails with `Executable doesn't exist`. The repo itself uses
puppeteer, not playwright, so there is nothing to reuse from its devDeps.

## Re-sync risks

- **`SHEETS` must match `root.tsx` and the non-admin imports, in both
  directions and including cascade order.** No gate holds it since ruling 150,
  so check it by hand when a route gains a sheet. Its one named exclusion is
  `katex.generated.css`. Ruling 111 has the grounds.
- The conventions header enumerates real token and class names. They were all
  verified against the built stylesheet on 2026-09-12 and again on 2026-09-21
  (34 tokens, 33 classes, all resolving); re-run that validation rather than
  assuming, since a renamed token would send the design agent vocabulary that
  resolves to nothing. **Two names fail that check ON PURPOSE and are not
  drift**: `--bar-fill`, which canvas-constraints.md names as the invented
  token that broke the header, and `aria-hidden`, which is an attribute.
- **The Capsid exports carry design law the repo does not.** Rulings 122, 123
  and 124 (the closed color system, Paper and Plate, light touches only glass)
  reach the canvas ONLY through
  `guidelines/capsid/TASK-redesign-brief-2026-09.md`, because no
  `decisions-vol-*.md` is an exported document and conventions.md does not
  restate them. Two consequences: `build-capsid-guidelines.mjs` must run before
  a sync or the export directory is missing (the wrapper runs it first), and a ruling added to the volume after a sync is invisible to the canvas until
  someone patches the brief. That is how a job built a figure haze in PR #57
  that ruling 124 forbids.
- The `.d.ts` contracts come from source `.tsx`, not from shipped types, because
  there are none. A prop rename in `app/components/` is picked up on rebuild;
  nothing warns that it changed.

## The preview cards, and the short README (2026-09-23)

The Design System pane's visual index is built from preview cards, HTML files
whose FIRST LINE is `<!-- @dsCard group="..." -->`, compiled into
`_ds_manifest.json`. The converter only emits one per synced component, which
here is the two logo crops, and the README it generated carried the two long
notes, so the pane read as text. Two changes fixed that:

- **The README header is `readme.md`**, the approved visual system's own short
  README plus a pointer. `canvas-constraints.md` and `conventions.md` are copied
  into `.design-sync/guidelines/` by `build-inputs.mjs` and ship as guidelines.
- **`build-cards.mjs` renders the cards** from the site's stylesheets and
  components (`cards.tsx`): Colors, Type and Components, one card per directory
  under `.design-sync/.cache/cards/`. `design:resync` copies them to
  `ds-bundle/cards/` after the driver, and `cards/<group>/<slug>/<slug>.html` is
  build-owned in the upload scope below.

**HOW THE CARDS UPLOAD.** The driver's partitions (components, bundle, styling,
aux) know nothing about `cards/`. The card digest is written into the README
header, so a changed card changes the README and flips `upload.aux`, and when
it does, `ds-resync.mjs` adds `upload.cards` to the verdict: the list of card
files to upload WITH the docs. An upload that follows the partitions alone
leaves the cards behind, so when `upload.cards` is present, upload every path in
it.

**AFTER THE UPLOAD, OPEN THE PANE.** List the project and read
`_ds_manifest.json`: every card should be under `cards`. A known issue
(anthropics/claude-code #85733) is that cards uploaded through DesignSync may not
appear until the manifest is recompiled; the legacy fallback is
`register_assets`. Record what was needed here when it happens.

## THE UPLOAD WRITES AND DELETES ONLY WHAT THE BUILD OWNS, AND CODE SAYS SO

Since ruling 137 (2026-09-23) the design system project holds only the design
system; the page mockups moved to their own projects, and where they live is in
`canvas-constraints.md`, which is what the design agent reads. What the sync
must never touch in THIS project is `templates/visual-system/`, the approved
visual system made on the canvas, and `github.md`.

**That is enforced in code, not by this paragraph.** `scripts/lib/ds-upload-scope.mjs`
is an allowlist of the paths the build owns; `npm run design:resync` applies it
to the driver's verdict before printing it, and a plan that writes or deletes
anything else comes back `ok: false, upload: null` with the refused paths in
`uploadScopeRefused`, and exits 1. The skill does not upload from that verdict.

**A plan built by hand is checked by hand:** a no-anchor sync takes its deletes
from a reviewed `list_files` rather than from the diff, and the skill's own
instruction there, to delete "files this build doesn't produce", would name the
templates by construction. Put the plan's writes and deletes in a JSON file
under `.design-sync/` and run `node scripts/lib/ds-upload-scope.mjs <file>`
before `finalize_plan`; exit 1 names every refused path.

The written list this replaced (`part-a/`, `part-b/`, `part-c/`, `references/`,
`uploads/`, `github.md`) lagged the canvas by a whole directory for days in
September, which is why the rule is now "only what the build owns" rather than
"never these".

## Where the guidelines land, and why they are nested

`guidelinesGlob` matches repo paths and the upload keeps the repo subpath, so
`.design-sync/guidelines/chrome-and-bars.md` arrives as
`guidelines/.design-sync/guidelines/chrome-and-bars.md`. That is three
directories of noise in front of every file a design agent is meant to read.

The mechanism is in `lib/docs.mjs`'s `emitGuidelines`: the dest keeps the
PKG_DIR-relative subpath, and collapses to `basename(p)` only for a file outside
the package. PKG_DIR is this repo root, so everything under `.design-sync/`
keeps three directories of prefix. Changing `guidelinesGlob` cannot fix it: the
glob selects WHICH files go, not where they arrive.

**DONE on 2026-09-21, and here is the shape so the next sync keeps it.** The
flatten is a post-build step on the bundle, not a config change: after the
driver run, move `ds-bundle/guidelines/.design-sync/guidelines/*` up to
`ds-bundle/guidelines/` (capsid subdir included), remove the emptied
directories, and REWRITE `guidelines/index.md`, which the emitter generated with
the nested hrefs and which otherwise points the design agent at paths that no
longer exist. The upload then preserves the flat paths verbatim. The eight old
nested paths were deleted in the same plan, on Dustin's explicit approval, since
an anchored diff cannot derive them; `guidelines/**` is build-owned in the upload
scope above and has never held canvas work. A future converter version that flattens on its
own makes this step a no-op rather than wrong.
