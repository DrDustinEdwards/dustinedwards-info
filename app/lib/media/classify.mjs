/**
 * What an asset IS, derived from its path and nothing else.
 *
 * `.mjs` and dependency-free on purpose, for the reason `records.mjs`,
 * `query.mjs` and `chart.mjs` are: the Worker imports it, the build scripts
 * import it, and `check:media` imports it. There must never be a second answer
 * to "what kind of thing is this file", because the gate and the writer
 * disagreeing is precisely the drift the gate exists to catch.
 */

/**
 * Extension to (kind, mime). THE source of truth for both.
 *
 * `kind` is 'image' | 'document' | 'other'. The ratified schema named the first
 * two; 'other' was added when the decision was taken to index every file under
 * `public/`, because `site.webmanifest` is honestly neither. Inventing a kind
 * for it would have been a lie, and quietly skipping it would have made the walk
 * fail OPEN on every file type nobody had thought of yet.
 */
const TYPES = new Map([
  ["png", { kind: "image", mime: "image/png" }],
  ["jpg", { kind: "image", mime: "image/jpeg" }],
  ["jpeg", { kind: "image", mime: "image/jpeg" }],
  ["webp", { kind: "image", mime: "image/webp" }],
  ["avif", { kind: "image", mime: "image/avif" }],
  ["gif", { kind: "image", mime: "image/gif" }],
  ["svg", { kind: "image", mime: "image/svg+xml" }],
  ["ico", { kind: "image", mime: "image/x-icon" }],
  ["pdf", { kind: "document", mime: "application/pdf" }],
  ["webmanifest", { kind: "other", mime: "application/manifest+json" }],
  // Added 2026-08-21 with the self-hosted fonts, which is the whole reason:
  // SIL OFL 1.1 requires the licence to travel with the redistributed font, so
  // public/fonts/OFL.txt has to be served rather than sit beside the binaries
  // unreachable. This map throwing on "txt" is what made that a decision.
  ["txt", { kind: "document", mime: "text/plain; charset=utf-8" }],
  //
  // "woff2" WAS HERE AND IS DELETED, same day it was added. The fonts moved out
  // of public/ into app/fonts/ so the build can content-hash them, so there is
  // no longer a woff2 under public/ for this map to classify. Leaving the entry
  // would have been harmless-looking and slightly fail-open: the next webfont
  // dropped into public/ would acquire a plausible kind instead of stopping the
  // build, which is the one thing this map exists to do.
]);

/** Extensions the Images binding can measure and transform. */
const RASTER = new Set(["png", "jpg", "jpeg", "webp", "avif", "gif"]);

