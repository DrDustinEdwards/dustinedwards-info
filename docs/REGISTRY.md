# The lab registry

The reference catalog of the lab's primers, strains, reagents and equipment (job_915d43f44cee). It is built the way
phages and procedures are: a record is a file in the repository, the file is the source, and D1 holds a derived copy
that a save and `npm run sync:content` write. A record is edited with no build and no deploy. This document is the
framework and the kinds built on it. The framework shipped with no kind and no record; each kind arrives with its own
records, pages and catalog tab in its own change. Defined so far: **primer**, **strain**, **reagent**.

Out of scope, on purpose: stock counts, storage locations and sample data. The registry says what a thing is, never
how much of it the lab has or where it sits.

## The file

`content/registry/<kind>/<id>.md`: a YAML front-matter block and nothing else (a body is an error).

```markdown
---
name: M13 forward
draft: true          # optional; absent means published
sequence: ...        # then the fields the kind declares, and no others
---
```

- `<kind>` is a key of `KINDS` in `app/lib/registry/kinds.mjs`. A directory under `content/registry/` that is not a kind
  fails the build.
- `<id>` is lower-case letters, digits and hyphens (`ID_PATTERN`), at most 63 characters. It is the item's address,
  `<kind>/<id>`, and a URL segment as written.
- `name` is required: one line, trimmed, at most 120 characters. Two items of a kind cannot share a name (folded, so
  case and accents do not make two).
- `draft: true` makes the item a draft (visible to a signed-in admin only), as it does for a page.
- Every other field belongs to the kind. A field the kind does not declare is refused with the list it does, so
  nothing enters the repository or D1 that a page would not show.

### A value nobody has yet

Written `"MISSING: <why it is missing>"`, in place, never filled with a guess, as in a procedure. The validator
accepts it, skips the kind's check for that field, records it as a gap, and `get_registry` and `check:content` list the
gaps, so what is waiting for Dustin is found, not hunted. A bare `MISSING` fails.

## The table

