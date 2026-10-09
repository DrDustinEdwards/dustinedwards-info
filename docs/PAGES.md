# Pages: the Research, Teaching and Software prose pages, and About

The prose pages are files in `content/pages/`, the source with its history (job_dc67fd83c24b). `npm run
sync:content` and the page save write each into the D1 `pages` table, and the page, its markdown twin, its
sitemap entry and its search records are drawn from that row at request time, so a content edit goes live
without a build or deploy. Only a change to the components, the registry or this format goes through a
build.

There is ONE write path: Carrel saves a page through site-api's adapter (`page.<slug>` in the `/content`
group, handler `app/lib/carrel/page-handler.server.ts`). There is no admin editor and no operator save tool.
The operator can read: `list_pages` and `get_page`.

## The file

`content/pages/<key>.md`: a YAML front-matter header, then markdown. The key is the path with slashes as
hyphens (`/research/phages` is `research-phages.md`). The CV has its own files and its own table (`docs/CV.md`)
and no file or row here. `research-phages.md` is the one page whose table and per-phage sections are drawn from
other files (`content/phages/`, `docs/PHAGES.md`) at the two markers it carries.

```markdown
---
path: /software/foxhound         # must be the registered path for this file's key
title: "Foxhound"
seo_title: "Foxhound: failed Stripe payment recovery"   # at most SEO_TITLE_MAX characters
description: "One sentence, at most DESCRIPTION_MAX characters."
draft: true                      # optional. true: never public; a signed-in admin sees it
schema_type: SoftwareApplication # optional: SoftwareApplication | SoftwareSourceCode | WebSite | WebPage | Dataset
product_url: https://foxhoundapp.com
application_category: WebApplication
---

## A heading

Markdown, rendered by the site's own pipeline with the URL allowlist applied.
```

Only what the front matter states reaches the JSON-LD; the page never fills a gap.

## About

About is a page row too (`content/pages/about.md`, path `/about`, slug `about`), not a separate kind: the
same file format, compile, save, sync, drift check, repair and `page.about` handler carry it, so an About
edit saved through Carrel is live at the next request with no deploy. What is different is that it has a
route and a layout of its own (`app/routes/about.tsx`: the photo, the ProfilePage JSON-LD, the page head),
so its path is in `CONTENT_PAGES_OWN_ROUTE`, not in `CONTENT_PAGE_PATHS`. `PAGE_FILE_PATHS` (both lists) is
what a file in `content/pages/` may name. That keeps About out of everything the listed pages get: no
markdown twin, no search record, no social card, no llms.txt rule. Moving it onto D1 changed where its
prose is kept and nothing a visitor or a machine reads. The only response change is the cache tag, which is
now `pages,content-pages` so a page save can purge it.

Its front matter is the same as any page's, and `seo_title` is what the page's `<title>` and og:title say
(it was written in the route before). The shared validator holds it to what check:content and check:links
held: title, seo_title and description present, the URL allowlist, no wide dash, no image, and at least
`ABOUT_HTML_FLOOR` characters of rendered HTML (a blank About would otherwise be a successful build). A
draft About is the signed-in admin's alone and leaves the sitemap; the header menu still links it.

## The legal pages

`/privacy` and `/terms` are pages like the rest, so Carrel edits and publishes them (`LEGAL_PAGE_PATHS` in
`app/lib/content-pages.mjs`). Only they may state two more front-matter fields, which Carrel writes:

- `banner: Draft`: the single word, nothing else (`LEGAL_BANNER`). The layout draws it under the title for every
  reader, and the markdown twin carries it as its own line.
- `last_updated: 2026-10-06`: a real day. The layout draws "Last updated <date>", the twin repeats it, and the
  page's JSON-LD node (where the page has a `schema_type`) carries it as `dateModified`. The day is read from the
  front matter as written, because YAML would roll `2026-02-30` over to March.

Any other page stating either field is refused. `/privacy`'s wording is the page the TSX route used to hold;
every sentence of it is meant to be derivable from the code, and no retention period is stated that the code does
not own.

