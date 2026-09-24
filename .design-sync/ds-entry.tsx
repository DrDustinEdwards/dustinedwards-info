/**
 * The design-sync bundle entry.
 *
 * NOT a component library. This repository is an application, so there is no
 * `dist/` to point the converter at: this file is the entry it bundles, and it
 * does one thing, re-export the real components from `app/components/`. Nothing
 * here reimplements anything, which is the converter's own rule.
 *
 * WHAT IS SCOPED IN, and it is a deliberate subset. Both exports are
 * presentational markup that reads no route data, so they render standalone.
 * The rest of `app/components/` does not: `site-header` and `site-footer` are
 * page singletons, and `theme-toggle`, `ask-panel`, `search-trigger`,
 * `blog-enhancements`, `site-speculation` and `enhancement-script` exist to
 * inject the nonced enhancement bundles the no-framework-script rule requires, which is not a
 * thing a design agent composes with.
 *
 * WHY `PostCard` AND `Pagination` LEFT, 2026-09-21. The canvas was handed them
 * as components to build with, on the same README that said in its deleted list
 * that they and their router wrapper were gone. A design agent cannot act on a
 * page which contradicts itself, and the vocabulary is the half that is
 * current: Direction D's listing is ruled rows, not cards.
 *
 * PR #60 wrote the other half of that sentence: they were still live on /blog
 * and its archives, so "the components go when those pages do". THIS IS THOSE
 * PAGES. The listing is ruled rows, `post-card.tsx` is deleted, and what the
 * README always said is finally true of the code.
 *
 * `MemoryRouter` went with them, and they were its whole reason for being here:
 * it was re-exported for `cfg.provider` alone, because those two rendered
 * react-router `Link`s that throw outside a router. Nothing left in this entry
 * imports react-router, so the provider is gone from the config too.
 */

export { SiteLogo, SiteLogoHeader } from "~/components/site-logo";
