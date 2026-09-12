/**
 * The design-sync bundle entry.
 *
 * NOT a component library. This repository is an application, so there is no
 * `dist/` to point the converter at: this file is the entry it bundles, and it
 * does one thing, re-export the real components from `app/components/`. Nothing
 * here reimplements anything, which is the converter's own rule.
 *
 * WHAT IS SCOPED IN, and it is a deliberate subset. Both files export only
 * presentational markup and read no route data, so they render standalone. The
 * rest of `app/components/` does not: `site-header` and `site-footer` are page
 * singletons, and `theme-toggle`, `ask-panel`, `search-trigger`,
 * `blog-enhancements`, `site-speculation` and `enhancement-script` exist to
 * inject the nonced enhancement bundles hard rule 4 requires, which is not a
 * thing a design agent composes with.
 *
 * `MemoryRouter` is re-exported for `cfg.provider` alone: `PostCard` and
 * `Pagination` render react-router `Link`s, which throw outside a router. It is
 * excluded from the component list by `componentSrcMap`.
 */

export { PostCard, Pagination } from "~/components/post-card";
export type { CardPost } from "~/components/post-card";
export { SiteLogo, SiteLogoHeader } from "~/components/site-logo";

export { MemoryRouter } from "react-router";
