// Omitting `quality` makes the Images binding return LOSSLESS WebP, larger than a lossy origin
// (measured: a 188,876 byte origin gave a 404,020 byte 640px rung). 85 is Cloudflare's documented
// default. Shared here so the transform route and the rebuild's placeholders both use it.
export const WEBP_QUALITY = 85;
