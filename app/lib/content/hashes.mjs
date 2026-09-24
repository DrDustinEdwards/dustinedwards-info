// Every writer and comparer of posts.source_blob_sha and posts.render_hash uses this module;
// a second implementation is drift. The git header counts UTF-8 BYTES, not string.length.

const encoder = new TextEncoder();

/**
 * @param {"SHA-1" | "SHA-256"} algorithm
 * @param {Uint8Array<ArrayBuffer>} bytes
 * @returns {Promise<string>} lowercase hex
 */
async function digestHex(algorithm, bytes) {
  const digest = await crypto.subtle.digest(algorithm, bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * @param {string} source the whole file, frontmatter included
 * @returns {Promise<string>}
 */
export async function gitBlobSha(source) {
  const body = encoder.encode(source);
  const header = encoder.encode(`blob ${body.byteLength}\0`);
  const framed = new Uint8Array(header.byteLength + body.byteLength);
  framed.set(header, 0);
  framed.set(body, header.byteLength);
  return digestHex("SHA-1", framed);
}

/**
 * @param {string} html
 * @returns {Promise<string>}
 */
export async function renderHash(html) {
  return digestHex("SHA-256", encoder.encode(html));
}
