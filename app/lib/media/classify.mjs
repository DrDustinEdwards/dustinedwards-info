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
 * @param {ArrayBuffer} digest a SHA-256 digest
 * @param {string} extension
 */
export function contentKey(digest, extension) {
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 16)}.${extension}`;
}
