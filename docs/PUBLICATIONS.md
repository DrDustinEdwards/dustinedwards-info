# Publications: the papers, as files

One file per paper (the publications job, 2026-10-01). A paper is a file in `content/publications/`, the
source with its history. `npm run sync:content` and the Carrel adapter's save write it into the D1
`publications` table, and its pages are drawn from that row at request time, so an edit goes live without a
build or deploy. Only a change to the components or to this format goes through a build.

There is no editor for publications in the site's admin and no `save_publication` operator tool. A paper is
written through Carrel and `@dustinedwards/site-api`, as a post is (hard rule 18: the file is the source, D1
is derived). The operator API reads: `list_publications`, `get_publication`. It also has `refresh_citations`.

## The file

`content/publications/<slug>.md`. The slug is the DOI's: lower-cased, every run of punctuation a hyphen,
trimmed (`10.1128/mra.00888-24` is `10-1128-mra-00888-24`). It is the page address
(`/research/publications/<slug>/`, trailing slash kept for Scholar), the file name, and the id Carrel sees:
`publication.<slug>`. It never changes after Google Scholar has indexed it, so the file is never named for
the curated `id`.

```markdown
---
doi: "10.1128/mra.00888-24"
id: "edwards-2025-godfather"
draft: false
type: "article"
title: "Complete genome sequence of microbacteriophage Godfather"
authors:
  - "Dustin Edwards"
  - "..."
journal: "Microbiology Resource Announcements"
publishedDate: "2025-02-20"
volume: "14"
issue: "2"
pages: "e00888-24"
topics:
  - "bacteriophages"
access: "self-hosted"
pdfPath: "/research/publications/10-1128-mra-00888-24/dustin-edwards-10-1128-mra-00888-24.pdf"
pdfSha256: "..."
pmid: "..."
isOpenAccess: true
license: "cc-by"
licenseSource: "unpaywall:best_oa_location"
summary: "One plain-language sentence, under 200 characters."
selected: false
accessions:
  - kind: "genbank"
    id: "PQ..."
abstract: "..."
csl:
  DOI: "10.1128/mra.00888-24"
  ...
---

## Full text

The text extracted from the PDF, as the twin prints it.
```

