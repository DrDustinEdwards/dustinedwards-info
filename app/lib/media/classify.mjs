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
  // public/fonts/dustin-edwards-ofl.txt has to be served rather than sit beside the binaries
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

/**
 * The extension, LOWERCASE, for classification.
 *
 * The empty string for a key with no extension is load-bearing rather than a
 * convenience: `classify()` below looks the result up in `BY_EXTENSION` and
 * THROWS on a miss, which is how a new file type under `public/` stops a build.
 * A fallback here would turn that throw into a plausible default and remove the
 * only thing this map exists to do.
 *
 * NOT the display one. `media-document-card.tsx` renders the extension on a
 * tile and needs the opposite of all three properties: uppercase, capped at
 * five characters, and falling back to the mime subtype rather than to "". It
 * is called `extensionLabel` there, renamed on 2026-08-24 when it still shared
 * this name, because two different functions under one name is a body somebody
 * eventually copies between them.
 *
 * @param {string} pathOrKey
 */
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
 * **`/fonts/dustin-edwards-ofl.txt` DOES NOT BELONG IN THIS MAP, and the temptation to put it
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
 * already contains `/fonts/dustin-edwards-ofl.txt`. The row is missing only because nobody has
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
 * The ONE generated family under `public/`, excluded by pattern rather than by
 * name, because naming 36 files here would be a mirror of the corpus.
 *
 * ## WHY A PATTERN IS ALLOWED HERE WHEN THE MAP ABOVE REFUSES ONE
 *
 * The argument against a rule up there is that a catch-all fails OPEN: the next
 * unrecognised file disappears from the manifest silently instead of stopping a
 * build. This is not a catch-all. It names one directory, one extension and one
 * slug shape, and it is the shape `paths.mjs` generates. A stray
 * `public/publications/notes.md` written by hand would not match (the slug
 * pattern requires the DOI fold's alphabet), reaches `classify()`, and fails
 * loudly, which is what it should do.
 *
 * ## WHY THE TWINS ARE NOT ASSETS THE INDEX CARRIES
 *
 * Two reasons and either would do.
 *
 * The manifest is COMMITTED and the twins are gitignored build product. A
 * committed list of generated filenames disagrees with disk on every clean
 * clone until the build runs, which makes the reconciliation depend on the
 * order two unrelated steps happened to run in.
 *
 * And the manifest's consumer is `rebuildMediaIndex`, which writes a row per
 * static asset for the admin media library. A markdown twin is not media: it is
 * the machine-readable representation of a page, the same class of thing as
 * `/blog/<slug>.md`, which is a route and has never been in this manifest
 * either. Indexing them would put 36 text files in a picture library.
 *
 * Nothing needs to discover them. `llms.txt` lists all 36 by URL and
 * `check:publications` reconciles that list against the generated set in both
 * directions, which is a stronger guarantee than the manifest gives anything.
 */
const NOT_ASSET_PATTERNS = [
  {
    test: /^\/publications\/[a-z0-9-]+\.md$/,
    why:
      "A generated markdown twin of a paper, gitignored build product served " +
      "as an asset. Listed in llms.txt and reconciled by check:publications; " +
      "not media, and not committed, so not in this manifest.",
  },
];

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
  const named = NOT_ASSETS.get(pathOrKey);
  if (named) return named;
  return NOT_ASSET_PATTERNS.find((rule) => rule.test.test(pathOrKey))?.why ?? null;
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
 * The OG image is what forced it: it looks exactly like an icon and is not one.
 *
 *   icon   is DECLARED TO THE PLATFORM. Something outside the application asks
 *          for it: a `<link rel>`, or an entry in the webmanifest. The browser
 *          or the OS fetches it without any of this code being involved.
 *   brand  is REFERENCED BY APPLICATION CODE. Some module names it. The OG image
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

  // Identity. The OG image belongs here rather than with the icons: it is the
  // site mark, used as the default social card, and `seo.ts` names it directly.
  if (/^\/dustin-edwards-(logo(-[a-z]+)*\.svg|favicon\.svg|og-image\.png)$/.test(pathOrKey)) {
    return "brand";
  }

  // Chrome. The manifest rides with the icons it declares. `favicon.ico` keeps its name because a
  // browser asks for it unprompted, and the manifest because only a browser ever reads it: ruling
  // 127's two exceptions, which `check:asset-names` lists.
  if (
    /^\/(favicon\.ico|site\.webmanifest|dustin-edwards-(apple-touch-icon\.png|android-chrome-[\dx]+\.png|maskable-icon-[\dx]+\.png))$/.test(
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
 * Image dimensions are baked into the stored HTML by `rehypeImageSources`,
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
 * RULING 127: the key opens with `dustin-edwards-` and then, where the upload carried a usable
 * one, a descriptive slug from the author's filename. THE DIGEST STAYS, so the key is a function
 * of the bytes and the name, and still immutable: the same image uploaded under two names is two
 * objects, which is the price of a file that says what it is when it lands on a reader's disk.
 * A name that slugifies to nothing leaves the prefix and the digest.
 *
 * @param {ArrayBuffer} digest a SHA-256 digest
 * @param {string} extension
 * @param {{ width: number, height: number } | null} [dimensions]
 * @param {string | null} [name] the author's filename, for the descriptive segment
 */
export function contentKey(digest, extension, dimensions = null, name = null) {
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const size =
    dimensions && dimensions.width > 0 && dimensions.height > 0
      ? `-${dimensions.width}x${dimensions.height}`
      : "";
  const slug = slugifyName(name);
  return `${ASSET_PREFIX}${slug ? `${slug}-` : ""}${hex.slice(0, 16)}${size}.${extension}`;
}

/**
 * The prefix ruling 127 puts on everything that leaves the site. Stated ONCE and exported: the key
 * writer, the download-name builder and `check:asset-names` all read this rather than the literal.
 */
export const ASSET_PREFIX = "dustin-edwards-";

/**
 * A filename reduced to a key's descriptive segment: lower case, hyphens, no extension.
 *
 * CAPPED AT 48 CHARACTERS, because a key is a URL segment and an uncapped one lets whoever names
 * the upload decide how long every stored key is. "" is a real answer for a name with no usable
 * characters, and the key then carries the prefix and the digest alone. A name that already
 * carries the prefix loses it here, or re-uploading a downloaded file would double it.
 *
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function slugifyName(name) {
  if (typeof name !== "string") return "";
  return name
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/^(?:dustin-edwards(?:-|$))+/, "")
    .slice(0, 48)
    .replace(/-+$/, "");
}

/**
 * The full shape of a key `contentKey` can emit, in ONE statement, and it is
 * the only statement of the key grammar in this repository.
 *
 * Exactly two forms exist: `<16 hex>.<ext>` and `<16 hex>-<w>x<h>.<ext>`.
 * Anchored at both ends, and no character class admits a slash, so a static
 * path (leading `/`), an `og/` key, and a traversal segment all fail without
 * needing to be named.
 *
 * NAMED GROUPS, THREE READERS. `isContentKey` tests it, `digestFromKey` takes `digest`,
 * `dimensionsFromKey` takes `width` and `height`. The names replaced positional indices when
 * ruling 127 added the prefix and the slug ahead of the digest: every index would have shifted by
 * one, silently, and this file already records what one silent shift in this grammar costs.
 *
 * THE SLUG IS GREEDY AND THAT IS DELIBERATE. A descriptive segment may itself end in sixteen hex
 * characters; greedy matching leaves the LAST such run as the digest, which is the one the writer
 * put there.
 *
 * **THEY HAD ALREADY DRIFTED, and the differential that collapsed them found
 * it rather than predicting it.** The old inline spelling read `\d{1,5}` per
 * axis and rejected zero numerically afterwards; this one reads `[1-9]\d{0,4}`
 * and rejects a leading zero outright. So of 234 generated and negative cases
 * they agreed on 232 and disagreed on `-0800x600` and `-800x0600`, where the
 * old reader returned `{800, 600}` for a key `isContentKey` was simultaneously
 * calling not-a-content-key and `digestFromKey` was giving no digest for. One
 * key, three readers, two answers.
 *
 * The strict spelling wins, and the reason is that the other two readers had
 * always used it: a key delete and set-alt refuse is not a key the resolver
 * should be measuring.
 *
 * **THE OLD JUSTIFICATION FOR `[1-9]` WAS WRONG and is corrected here.** It
 * said `contentKey` "writes `String(width)`, so a leading-zero dimension is a
 * string that writer cannot produce". It interpolates, it does not call
 * `String`, and `"0800" > 0` is true, so `contentKey(d, "webp", {width: "0800",
 * height: 600})` emits `-0800x600` today, measured. What actually rules that
 * out is the TYPE on the parameter, checked by `tsc` at every call site, and a
 * type is a better guarantee than the arithmetic accident the comment claimed.
 */
const CONTENT_KEY_SHAPE =
  /^dustin-edwards-(?:(?<slug>[a-z0-9][a-z0-9-]*)-)?(?<digest>[0-9a-f]{16})(?:-(?<width>[1-9]\d{0,4})x(?<height>[1-9]\d{0,4}))?\.[a-z0-9]+$/;

/**
 * The bare key inside a value that may be a key, a `/media/` path, or either
 * carrying a transform query.
 *
 * Stated once because all three readers below need it and two of them used to
 * spell it separately. `?w=320` is a transform request, not a different
 * object, so query and fragment come off; the intrinsic facts a key records are
 * properties of the blob either way.
 *
 * @param {string} keyOrPath
 * @returns {string | null} null only when the input is not a string at all
 */
function bareKey(keyOrPath) {
  if (typeof keyOrPath !== "string") return null;
  // `split` always yields a first element, so the fallback is unreachable and
  // an empty key is the truthful answer for an empty input.
  const path = keyOrPath.split(/[?#]/)[0] ?? "";
  return path.startsWith("/media/") ? path.slice("/media/".length) : path;
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
 * needed". The strictness now comes from `CONTENT_KEY_SHAPE` rather than from a
 * private regex plus a numeric afterthought.
 *
 * @param {string} keyOrPath
 * @returns {{ width: number, height: number } | null}
 */
export function dimensionsFromKey(keyOrPath) {
  const key = bareKey(keyOrPath);
  if (key === null) return null;
  const match = CONTENT_KEY_SHAPE.exec(key);
  // The width group is absent for the no-dimension form, which is a key carrying no measurement
  // rather than a key that failed to parse. Both answer null, and the caller wants that from both.
  if (!match || match.groups?.width === undefined) return null;
  return { width: Number(match.groups.width), height: Number(match.groups.height) };
}

/**
 * True for exactly the shapes `contentKey` can emit, false for everything else.
 *
 * THE ONLY BOOLEAN READER OF THE KEY GRAMMAR, and it lives beside the writer
 * on purpose. `isManagedKey` in `core.server.ts` carried its own regex, which
 * predated the dimension segment: every uploaded raster was refused by delete,
 * by set-alt and by empty-trash, invisibly, because the guard tested a shape
 * the writer had stopped emitting. Latent only while R2 held no uploaded
 * originals. A reader that is a second statement of the grammar fails exactly
 * when the writer moves, which is the one moment it is needed.
 *
 * Nothing outside this module may parse a content key. The sweep that holds
 * that line is test/media-key-grammar.test.mjs, which asserts the three former
 * copies stayed deleted.
 *
 * @param {string} key a bare key, never a `/media/` path
 * @returns {boolean}
 */
export function isContentKey(key) {
  return typeof key === "string" && CONTENT_KEY_SHAPE.test(key);
}

/**
 * The 16 hex digits of the content digest a key carries, or null.
 *
 * THE ONLY EXTRACTING READER OF THE KEY GRAMMAR. Two private copies existed,
 * `hashOf` in `mediaTwins` and the inspector's hash in the media route, both
 * spelled to require a dot straight after the hex, so a key carrying the
 * dimension segment yielded null: no hash in the inspector and no twin
 * detection for any uploaded raster.
 *
 * Accepts a bare key or a `/media/` path and strips query and fragment, the
 * same acceptance rule as `dimensionsFromKey` and for the same reason: the
 * callers hold both forms, and `?w=320` is a transform request, not a
 * different object.
 *
 * Null is the answer for anything that is not a content key at all, including
 * an `og/` key and a static path. That is a fact, not a failure: those keys
 * carry no digest, and pretending a path prefix is a hash was the exact
 * confusion `original_name` exists to prevent.
 *
 * @param {string} keyOrPath
 * @returns {string | null}
 */
export function digestFromKey(keyOrPath) {
  const key = bareKey(keyOrPath);
  if (key === null) return null;
  const match = CONTENT_KEY_SHAPE.exec(key);
  // `?? null` rather than an assertion: the capture group cannot be absent when
  // the match succeeded, and null is already this function's "no digest here".
  return match?.groups?.digest ?? null;
}