`registry` (`drizzle/0028_registry.sql`), one row per item, primary key `(kind, id)`. The shared columns are what every
kind has: `kind`, `id`, `name` and `status` (`published` or `draft`, read from the file's `draft` flag). Everything a
kind states beyond that is `record`, the kind's own fields as JSON, validated by the kind. The name and the status are
columns only, so nothing is stored twice. `source_path` and `source_blob_sha` are the drift marker (hard rule 18: the
repository is the source, the row is derived, and a failed row write never reverts the file).

Phages keep their own table and page. A page that lists every item (the master inventory) reads the registry and the
phages table side by side; it never copies a phage.

## A kind

A kind is data (`KindSpec`): its `singular` and `plural` words, its `fields`, and optionally `setErrors` for rules only
the whole set can state. A field is `{ required?, check(value, { host, data }) }`, where `check` returns a message or
null and may be async (a field that names a publication asks `host.paper`). The compile, the save, the sync, the drift
check, Carrel's handler and the operator's tools all read the one `KINDS` object, so a kind added there is served by every
one of them with no change to them.

## The primer kind

`app/lib/registry/primer.mjs`, twelve records in `content/registry/primer/`, each stating only what the lab's protocols state:
`sequence` (as stored, upper-case IUPAC), `direction`, `target`, `set`, `reference` (the GenBank accession it is placed on, a
file in `data/references/`), and what the literature says: `published_in` (citation), `published_doi` or `published_url`,
`published_name` (the paper's own name for the primer), `published_sequence` (as the paper prints it) and, on a forward primer
only, `published_product` (the size the paper states). Every `published_*` field is required, and a fact that could not be found in
a paper that could be read is `"MISSING: <why>"` (paywalled, not stated); nothing is filled from memory or inferred. A printed
sequence that differs from the stored one is shown as different and reported, never corrected. A kind's page of its own is
`/research/lab/primers`, an item is `/research/lab/primers/<id>`, and the master inventory is `/research/lab`, which also
lists the phages by reading their own table and never copying a row. Every registry page has a markdown twin at its path
plus `.md`.

**Computed, never stored:** length, GC content, reverse complement, Tm, GenBank positions, a pair's product size, and the
protocols that use a primer (read from the protocols, which name their primers by id). Tm (`app/lib/registry/tm.mjs`) is the
SantaLucia (1998) nearest-neighbour model at 50 mM monovalent cation and 0.5 uM primer, stated on every page that shows one;
it is held to Biopython's `Tm_NN` to a thousandth of a degree (`test/registry-tm.test.mjs`) and is null for a sequence with an
ambiguity code. It is labelled an estimate for comparing primers (protocols.md, 2026-10-04), every primer page links NEB's Tm
Calculator for the polymerase-specific annealing temperature, and no page presents the computed Tm as an annealing temperature.

### Protocols read their primers from the registry

A protocol's `primers` is a list of `{ primer: <id> }` and nothing else: a primer's sequence, direction and set are stored once,
in the registry, and the protocol file and its body hold none (`test/registry-primers.test.mjs` fails if one appears). The
procedure compile (`app/lib/procedures/compile.mjs`) reads the named primers from the repository (the Worker through
`app/lib/registry/host.server.ts`, Node through `scripts/lib/registry.mjs`), refuses an id the registry does not hold, a primer
listed twice, a draft primer in a published protocol and any other field, and bakes the registry's facts into the protocol's
record. So the page's Primers section, the bench sheet, the markdown twin, the search record and a frozen version all print one
sequence, and a version freezes the sequence it was published with.

A record derived from another store has to follow it: a registry save and `sync_registry` recompile every protocol that names
the changed primer from its file and rewrite its row (`app/lib/procedures/primer-dependents.server.ts`), and `sync:content` at
ship rewrites them all. A protocol that no longer compiles with the change (the primer was deleted or made a draft) stops the
save with an error that names it. Known gap: a registry primer edited through git is not seen as drift on the protocol until
`sync_registry` or the next ship runs, because the protocol's own file did not change.

### Positions and product sizes are computed on a reference

`data/references/*.fasta` are NCBI's own FASTA records, header kept (a slice is `ACCESSION.v:from-to`, and positions are
reported in the accession's own coordinates). `npm run build:references` generates the gitignored
`app/lib/registry/references.generated.mjs` from them (`build:content` and `postinstall` run it). `app/lib/registry/align.mjs`
places a primer on its reference with the existing site finder (`app/lib/primers.mjs`): the fewest mismatches first, up to
`MAX_MISMATCHES`, each reported, never absorbed; `pairProducts` gives each product from the forward primer's 5' end to the
reverse primer's 5' end (a pair that binds twice, as the two LTRs of a provirus do, makes a product at each site). A reference
is genomic unless a protocol amplifies cDNA: the GAPDH pair sits on the chicken gene region (NC_052532.1), with the turkey
region as a check only. Protocol prose no longer types a product size for the REV, LPDV and GAPDH sets; their Primers tables
show the computed size. `test/registry-primers.test.mjs` holds each computed size to the size the protocol or paper states
today; where they differ (COI computes 709 against the 710 and 708 the prose gives) both are shown and the difference is
reported to the seat.

### Search

A published item has its own search record (`app/lib/registry/search-inputs.mjs`): its name, sequence and reverse complement,
target, reference, positions and the paper that prints it, so a sequence search finds the primer's page as well as the
protocols that use it. A save and `sync_registry` write it with the row, in one batch; `build:content` writes the same records
into the search artifact; a draft has none and a deleted item loses its own (`test/worker/registry-search.test.ts`). A strain's
record is its name, organism, designation, collection and collection number.

## The strain kind

`app/lib/registry/strain.mjs`, two records in `content/registry/strain/`: the bacterial hosts of the lab's phage work, each
stating only what the lab's own pages state: `organism`, `strain` (the lab's designation where there is one apart from the
collection's number, `mc²155`), `collection` and `collection_number` (`ATCC 700084`, `NRRL B-24224`), `guide_url` (the
SEA-PHAGES Guide's page for the host) and `biosafety_level`, which is Dustin's to set (BSL-1 for both, his word of 2026-10-05, decisions.md) and is `MISSING` until he does. The record's `name` is its organism and designation and a set rule holds it to them, so a name
cannot say a different strain than the fields do. A kind's page is `/research/lab/strains`, an item is
`/research/lab/strains/<id>`, each with a markdown twin, a search record and a tab on the library.

The id is the phages' host key (`HOSTS` in `app/lib/phages/compile.mjs`), so a phage's host and a strain are one word, and a
test holds the two lists equal. **Computed, never stored:** the phages isolated on a strain (read from the phages table by that
key, with their years), the protocols that use it (read from the protocols' own `host_strain`), and its designation.

A protocol names its host strains as `host_strain: [{ strain: <id> }]`, as it names primers, and types none: the compile reads the
strains from the repository into the record (`hostStrains`, and `hostStrain` as their names), so the page links each strain,
the twin links it, and a frozen version names the strain it was published with. A registry save and `sync_registry` recompile
every protocol that names the changed strain (`app/lib/procedures/primer-dependents.server.ts`, now for both kinds). A free-text
strain, a strain listed twice, an extra field and an id the registry does not hold are each refused, and a draft strain cannot be
named by a published protocol (`test/registry-strains.test.mjs`, `test/worker/procedure-strains.test.ts`).
A protocol's `organism` ids are read from the registry the same way: an id is a strain of the registry or one of the few non-strain
organisms typed in `NON_STRAIN_ORGANISMS` (`avian`), and the compile bakes each id's words (`organismNames`, from the strain's
`organism`) into the record, so a strain added to the registry is an organism a protocol can name with no edit to code. The library's
facet and browse tiles read those words from the records; a strain save recompiles the protocols that name it, as a host strain or
an organism. The pages that name the hosts link the strain records and type no designation or collection number
(`test/registry-strains.test.mjs` holds the content pages to it). Known gap: the phages table's host cell (`HOSTS` in
`app/lib/phages/compile.mjs`) still types `mc²155`, because the phage compile is not given the registry.

## The reagent kind

`app/lib/registry/reagent.mjs`, fifteen records in `content/registry/reagent/`: the substances the lab's protocols use up, as distinct
from the samples they work on (a lysate, soil, an eluate), the primers (their own kind) and the cultures (strains). A record states
what the lab's own pages state: `name`, an `abbreviation` or `contents` where a protocol says so (ZnCl2; DNase I plus RNase A), and
`supplier`, `catalog_number` and `product_url` where a protocol links the product (GoTaq Flexi from Promega, M8296; OneTaq Hot Start 2X
Master Mix from New England Biolabs, M0484, each read from the product link the protocols carried). A supplier or catalog number that
no record in the repository states is `MISSING: <why>` and listed for Dustin, never filled from memory: that is thirteen reagents, so
twenty-six gaps. A kind's page is `/research/lab/reagents`, an item is `/research/lab/reagents/<id>`, each with a markdown twin, a
search record and a tab on the library.

**Computed, never stored:** what the protocols use of a reagent. A protocol names a reagent on one of its materials as
`reagent: <id>` and keeps what is its own (the amount, stock and final concentration, and the name the steps mark it by); the
reagent's page reads each protocol's stock, final and amount back from the protocols that name it. The compile reads the reagents from
the repository (`reagents` on the registry host, `readReagents` in the Worker), bakes the registry's name and page into the material
(`reagent: { id, name, path }`), shows the material by the registry's name unless the protocol gives a `display` of its own, and
links it on the page, the twin and the sheet's table. A protocol no longer types a product name, product link or catalog number for a
reagent the registry holds (`test/registry-reagents.test.mjs`). An unknown id, a malformed id and a draft reagent in a published
protocol are refused, and a registry save or `sync_registry` recompiles every protocol whose materials name the changed reagent.
Not moved: the NEB 100 bp ladder stays in the protocols' equipment lists, where they classify it, with its link; a ladder is a
reagent or an equipment item by a lab convention that is Dustin's to state.

## Where it goes

| Piece | File |
| --- | --- |
| The one compile door (parse, validate, hash) | `app/lib/registry/compile.mjs`, with the kinds in `kinds.mjs` |
| The save: validate, policy, commit, row, purge | `app/lib/registry/save.server.ts` (`saveRegistryItem`) |
| Reads | `app/db/registry.ts` |
| Carrel: one handler per kind, id `<kind>.<id>` | `app/lib/carrel/registry-handler.server.ts` |
| Operator: `sync_registry`, `list_registry`, `get_registry` | `app/lib/operator/` |
| Drift: the `registry-drift` check, repaired by `sync_registry` | `app/lib/health/` |
| Build and sync | `scripts/lib/registry.mjs`, `build:content` (writes `content/generated/registry.json`), `sync:content` |
| The check | `check:content` compiles every file with the save's own validator |
| Cache tag a write purges | `registry` (`app/lib/registry/route.ts`); the pages also carry the content pages' and procedures' tags |
| Pages | `app/routes/lab.tsx`, `lab.kind.tsx` and the twin `lab[.md].ts`, drawn by `app/components/lab.tsx` from `app/lib/registry/catalog.mjs` |

### Syncing an empty registry

`sync_registry` and `sync:content` treat no files and no rows as converged. They still refuse no files while rows
exist, because that listing is far likelier a fault than a repository with none, and honouring it would delete every
row. `sync:content` deletes only rows a file under `content/registry/` once made, never an unscoped delete.

## Deploying the table

The migration is additive (one new table, no existing row touched) and is applied by the seat with
`wrangler d1 migrations apply dustinedwards --remote`. Apply it BEFORE the deploy: `sync:content` writes the registry
at ship and fails closed if the table does not exist yet.

## Tests

`test/registry.test.mjs` (compile, set rules, build, drift verdict) and `test/worker/registry.test.ts` (save, sync, the
drift check, the operator's reads and Carrel's handler) hold the framework with a kind of their own, so a change to a real
kind cannot hide a fault in it. `test/registry-align.test.mjs` holds placement and products to hand-worked references.
`test/registry-primers.test.mjs`, `test/registry-tm.test.mjs` and `test/worker/lab.test.ts`
hold the primer kind and its pages.
