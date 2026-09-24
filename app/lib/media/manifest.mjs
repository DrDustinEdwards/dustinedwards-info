// Repo-relative POSIX: the Worker asks GitHub for this exact string, and a Windows `path.join`
// spelling would get a 404. Filesystem readers derive their path by splitting on the slash.
export const ASSET_MANIFEST_PATH = "content/generated/assets.json";

/**
 * @typedef {{ sha: string, lqip: string }} AssetPlaceholder
 * @typedef {{ generated?: number, paths?: string[], placeholders?: Record<string, AssetPlaceholder> }} AssetManifest
 */
