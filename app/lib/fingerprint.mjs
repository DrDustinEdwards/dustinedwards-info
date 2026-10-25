// A short stable fingerprint shared by the Worker, the build scripts and node tests. The byte encodings (hex, base64)
// are site-runtime's ./encoding.

/**
 * FNV-1a, 32 bits, over UTF-16 code units: a short stable fingerprint, not a security boundary.
 *
 * @param {string} input
 * @returns {string} eight lowercase hex digits
 */
export function fnv1a32(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