/** @param {string} pathOrKey */
export function extensionOf(pathOrKey) {
  const base = pathOrKey.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

/**
 * Classifies one path.
 *
 * THROWS on an unknown extension rather than returning a default. That is the
 * whole reason this is a function and not a lookup at the call site: a new file
 * type appearing under `public/` must stop a build, not acquire a plausible
 * `kind` nobody chose. Adding a type means adding it to TYPES, in the same
 * commit as the file.
 *
 * @param {string} pathOrKey
 * @returns {{ kind: string, mime: string, extension: string }}
 */
export function classify(pathOrKey) {
  const extension = extensionOf(pathOrKey);
  const type = TYPES.get(extension);
  if (!type) {
    throw new Error(
      `unclassified asset "${pathOrKey}": extension "${extension || "(none)"}" is not in ` +
        `app/lib/media/classify.mjs. Add it there, in the same commit as the file.`,
    );
  }
  return { kind: type.kind, mime: type.mime, extension };
}

/**
 * Files under `public/` that are NOT assets, BY NAME, each with its reason.
 *
 * `_headers` is a DEPLOY-TIME CONTROL FILE. Cloudflare's static-asset uploader
 * reads it, applies the rules to everything else, and never serves it; there is
 * no URL for it and there is nothing for the media index to point at. A row for
 * it would claim a static asset that 404s, which is the exact falsehood the
 * index exists to prevent. `_redirects` is the same contract and is listed now
 * so adding one is a one-line diff rather than a repeat of this session.
 *
 * **NAMED, not a rule.** The tempting version of this is "skip anything with no
 * extension", and that is a catch-all that fails OPEN: the next extensionless
 * file nobody has thought of disappears from the manifest silently instead of
 * stopping a build. This map excludes two paths and nothing else. Everything
 * unrecognised still reaches `classify()` and still throws.
 *
 * Keyed on the SITE-ABSOLUTE path, so the exclusion is anchored at the root of
 * `public/` where Cloudflare's contract actually puts these files. A
 * `public/publications/_headers` is not a control file, is not excluded, and
 * fails loudly, which is what it should do.
 */
/*
 * **`/fonts/OFL.txt` DOES NOT BELONG IN THIS MAP, and the temptation to put it
 * there is why this note exists.**
 *
 * `check:media --remote` has been failing on it since it was added: a `public/`
 * file with no D1 row, direction 3 of the reconciliation. The cheap way to make
 * that green is an entry here, and it would be WRONG. The `txt` type above was
 * added to the classifier FOR THIS FILE, with the reason recorded at that line:
 * the licence has to be SERVED rather than sit beside the binaries unreachable.
 * A file the site is deliberately serving is an asset, and the index exists to
 * describe every asset the site has.
 *
 * So the gate is not reporting a defect in itself; it is reporting real drift.
 * A Worker cannot list its own static assets, so `rebuildMediaIndex` is what
 * writes the static rows, it reads `assetManifest.paths`, and that manifest
 * already contains `/fonts/OFL.txt`. The row is missing only because nobody has
 * run a rebuild since the file landed. **The repair is the rebuild button on
 * `/admin/media`, which needs an admin session**, not a code change here.
 *
 * Recorded rather than left implicit because the next reader meets a red gate
 * and a two-line fix that silences it, and that fix would quietly stop the
 * licence being indexed at all.
 */
const NOT_ASSETS = new Map([
  [
    "/_headers",
    "Cloudflare static-asset header rules. Consumed by the uploader at deploy " +
      "time and never served, so it has no URL to index. Subject of check:headers.",
  ],
  [
    "/_redirects",
    "Cloudflare static-asset redirect rules. Same deploy-time contract as _headers.",
  ],
]);

/**
 * Why this path is not an asset, or null if it is one.
 *
 * Lives here rather than in the walk because this module is the single answer
 * to "what kind of thing is this file", and "not a thing the index carries" is
 * an answer to that question. `walkPublic()` and therefore `check:media` both
 * take the set from here, so the manifest and the reconciler cannot disagree
 * about which files exist.
 *
 * @param {string} pathOrKey
 * @returns {string | null}
 */
export function excludedFromAssets(pathOrKey) {
  return NOT_ASSETS.get(pathOrKey) ?? null;
}

/**
 * True when the Images binding can read intrinsic dimensions and an LQIP.
 * @param {string} pathOrKey
 */
export function isRaster(pathOrKey) {
  return RASTER.has(extensionOf(pathOrKey));
}

/**
 * Where the bytes live, decided by the SHAPE OF THE KEY.
 *
 * A static asset is indexed under its public path, which begins with `/`; an R2
 * object key never does. So the leading slash is the discriminator, and it costs
 * nothing to check and cannot drift out of sync with a separate column the way a
 * hand-set value would.
 *
 * `r2-derived` is the regenerable tier: an OG card can be rebuilt by command, so
 * losing one is an inconvenience rather than a loss. It is distinguished by
 * prefix because that is what the writer actually controls.
 *
 * @param {string} pathOrKey
 * @returns {"static" | "r2-derived" | "r2"}
 */
export function storageOf(pathOrKey) {
  if (pathOrKey.startsWith("/")) return "static";
  if (pathOrKey.startsWith("og/")) return "r2-derived";
  return "r2";
}

/**
 * Which bucket holds this key.
 *
 * Two buckets split on LIFECYCLE: MEDIA is irreplaceable, OG holds cards a
 * command regenerates. `storageOf` already answers the question from the key
 * shape, so this asks it rather than testing the prefix a second time.
 *
 * ONE IMPLEMENTATION, and that is the point. This expression previously existed
 * three times: named `bucketFor` in `workers/media-events.ts` and
 * `app/routes/media.$.ts`, and inline in `rebuild.server.ts`. All three agreed,
 * nothing enforced that they would keep agreeing, and this is the class of pair
 * that deleted rows: the queue consumer once resolved every key to MEDIA, so an
 * OG card's event looked like a delete of an object that was not there.
 *
 * It lives here beside `storageOf` because it is a pure function of the key
 * shape and nothing else, and a caller only has to supply the env it already
 * holds. `check:invariants` asserts no second copy reappears, which is the real
 * failure mode now that there is one.
 *
 * A `static` key resolves to MEDIA, where the miss is loud in `check:media`
 * rather than silent. Static objects are in no bucket and emit no notifications,
 * so reaching here with one is itself the bug.
 *
 * Typed generically over the two bindings rather than against `Env`, because
 * this module is shared with the Node build scripts and must not depend on the
 * Worker's generated types. A real `Env` satisfies it and `T` infers to
 * `R2Bucket`.
 *
 * @template T
 * @param {{ OG: T, MEDIA: T }} env
 * @param {string} key
 * @returns {T}
 */
export function bucketFor(env, key) {
  return storageOf(key) === "r2-derived" ? env.OG : env.MEDIA;
}

/**
 * What an asset is FOR, as opposed to what it is or where it lives.
 *
 * `kind` and `storage` turned out not to be enough, and the gap was live rather
 * than theoretical. The picker filtered on `kind='image' AND storage IN
 * ('r2','static')` and so offered 26 assets of which 9 were insertable: the site
 * logos, every favicon, and both halves of every rendered diagram.
 *
 * **The diagram pair is the sharp edge.** `/diagrams/<hash>-light.svg` and
 * `-dark.svg` are two renders of one drawing, and `app.css` shows whichever
 * matches the theme. Picking one out of the library inserts HALF A PAIR and
 * bypasses the `:::diagram` directive whose entire job is to emit both. That is
 * a broken post in one click, not cosmetic noise, which is why this is a column
 * and not a nicety.
 *
 * Four roles:
 *   content    insertable into a post. Editor uploads, roster photos, the PDFs.
 *   brand      identity marks. Shown, never inserted; also check:logo FIXTURES.
 *   generated  build output. Diagrams and OG cards, regenerable by command.
 *   icon       site chrome. Favicons, touch icons, the manifest.
 *
 * **`brand` versus `icon` is the one boundary that needs a stated rule**, because
 * both are square images of the mark and eyeballing them decides nothing.
 * `og-image.png` is what forced it: it looks exactly like an icon and is not one.
 *
 *   icon   is DECLARED TO THE PLATFORM. Something outside the application asks
 *          for it: a `<link rel>`, or an entry in the webmanifest. The browser
 *          or the OS fetches it without any of this code being involved.
 *   brand  is REFERENCED BY APPLICATION CODE. Some module names it. `og-image.png`
 *          is `DEFAULT_OG_IMAGE` in `seo.ts`, and the four logo SVGs are the
 *          fixtures `check:logo` reads.
 *
 * The test is therefore "who fetches it", not "what shape is it". A new asset
 * classifies itself by answering that, with no judgment call left over.
 *
 * **The default is `content`, and that direction is deliberate.** An
 * unrecognised asset showing up in the picker is a visible nuisance the author
 * corrects in a second; an unrecognised asset silently EXCLUDED from the picker
 * is an image nobody can find and nobody knows is missing. Fail toward being
 * seen. `check:media` verifies every row against this function in both
 * directions, so a misclassification cannot sit unnoticed either way.
 *
 * @param {string} pathOrKey
 * @returns {"content" | "brand" | "generated" | "icon"}
 */
export function roleOf(pathOrKey) {
  // Build output, either bucket. Keyed by prefix because that is what the
  // generator controls and what survives a rename of the thing it drew.
  if (pathOrKey.startsWith("og/")) return "generated";
  if (pathOrKey.startsWith("/diagrams/")) return "generated";

  // Identity. `og-image.png` belongs here rather than with the icons: it is the
  // site mark, used as the default social card, and `seo.ts` names it directly.
  if (/^\/(logo(-[a-z]+)*\.svg|favicon\.svg|og-image\.png)$/.test(pathOrKey)) return "brand";

  // Chrome. The manifest rides with the icons it declares.
  if (
    /^\/(favicon\.ico|apple-touch-icon\.png|android-chrome-[\dx]+\.png|maskable-icon-[\dx]+\.png|site\.webmanifest)$/.test(
      pathOrKey,
    )
  ) {
    return "icon";
  }

  return "content";
}

/**
 * Whether this asset may be cropped when a transform asks for a fixed shape.
 *
 * **Roster photos may not.** They are group photographs and `fit=cover` cuts
 * faces off the edge of the frame, which is the one failure mode a photo of
 * named people must not have. Everything else crops safely, because the
 * saliency detector keeps the subject and losing background is what a thumbnail
 * is for.
 *
 * Keyed on the path, which is correct TODAY and will need moving: execution
 * step 11 migrates these nine files into R2 under content-addressed keys, at
 * which point there is no path left to recognise them by and this becomes a
 * stored property rather than a derived one. Recorded here so the migration
 * does not silently start cropping faces.
 *
 * @param {string} pathOrKey
 */
export function cropSafe(pathOrKey) {
  return !pathOrKey.startsWith("/phage-hunters/");
}

/**
 * The content-addressed key for a blob.
 *
 * Ruling: decisions.md 2026-08-02, "Media keys are CONTENT-ADDRESSED". The key
 * is an ADDRESS, not a label, and human readability moved to `original_name`
 * where it belongs.
 *
 * 16 hex characters is 64 bits of the digest. That is not a collision argument
 * dressed up as one: at this corpus size any truncation is safe, and 64 bits
 * keeps the key short enough to read in a URL while leaving the full digest
 * recoverable from the bytes. The extension rides along so the object is still
 * self-describing to a browser and to `classify()`.
 *
 * THE KEY ALSO CARRIES THE INTRINSIC DIMENSIONS, and that is finding B002.
 *
 * Image dimensions are baked into the stored HTML by `rehypeImageDimensions`,
 * so they are part of the gated artifact and BOTH writers have to produce the
 * same ones. They could not: the Node build measured bytes under `public/` and
 * the Worker measured bytes in R2, and an R2 blob is not readable from a clone
 * at all. The first `/media/` citation would therefore have committed HTML that
 * `build:content` could not reproduce.
 *
 * Carrying `-<w>x<h>` in the key makes the two agree BY CONSTRUCTION rather
 * than by both reaching the same store: each resolver parses the string it was
 * handed and neither reads bytes. It cannot go stale, because the digest pins
 * the bytes the dimensions were measured from; a different image is a different
 * key. Chosen over a committed dimensions manifest because a manifest would add
 * the gap that an uploaded image is not citable until the manifest is
 * regenerated and committed.
 *
 * `dimensions` is null for anything with no intrinsic pixel size, which is the
 * same truth the `media` table records as a NULL width: an SVG has none, and 0
 * would be a measurement rather than the absence of one. Such a key has no
 * suffix and resolves to no dimensions.
 *
 * @param {ArrayBuffer} digest a SHA-256 digest
 * @param {string} extension
 * @param {{ width: number, height: number } | null} [dimensions]
 */
export function contentKey(digest, extension, dimensions = null) {
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const size =
    dimensions && dimensions.width > 0 && dimensions.height > 0
      ? `-${dimensions.width}x${dimensions.height}`
      : "";
  return `${hex.slice(0, 16)}${size}.${extension}`;
}

/**
 * The intrinsic dimensions a media key carries, or null if it carries none.
 *
 * The one reader of the `-<w>x<h>` segment `contentKey` writes. Both resolvers
 * call THIS, exactly as both content writers call `records.mjs`, so there is no
 * second parser to drift from the producer.
 *
 * Accepts a bare key (`ab12-1600x900.webp`) or a `/media/` path, because the
 * pipeline hands resolvers a site-absolute src and the upload path holds a key.
 *
 * Deliberately strict. A key whose segment is malformed, zero or oversized
 * returns null rather than a guess, and a null is a build failure at the call
 * site rather than a silently missing attribute. Preventing layout shift is the
 * whole point, so "I could not tell" must never render as "no dimensions
 * needed".
 *
 * @param {string} keyOrPath
 * @returns {{ width: number, height: number } | null}
 */
export function dimensionsFromKey(keyOrPath) {
  if (typeof keyOrPath !== "string") return null;
  // Query and fragment are stripped, the same rule and for the same reason as
  // `mediaKeyOf`: `?w=320` is a transform request, not a different object, and
  // the intrinsic size the key records is a property of the blob either way.
  const path = keyOrPath.split(/[?#]/)[0];
  const key = path.startsWith("/media/")
    ? path.slice("/media/".length)
    : path;
  // Anchored on the 16 hex digits so ordinary filenames containing something
  // like "-800x600" cannot be read as a measurement.
  const match = key.match(/^[0-9a-f]{16}-(\d{1,5})x(\d{1,5})\.[a-z0-9]+$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}
