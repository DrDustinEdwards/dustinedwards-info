// Byte and hash encodings shared by the Worker, the build scripts and node tests. No imports and no
// Buffer: Buffer does not exist in the Worker runtime unless nodejs_compat is on.

/**
 * @param {ArrayBuffer | Uint8Array} bytes
 * @returns {string} lowercase hex, two digits a byte
 */
export function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

/**
 * Whitespace is dropped first: GitHub wraps base64 content in lines, chats and YAML add more, and
 * `atob` throws on it. Anything else that is not base64 throws.
 *
 * @param {string} value
 * @returns {Uint8Array}
 */
export function base64ToBytes(value) {
  return Uint8Array.from(atob(value.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
}

/**
 * @param {Uint8Array} bytes
 * @returns {string} standard base64, padded
 */
export function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
