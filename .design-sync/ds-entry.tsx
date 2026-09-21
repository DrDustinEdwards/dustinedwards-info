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
 * inject the nonced enhancement bundles hard rule 4 requires, which is not a
 * thing a design agent composes with.
 *
 * WHY `PostCard` AND `Pagination` LEFT, 2026-09-21. The canvas was handed them
 * as components to build with, on the same README that said in its deleted list
 * that they and their router wrapper were gone. A design agent cannot act on a
 * page which contradicts itself, and the vocabulary is the half that is current:
 * Direction D's listing is ruled rows, not cards. They are still live in the app
 * on /blog and its archives, which have their own Part B jobs; the components go
 * when those pages do.
 *
 * `MemoryRouter` went with them, and they were its whole reason for being here:
 * it was re-exported for `cfg.provider` alone, because those two render
 * react-router `Link`s that throw outside a router. Nothing left in this entry
 * imports react-router, so the provider is gone from the config too.
 */

export { SiteLogo, SiteLogoHeader } from "~/components/site-logo";
