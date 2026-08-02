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
