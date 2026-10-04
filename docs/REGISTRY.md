# The lab registry

The reference catalog of the lab's primers, strains, reagents and equipment (job_915d43f44cee). It is built the way
phages and procedures are: a record is a file in the repository, the file is the source, and D1 holds a derived copy
that a save and `npm run sync:content` write. A record is edited with no build and no deploy. This document is the
framework. It ships with NO kind and NO record: each kind arrives with its own records, pages and catalog tab in its
own change.

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
| Cache tag a write purges | `registry` (`app/lib/registry/route.ts`) |

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
drift check, the operator's reads and Carrel's handler) hold the framework with a kind of their own, because the registry
ships with none.