`/terms` can never be unpublished or deleted (`app/lib/pages/protected.mjs`): it is the dataset license behind
`TERMS_PATH`, the `Link: rel="license"` header on every download and the `license` of every Dataset. A file with
`draft: true` fails the compile (so CI, the sync and every save refuse it), `deletePageRow` refuses to remove its
row (so `sync_pages` cannot), and `sync:content` refuses to run without a published file for it. Each refusal
names the reason.

## What a save cannot do

A page's ADDRESS is structure. `CONTENT_PAGE_PATHS` (`app/lib/content-pages.mjs`), the header menu's
anchors (`CONTENT_PAGE_SECTIONS`), the nav, the footer and the layouts stay in code. A save cannot create a
new path: an id no registered path names is refused, and the refusal says so. Adding a page is a code
change (a path in the registry, then a file), which goes through a build.

## What a save is held to

`app/lib/pages/compile.mjs` is the one door from a file to everything derived from it. `build:content`,
`sync:content` and the page save all call it, so a file CI passes is the file a save accepts. It checks:

- the front matter: the registered path, `title`, `seo_title`, `description`, their lengths, `draft`, the
  schema.org fields;
- the prose: no wide dash, and no link the URL allowlist refuses;
- the header menu's anchors still exist as headings;
- `app/lib/pages/invariants.mjs`, the rules that used to be CI tests reading the files: each calculator
  page states what its calculator prints, the tools index and the FAQ link every calculator, the FAQ's
  lysate-per-plate sum, the phage table (every phage in the record's order, six columns, a PhagesDB link
  only at a verified record, a `###` section per phage), and the named software pages (their name sections,
  the Capsid Portal sentence, the Carrel page naming neither its address nor its repository).

`app/lib/pages/links.mjs` then judges the internal links against what D1 holds: a link into the Research,
Teaching, Software, recipe or writing namespace that names nothing in it, a path the site answers 410, a
draft post, an anchor a page lacks. A link into any address it cannot list completely passes here and is left
to `check:links`, the full gate. `test/pages.test.mjs` shows each rule firing.

## The save

`app/lib/pages/save.server.ts`, mirroring the procedures' save: validate (the code above) then policy then
`commitUnlessUnchanged` then verify the committed bytes then the D1 write through `convergeWithRetry` then a
cache purge by tag (`content-pages`).

- A byte-identical file is never committed. If D1 already holds its row the save stops; if not it repairs the
  row from the file without a commit.
- Hard rule 18: the repository file is the source and D1 is derived. A failed D1 write never reverts the
  commit; the error says the commit landed and the repair is the content sync, which converges the row from
  the repository at the next ship.
- The sync reads the same files with the same compile, so it never overwrites a save: a save is a commit on
  `main`, and the sync builds from `main`.

## Where it goes

| Output | From |
| --- | --- |
| The page | `app/routes/content-page.tsx` (and `teaching.tsx`, `software.tsx`), drawn from the D1 row; About is `app/routes/about.tsx`, drawn from its row |
| The markdown twin | `app/routes/content-page[.md].ts`, one route per listed path; the CV's twin is `app/routes/cv[.md].ts` (docs/CV.md) |
| The sitemap entry | `app/routes/sitemap.ts`, published rows only, in the registry's order (About keeps its place among the static paths, listed only while its row is published) |
| JSON-LD | `contentPageJsonLd`, from the record |
| Search | `search_docs`, written by the sync and by the page save, from the same compile |
| The check | `build:content` compiles every file with the save's own validator; `check:links` judges every link |

A static file at a twin's address would win over the route, so `build:content` deletes any left from an
earlier build.

## Known limits

- The social cards of the Software and Tools pages (`build:og`) are drawn at build time from the page's
  title, so a saved title change leaves the card stale until the next build, as a post's `og_image` can.
- A Carrel preview of a page is not offered: the kind has no `preview` handler.
- The first deploy needs the rows in place: apply migration 0021, then `npm run sync:content -- --remote`
  BEFORE the ship, or the prose pages answer 404 between the deploy and the sync. The old Worker ignores the
  table.
- About moved onto this table later (no migration: the table already existed). Run `npm run sync:content -- --remote`
  BEFORE the ship that carries it, or `/about` answers 404 between the deploy and the sync. The old Worker serves
  its own compiled copy, so syncing first is safe.
