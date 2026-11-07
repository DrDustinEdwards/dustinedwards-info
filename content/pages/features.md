---
path: /features
title: "Features"
seo_title: "Features of the Dustin Edwards network"
description: "What this site and the programs behind it do: writing and publishing, charts, design, agent memory, hosting and backups."
schema_type: WebPage
---

This site is one of several that share a set of programs. This page lists what the whole network does, grouped by job. Each entry names the program that does it. For how this one site is built, see the [colophon](/colophon). For how the programs connect, see the [systems map](/systems).

## Writing and publishing

- **Drafts that stay yours.** [Carrel](/software/carrel) is the private place where articles, books and manuscripts are written. An AI's draft is saved beside the author's and never replaces it, and checks and reviewers flag problems rather than decide them.
- **Publishing by role.** Carrel publishes to every site through one shared API (site-api). Making a post public for the first time is reserved to the owner, and publishing through an AI tool is refused while a flag is open.
- **Previews from the live renderer.** A preview is drawn by the site's own pipeline, so it matches what readers get.
- **Scheduled updates to live posts.** A change to a published post can be set to apply later, and each site applies it from its own schedule.
- **Books.** Carrel reads a private manuscript repository as books, chapters and scenes, checks continuity and timeline on save, and exports to ePub and Word.
- **One markdown pipeline.** Prelum renders every site's markdown the same way: figures with required alt text, galleries, captioned video and audio, callouts, math, highlighted code, diagrams, and charts. An image with no alt text is refused.
- **A markdown copy of every page.** Prelum serves each page's source as markdown, and the same URL with an Accept header for markdown returns it. Each site also publishes `llms.txt` and `llms-full.txt`.
- **Feeds and sitemaps.** RSS, Atom and JSON feeds, sitemaps that list each page's images, and IndexNow pings when a page changes.
- **Search that finds your writing.** Sites with a database search it with SQLite full-text search; sites without one ship a small index to the browser.
- **Structured data and crawler rules.** Prelum writes the page head, schema.org markup, `robots.txt` and `ai.txt`, so every site says the same thing to search engines and AI crawlers.

## Charts and figures

- **Charts drawn on the server.** [Enarratio](/software/enarratio) draws a chart into the HTML, so it shows without JavaScript and search engines can read it.
- **Every chart has words and numbers.** Each chart carries a text alternative its author writes and an equivalent data table.
- **Light and dark from one chart.** Colors come from the theme's stylesheet, so a chart follows light and dark mode without a redraw.
- **Charts in other frameworks.** `enarratio-astro` puts the same charts in Astro pages and Markdown, and `enarratio-emdash` adds a Chart block to EmDash's editor.

## Design

- **One design system.** [Capsomer](/software/capsomer) holds the color tokens, the page shell and the components every app and site is drawn with, in plain CSS.
- **Shared parts.** The header, the footer, forms, tables, dialogs, menus, chart frames and the map of systems are Capsomer's, so a fix lands in every site at once.
- **Light, dark and higher contrast.** Every color is a token with a light, a dark and a higher-contrast value, and a check measures the contrast of every pair.
- **A look for each job.** This site and its centers share one look. Products such as Foxhound and Foxing keep their own, built from the same parts.

## Agent memory and work

- **A knowledge base for AI agents.** [Capsid](/software/capsid) stores versioned documents in namespaces, with typed links between them and search by keyword and by meaning. An agent starts each session with what earlier sessions settled.
- **A queue of signed jobs.** Work goes from a conversation to a working session as a signed job that ends in a pull request. Capsid records what the agent reported next to what GitHub confirms.
- **Scoped access.** Each agent has its own key and its own list of allowed actions, checked in one place. Capsid reaches GitHub through an App, so it holds no long-lived GitHub token.
- **An audit log.** Every write is recorded with who made it.
- **Run the sites from a chat.** Each site has an admin server the owner can use from a conversation to check health and work with the site's registries, procedures, citations, users or catalog. Writing stays in Carrel.
- **The Portal and the explorer.** The Capsid Portal is the owner's dashboard. A public explorer draws the network of systems from Capsid's public data.
- **A study of its own use.** A public harness compares Claude Code with and without Capsid on the same tasks, scored on hidden tests.

## Hosting and safety

- **Security headers on every site.** site-runtime sets the content security policy and the other headers, with a report endpoint.
- **Rate limits and sign-in.** One rate limiter and one sign-in flow are shared, with Cloudflare Access in front of the admin areas.
- **A health report.** Each site answers `/health` in one format, and Capsid watches it and repairs drift.
- **Images and speed.** Responsive images, link prefetching, preloads and an edge page cache come from the same package, so every site is tuned the same way.
- **Per-table backups.** d1-dump copies each table of a site's database to the site's own storage on a schedule, restores into a copy you can inspect first, and reports the age of the newest backup to the health page. It works where D1's own export does not, on databases with full-text search.
- **A second copy off the account.** Capsid's daily database exports are mirrored off Cloudflare, so losing the Cloudflare account does not lose the store.

## Building and checking

- **One set of checks.** devkit holds the shared test workflows and update rules. Every repository runs the same pull request checks: workflow audits, dependency scans, bundle size, a check against code bloat and an automatic reviewer.
- **A shared-code check.** It fails a repository that copies something a shared package already provides, so a fix is made once.
- **Deploys that roll back.** A deploy to a Worker is checked live and rolled back if the site refuses it.
- **Accessibility checked in the build.** Contrast, alt text, keyboard use and reading without script are tested, and the [accessibility page](/accessibility) names each check.

## The sites

- **This site.** Research, teaching, writing, the phage and lab registries, protocols, calculators, publications with BibTeX and RIS downloads, and a CV with its charts and PDF.
- **Products and other sites.** [Foxhound](/software/foxhound), [Foxing](/software/foxing), [Foxing Edu](/software/foxing-edu), [Germomics](/software/germomics) and others build on the same programs. The [software page](/software) lists them.
