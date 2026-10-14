# Media

Moved from Capsid (`dustinedwards/media-module-architecture.md`) on 2026-10-13 and trimmed to what still holds. Code: `app/lib/media/`, `app/routes/media.$.ts`, `workers/media-events.ts`.

## Shape

1. **R2 is the store and the truth.** Buckets split on lifecycle: `dustinedwards-media` (`MEDIA`, irreplaceable), `dustinedwards-og` (`OG`, regenerable) and `dustinedwards-media-backup` (`MEDIA_BACKUP`, the mirror). Previews have their own `dustinedwards-preview-*` buckets. The mirror is written by the queue consumer on object create and by the watchdog when a message was lost. No site code path deletes from it, and `check:destructive` fails if one appears; pruning the backup is a human act.
2. **D1 is the index**, derived and rebuildable. The Health check `media-index-drift` compares it with the sources and the watchdog repairs drift with `sync_media`. R2 wins every conflict: a row with no object is deleted, an object with no row is backfilled. Deleting a row is therefore not deleting an object; the next rebuild restores it. Deletion happens in R2.
3. **Writes are an R2 event into a Queue, never a dual write.** The Worker writes only to R2; the bucket emits to `dustinedwards-media-events`; the consumer derives the row from the object as it is now, never from what the message claimed, so replay and out-of-order delivery converge. Dead-lettered to `dustinedwards-media-events-dlq` after 3 attempts.
4. **Static assets are indexed in place, never moved.** An asset needs R2 exactly when it needs a runtime write path. `env.ASSETS` has `fetch()` only, so `build:assets` emits a committed manifest, `content/generated/assets.json`.
5. **Usage is written by the pipeline at render time**, not by a scan.
6. **Delivery is the Images binding**, never `/cdn-cgi/image/`, which needs a zone.

## Roles

`role` is `content | brand | generated | icon`, derived by `classify.mjs`. The picker offers `content` only; the library shows every role. The first filter (`kind='image'` and static or R2) offered 26 rows of which 9 were insertable: the `/diagrams/*.svg` files are light/dark pairs the `:::diagram` directive inserts, and picking one inserts half a pair.

The discriminator is who fetches it:
- **icon**: declared to the platform via `<link rel>` or the webmanifest. `favicon.ico` and `site.webmanifest` keep unprefixed names because browsers request them unprompted; the rest are `dustin-edwards-*`.
- **brand**: named by application code. `dustin-edwards-og-image.png` (the default card in `seo.ts`), the four `dustin-edwards-logo*.svg` files and `dustin-edwards-favicon.svg`.

## Delivery

- `media.$.ts` emits one format, WebP, unconditionally. `format=auto` is a `/cdn-cgi/image/` feature and absent here, and the `Accept` negotiation that replaced it was a cache-poisoning bug against `caches.default`, whose manual key carries no headers. AVIF measured 1.2% smaller; not worth it.
- `WEBP_QUALITY` (85, `encoding.mjs`) is passed explicitly and written into the cache key. Without it the binding emitted lossless WebP, larger than the origin at every width.
- Two closed width sets (`widths.mjs`), because width lands in a billing key: `THUMB_WIDTHS` `[160, 320, 640]` for admin, `CONTENT_WIDTHS` `[640, 1024, 1408]` for prose (a 44rem column at 2x). Other widths are 400.
- `srcset` and `sizes` are written by the pipeline for `/media/` keys only; a static image in `public/` gets no ladder, so a post that wants one uploads. No `<picture>`. `gravity=auto` on tiles, plus two nullable focal override columns.
- `cropSafe()` exempts the roster photos (keyed on `/phage-hunters/`): group photos, faces must not be cut.
- Uploads refuse SVG (415, `svg-refused` in `upload-contract.mjs`), every `/media` response is sandboxed, and the stored type is the detected one, not the claimed one.
- LQIP over ThumbHash or BlurHash, because hash formats need client decoding to paint. Static body images get a `has-lqip` background from the asset manifest. A `/media/` body image gets none, because the stored HTML is byte-compared and that placeholder lives only in R2. Width and height are always set.

## Usage coverage

`remarkCollectMedia` runs before `remarkFigure`; afterwards a figure is an `img` paragraph and its form is lost. Delete asks both the refs table and a scan and refuses if either objects or the scan fails: refs are precise, the scan is a conservative superset (it counts a URL inside a code fence), and the union fails closed.

Covered: markdown image, figure directive, frontmatter cover, links including reference-style definitions, HTML, and links to static assets by public path (origin and query stripped). Not counted: page links, bare anchors, code fences. Unfixable: a reference assembled at runtime, and citations from outside the corpus.

## Tools

`wrangler r2 object` has no `list`, so the prune borrows the Worker's bucket binding via `getPlatformProxy` (`scripts/lib/r2.mjs`) over wrangler's OAuth. `remote: true` is load-bearing (1 object locally versus 13 in the real bucket); the config carrying it is built at runtime and discarded so it cannot leak into `wrangler.jsonc`.

## Lessons

- A check over a corpus that exercises nothing is vacuous. When this shipped no post had an image, so `media_refs` was correctly 0 and a broken collector would have passed. A fixture now covers all forms plus negatives and fails if it collects nothing.
- A signal must attach to what it measures. Row count answers "did the rebuild run"; role split answers "does the deriver work".

## Not built

Roster photos stay in `public/phage-hunters/`: a new cohort is a resize and a commit, not a runtime write, the static tier already gives dimensions, LQIP and transforms, and content-addressed keys would erase the path `cropSafe()` depends on. Migrate only if Dustin wants "upload next year's photo in the editor". Media versioning, AI tagging, rights management and lifecycle rules are team features for an audience of one. Trash (`trashed_at`, migration 0011, hides a file but never takes its URL down), tags, folders and exact-hash duplicate detection were built.
