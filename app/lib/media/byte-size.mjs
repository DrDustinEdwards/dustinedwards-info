/**
 * Decimal unit names but BINARY division, deliberately: changing it restates every size on the media page.
 *
 * @param {number} size
 * @returns {string}
 */
export function byteSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} kB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
