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
  // The SIL OFL requires the font licence to be served with the fonts.
  ["txt", { kind: "document", mime: "text/plain; charset=utf-8" }],
  // No woff2: fonts live in app/fonts/, so a webfont dropped into public/ should stop the build.
]);

const RASTER = new Set(["png", "jpg", "jpeg", "webp", "avif", "gif"]);

/**
 * The "" for no extension is load-bearing: `classify()` throws on it, which stops the build.
 * Not the display label; that is `extensionLabel` in media-document-card.tsx.
 *
 * @param {string} pathOrKey
 */
export function extensionOf(pathOrKey) {
  const base = pathOrKey.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

/**
 * THROWS on an unknown extension: a new file type under `public/` must stop the build, not get a
 * plausible `kind` nobody chose.
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

// Deploy-time control files: Cloudflare consumes them and never serves them. Named, not a rule, because
// "skip anything extensionless" would fail open. Do NOT add /fonts/dustin-edwards-ofl.txt: it is served,
// so it is an asset; if index drift reports it, the repair is the rebuild on /admin/media.
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

// A pattern is allowed here because it matches only the slug shape paths.mjs generates. The twins are
// gitignored build product, not media; llms.txt lists them and check:machine-readable reconciles it.
const NOT_ASSET_PATTERNS = [
  {
    test: /^\/publications\/[a-z0-9-]+\.md$/,
    why:
      "A generated markdown twin of a paper, gitignored build product served " +
      "as an asset. Listed in llms.txt and reconciled by check:machine-readable; " +
      "not media, and not committed, so not in this manifest.",
  },
];

/**
 * @param {string} pathOrKey
 * @returns {string | null}
 */
export function excludedFromAssets(pathOrKey) {
  const named = NOT_ASSETS.get(pathOrKey);
  if (named) return named;
  return NOT_ASSET_PATTERNS.find((rule) => rule.test.test(pathOrKey))?.why ?? null;
}

/**
 * @param {string} pathOrKey
 */
export function isRaster(pathOrKey) {
  return RASTER.has(extensionOf(pathOrKey));
}

/**
 * Static assets are indexed under their public path, which starts with `/`; an R2 key never does.
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
 * Typed generically rather than against `Env`: this module is shared with the Node build scripts.
 * A `static` key resolves to MEDIA, where the miss is loud in the index drift check.
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
 * Diagrams are light/dark pairs, so inserting one alone bypasses `:::diagram`; hence `generated`.
 * `icon` is fetched by the platform (a `<link rel>` or the webmanifest); `brand` is named by
 * application code. The default is `content`: an unknown asset should be visible in the picker.
 *
 * @param {string} pathOrKey
 * @returns {"content" | "brand" | "generated" | "icon"}
 */
export function roleOf(pathOrKey) {
  if (pathOrKey.startsWith("og/")) return "generated";
  if (pathOrKey.startsWith("/diagrams/")) return "generated";

  // The OG image is brand, not icon: `seo.ts` names it as the default social card.
  if (/^\/dustin-edwards-(logo(-[a-z]+)*\.svg|favicon\.svg|og-image\.png)$/.test(pathOrKey)) {
    return "brand";
  }

  // `favicon.ico` and `site.webmanifest` keep unprefixed names because browsers request them unprompted.
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
 * Roster photos may not be cropped: `fit=cover` cuts faces off group photographs. Keyed on the path,
 * so if these move to content-addressed R2 keys this must become a stored property.
 *
 * @param {string} pathOrKey
 */
export function cropSafe(pathOrKey) {
  return !pathOrKey.startsWith("/phage-hunters/");
}

/**
 * 16 hex characters (64 bits) is ample at this corpus size. The key carries `-<w>x<h>` so the Node build
 * and the Worker produce the same stored HTML without either reading bytes; the digest pins the bytes,
 * so it cannot go stale. The same image under two names is two objects.
 *
 * @param {ArrayBuffer} digest
 * @param {string} extension
 * @param {{ width: number, height: number } | null} [dimensions]
 * @param {string | null} [name]
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

export const ASSET_PREFIX = "dustin-edwards-";

/**
 * Capped at 48 so whoever names the upload cannot decide key length. A name already carrying the
 * prefix loses it, or re-uploading a downloaded file would double it.
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

// The only statement of the key grammar. No character class admits a slash, so static paths, `og/` keys
// and traversal all fail. Named groups, not indices. The slug is GREEDY so the LAST 16-hex run is the
// digest. `[1-9]` refuses a leading-zero dimension; the parameter type keeps `contentKey` from writing one.
const CONTENT_KEY_SHAPE =
  /^dustin-edwards-(?:(?<slug>[a-z0-9][a-z0-9-]*)-)?(?<digest>[0-9a-f]{16})(?:-(?<width>[1-9]\d{0,4})x(?<height>[1-9]\d{0,4}))?\.[a-z0-9]+$/;

/**
 * `?w=320` is a transform request, not a different object, so query and fragment come off.
 *
 * @param {string} keyOrPath
 * @returns {string | null}
 */
function bareKey(keyOrPath) {
  if (typeof keyOrPath !== "string") return null;
  const path = keyOrPath.split(/[?#]/)[0] ?? "";
  return path.startsWith("/media/") ? path.slice("/media/".length) : path;
}

/**
 * Strict: a malformed, zero or oversized segment returns null, which fails the build at the call site
 * rather than silently dropping the dimensions that prevent layout shift.
 *
 * @param {string} keyOrPath
 * @returns {{ width: number, height: number } | null}
 */
export function dimensionsFromKey(keyOrPath) {
  const key = bareKey(keyOrPath);
  if (key === null) return null;
  const match = CONTENT_KEY_SHAPE.exec(key);
  if (!match || match.groups?.width === undefined) return null;
  return { width: Number(match.groups.width), height: Number(match.groups.height) };
}

/**
 * Nothing outside this module may parse a content key (test/media-key-grammar.test.mjs).
 *
 * @param {string} key a bare key, never a `/media/` path
 * @returns {boolean}
 */
export function isContentKey(key) {
  return typeof key === "string" && CONTENT_KEY_SHAPE.test(key);
}

/**
 * @param {string} keyOrPath
 * @returns {string | null}
 */
export function digestFromKey(keyOrPath) {
  const key = bareKey(keyOrPath);
  if (key === null) return null;
  const match = CONTENT_KEY_SHAPE.exec(key);
  return match?.groups?.digest ?? null;
}
