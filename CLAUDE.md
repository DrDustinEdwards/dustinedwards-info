# CLAUDE.md - dustinedwards.info

Portfolio-wide rules live in Capsid, not here. Read `capsid/conventions.md` first, then `dustinedwards/core.md`. This file holds only what is true of this repo.

## What this is

Personal platform and Cloudflare showcase for Dustin Edwards. React Router 8 (SSR) + Vite + @cloudflare/vite-plugin, native on Cloudflare Workers. Drizzle on D1, Better Auth (Google, single admin) with sessions in KV, R2 for media. Node 24.14.1 (.nvmrc). Also the flagship site and a Capsid CMS consumer.

## Session ritual

Start: read `capsid/conventions.md`, then `dustinedwards/core.md`.
End: write a `session-YYYY-MM-DD.md` episodic (type `episodic`, under ~2KB) to the dustinedwards namespace.

## Bindings

Configured in wrangler.jsonc, read off the request context via `getEnv(context)` from `app/lib/context.ts`. Never import bindings globally.

  DB      D1 database "dustinedwards"
  APP_KV  KV namespace (Better Auth session store)
  MEDIA   R2 bucket "dustinedwards-media"

## Commands

- `npm run dev`
- `npm run build`
- `npx tsc -b` typecheck (`tsc --noEmit` is a no-op here)
- `npm run build:content` regenerate `content/generated/posts.json` from `content/posts/`
- `npm run check:content` gate; fails when the committed artifact differs from a fresh generation
- `npm run sync:content -- --local|--remote` push the artifact into D1 and rebuild the FTS index
- `wrangler d1 migrations apply dustinedwards [--local|--remote]`
- `wrangler deploy` (auto-deploy is not wired; deploy is manual)

## Blog content

Markdown files in `content/posts/` are the source of truth. The generator emits
`content/generated/posts.json` (committed, gated) carrying both the source
markdown and the rendered HTML, and `sync:content` writes both into D1. D1 owns
every read. Ruling and grounds: dustinedwards/decisions.md, 2026-07-27.

Editing a post means editing the markdown, running `build:content`, committing
the artifact alongside it, then `sync:content`. Never hand-edit the artifact and
never write prose straight into a D1 row: both defeat the gate.

## Admin editor (second writer)

`/admin/posts` is a second writer onto the same pipeline. It never writes rows
directly. The path is:

    browser -> action -> gates -> GitHub commit -> generate -> D1

1. **Gates, server side, before anything is written.** The same zod frontmatter
   schema and a wide-dash check run inside the action. API commits bypass the
   local PreToolUse hooks entirely, so without these the style and schema rules
   would not reach anything written in the editor. A rejection names the field
   or the line.
2. **One commit per save, via the Git Data API.** A save changes both
   `content/posts/<slug>.md` and the regenerated `content/generated/posts.json`
   and they land together. The Contents API cannot do this (one file per call),
   and splitting it into two commits leaves `check:content` red in between.
3. **D1 is written only after the commit lands.** If GitHub is unreachable the
   save fails whole. There is no D1-only write and no reconcile-later queue.
4. **Conflict rule.** The editor records the head commit of `main` when it loads
   and sends it back on save. If `main` moved, the save is refused with a
   conflict and the author reloads. The editor never overwrites a change it did
   not see, and the ref update is never forced.
5. **Deleting** removes the file, its artifact entry, and its rows, in that order.

`Regenerate all` on `/admin/posts` re-syncs D1 from the committed artifact. It is
the recovery path when rows drift from what the repo says.

Requires the `GITHUB_TOKEN` wrangler secret (fine-grained, Contents read/write on
this repo). Without it the editor still renders and previews, and saving reports
that it is unavailable rather than half-working.

## Zero-JS rule (gate, not preference)

Every public blog route must be fully functional with JavaScript disabled.
All client JS is one chunk, `app/enhance/blog.ts`, loaded by dynamic import
from `BlogEnhancements` and therefore only on blog routes. It is 3.87 kB raw,
1.55 kB gzip. Everything in it upgrades markup that already works: the TOC is
anchor links, footnotes are jump links, images are images, and Copy as Markdown
is an anchor to the .md twin.

Do not load it with a `?url` import. That copies the file verbatim as an asset
and serves the browser raw TypeScript. Measured 2026-07-28.

Line highlighting comes from fence meta (```ts {2,5-7}) and is applied in the
PIPELINE, so it is in the stored HTML rather than painted on by script.

## Revision dates

`updated_at` is derived from the last git commit touching the post file, at
SYNC time. Never put a git date in `content/generated/posts.json`: the artifact
is generated before the commit that contains it, so it records the previous
commit and the next build computes a different one, leaving `check:content` red
after every ordinary content commit. Explicit `updated` frontmatter overrides.

## Cross-post data

`related` is computed over the whole corpus by `withRelated`, which BOTH callers
run. Relatedness is a property of the set: adding or retagging one post changes
the related list of every post sharing a tag, so an editor save that spliced one
entry would make the artifact disagree with the next build.

Markdown rendering lives in `app/lib/content/pipeline.mjs` so the Worker and the
build scripts import the same module. There must never be a second renderer.
Highlighting is `shiki/core` with the explicit `LANGUAGES` list, because the full
shiki bundle ships every grammar and took the Worker to 14 MB; a fenced block in
an unlisted language renders as plain text in published output as well as
preview.

## Hard rules

1. Every public read goes through `publiclyVisible()`. It hides drafts and future publish_at rows. Do not query posts for public output without it.
2. Migrations are hand-written in `drizzle/`. drizzle-kit is intentionally not a dependency (esbuild advisory). Add a new numbered file, never edit an applied one.
3. Keep the worker lean. No heavy dependencies. Client bundles stay small; auth code loads only on admin and login routes. This is the repo's bundle-leanness rule, and it is why inline SVG is preferred here over an icon library.
4. Secrets are wrangler secrets, read only in `.server` modules and in loaders/actions: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL, ADMIN_EMAIL.
5. Do not modify `.claude/settings.json` without explicit instruction. Two PreToolUse hooks block on exit 2: `no-em-dash.sh` on Write and Edit, and `scoped-git-add.sh` on Bash. A Stop hook runs `npx tsc -b`. That enforcement is deliberate. PreToolUse plus exit 2 is the only blocking combination; the older PostToolUse `.mjs` registration could not block a write and was retired in d36dbf2.
6. `wrangler d1 export` does NOT work on this database: it fails outright on the
   `posts_fts` virtual table (measured 2026-07-27). Back up per table instead,
   `--no-schema --table <name>`, never the FTS table or its shadow tables.
   Related: `COUNT(*)` on `posts_fts` reads through to `posts` and so can never
   detect index drift. Count `posts_fts_docsize` instead. Never run
   `DELETE FROM posts_fts`; it corrupts the index, and the repair is
   `INSERT INTO posts_fts (posts_fts) VALUES ('rebuild')`.
7. `public/publications/` and `public/phage-hunters/` hold 31 PDFs and 9 photos from retired content. They are orphaned on purpose, reachable by direct URL and linked from nowhere, kept for citation integrity in other people's published work. Do not delete them as hygiene, and never write a redirect or gone rule that matches `/publications/*` or `/phage-hunters/*` as a prefix.
