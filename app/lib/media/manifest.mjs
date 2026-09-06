/**
 * Where the static asset manifest lives, stated ONCE.
 *
 * REPO-RELATIVE AND POSIX, because that is the spelling every reader needs but
 * one. The Worker asks GitHub for it by this exact string; `check:content` and
 * `build:assets` want a filesystem path and derive one by splitting on the
 * slash, which is the direction that is safe on both platforms. Written the
 * other way round, a Windows `path.join` would hand the GitHub contents API
 * `content\generated\assets.json` and get a 404 that reads like a missing file.
 *
 * `.mjs` and dependency-free on the rule `classify.mjs` and `widths.mjs`
 * follow: a Worker module and a build script both import it, so it may not
 * carry an import either of them cannot resolve.
 */

/** The manifest `build:assets` writes and both markdown writers read. */
export const ASSET_MANIFEST_PATH = "content/generated/assets.json";

/**
 * The manifest's shape, for the readers that parse it rather than import it.
 *
 * One placeholder entry is the data URI plus the digest of the bytes it was
 * derived FROM, which is what lets `check:content` tell a current entry from
 * one whose source file was edited underneath it.
 *
 * @typedef {{ sha: string, lqip: string }} AssetPlaceholder
 * @typedef {{ generated?: number, paths?: string[], placeholders?: Record<string, AssetPlaceholder> }} AssetManifest
 */