Every string is double quoted (YAML's double-quoted style is a superset of JSON strings), so no value can be
read back as a date, a boolean or a number it was not. `scripts/extract-publication-text.mjs` writes the
file's `pdfSha256` and its Full text section from the PDF; `app/lib/publications/serialize.mjs` is the one
writer of the format.

| Field | Meaning |
| --- | --- |
| `doi` | As deposited, case kept. Absent only for a manuscript (`status: submitted`). |
| `slug` | Written only for a manuscript with no DOI to derive it from; it must equal the file's name. |
| `id` | The curated id, also the BibTeX key. Unique. |
| `status` | `published` (the default) or `submitted`: a manuscript under review has no DOI, no PDF and no Scholar tags. |
| `draft` | `true`: never public. Absent from the index, the exports, the sitemap and search; its page and twin answer 404. |
| `type` | `article`, `review`, `chapter`, `abstract` or `teaching-resource`. |
| `title` | Decoded, with no quotation mark (the paper's Ask link quotes it) and no `<`. |
| `authors` | Every author, none blank. A shortened list is a wrong citation. |
| `publishedDate` | `YYYY-MM-DD`, `YYYY-MM` or `YYYY`, at the deposited precision. The year comes from it (`year:` only for a manuscript with no date). |
| `topics` | At least one of the ids in `app/lib/publications/topics.mjs`. |
| `access` | `self-hosted` (the PDF is in the repository) or `external`. |
| `pdfPath` | Must equal the derived path: the PDF sits in its own page's directory, which Scholar needs. The save checks that the file exists in the repository. |
| `pdfSha256` | The hash of the PDF the Full text was read from. CI checks it against the file. |
| `license`, `licenseSource` | A hosted paper needs a redistribution licence, or its DOI named in `app/lib/publications/hosting.mjs` (Dustin's call, per DOI). |
| `summary` | One sentence, under 200 characters, no em or en dash. Optional; absent is a state. |
| `accessions` | Read from the paper's own data-availability statement and reconciled against the Full text in both directions. |
| `updateNotice` | A retraction, correction or expression of concern: `{ type, doi, date }`. |
| `abstract` | As deposited. No `<`. |
| `csl` | The raw Crossref record, for the `.json` export. |

The PDFs are not uploaded by this tool. They are static assets under
`public/research/publications/<slug>/`; adding one is a git push, and the save refuses a file whose PDF is not
in the repository.

## The Full text section, and why it is in the file

A hosted paper's extracted text is in the file body under `## Full text`, not in a D1 column and not in a
second file. The file is then the whole source of the twin: a reviewer reads one diff, the save needs no second
read, and `check:machine-readable` binds the text to the PDF through `pdfSha256`. The twin is stored whole in the
row's `markdown` column, so the page query never reads it.

## What validates it

One module, `app/lib/publications/validate.mjs`, with the derived checks in `compile.mjs`, is called by
`check:machine-readable` (every file), by `build:content` and `sync:content`, and by the Carrel adapter's
save. A file CI passes is a file the save accepts. Every message starts with the field path, no leading dot:
`authors[2]: is empty`. It holds: DOI shape and case-folded uniqueness, the slug rule and its length with the
`publication.` prefix (200 characters at most), unique ids, the vocabulary, access and `pdfPath`
consistency, the PDF in the repository and its hash, the Full text, PMC forms, the summary rules, the notice
shape, the accession reconciliation, the licence rule, and for every record the Highwire tag set, the BibTeX
and RIS exports, the twin, the search record and the Ask key.

CI adds what needs the repository or the whole corpus: the redirect map (the 31 papers once published at a
flat PDF path keep their redirects; a newer paper owes the map nothing), the cited-by snapshot, `llms.txt`,
and the build's artifacts.

## The write path

`savePublication` (`app/lib/publications/save.server.ts`), the structure of `savePost` and `saveProcedure`:

1. validate with the module above (a refusal is a 422 with every message, and nothing is committed);
2. policy: Carrel's key may publish for the first time (Carrel design decision 2); a record saved with
   `saveDraft` that is new starts as a draft, and one that is live stays live;
3. `commitUnlessUnchanged` (`app/lib/editor/write-path.server.ts`): a byte-identical save commits nothing;
4. the committed blob is checked against the compiled bytes;
5. the D1 row, the paper's search record and the FTS rebuild are written in one batch, through
   `convergeWithRetry`, and a failed write never reverts the commit (the error says how to repair it);
6. the cache purge by tag (`publications`, and `posts` for the home and search pages), and the paper's twin in or
   out of the Ask index.

## Where it goes

| Output | From |
| --- | --- |
| The index, a paper's page | `app/routes/publications.tsx`, `publications.$slug.tsx`, drawn from the D1 row |
| `.bib`, `.ris` (all and one), `.json` | the same rows; `.json` is the raw Crossref records, unfiltered |
| The markdown twin | `/research/publications/<slug>.md`, the row's `markdown`, from `twin.mjs` |
| Search | `search_docs` `paper:<slug>`, written by the save and by `sync:content` |
| Ask | each published twin, keyed `research/publications/<slug>.md` |
| The sitemap, the home page | the same rows |
| The CV page, its charts and its markdown | the `publications` table, read per request and joined to the CV by DOI (docs/CV.md), so a corrected paper reaches the CV with no deploy; the CV's search records are rewritten by the save. Its PDF is still rendered at build time |

## Citation counts

`publication_citations` (D1, keyed by the lower-cased DOI, no expiry) holds the last count read from OpenAlex.
A page shows it whatever its age, and refreshes a row older than seven days after the response; a failed
refresh keeps the count and logs `citation-count-failed`. It is seeded by `sync:content` from
`data/publications.cited-by.json` (forward only) and refreshed weekly: the watchdog's `scheduled()` calls the
operator tool `refresh_citations` in the Sunday 03:00 UTC firing, so the site Worker needs no cron of its own.
A partial failure is a 502 naming each DOI.

## Adding a paper

Carrel writes the file; a person pushes the PDF first
(`public/research/publications/<slug>/dustin-edwards-<slug>.pdf`) and runs
`node scripts/extract-publication-text.mjs <slug>` for `pdfSha256` and the Full text. A manuscript with no DOI yet
is `status: submitted`, `access: external`, with an explicit `slug`, and no PDF. After the paper is in,
`content/llms.txt` still lists the twins by hand, and `node scripts/fetch-cited-by.mjs --write` adds it to the
cited-by snapshot.
