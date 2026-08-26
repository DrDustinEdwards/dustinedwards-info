/**
 * The two content-provenance hashes, stated once for both writers.
 *
 * `posts.source_blob_sha` and `posts.render_hash` exist so a D1 row can be
 * compared to the repository and to a fresh render without anything fetching
 * or holding a corpus artifact. Everything that WRITES either column computes
 * it here; everything that COMPARES either column compares against what this
 * module produces. A second implementation of either hash is the drift this
 * arc removed the committed artifact to end.
 *
 * Dependency-free and pure: `crypto.subtle` is global in the Worker and in
 * Node, and `TextEncoder` is the one honest way to get UTF-8 byte lengths
 * from a JS string. The git header counts BYTES, not code units; a multibyte
 * fixture in test/hashes.test.mjs exists to fail any regression to
 * `string.length`.
 *
 * @see test/hashes.test.mjs, whose expected values come from `git
 *   hash-object` and `sha256sum`, never from this module (fixture
 *   independence, hard rule 10).
 */

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
 * The git blob sha1 of a file with this exact text content.
 *
 * Computed the way git computes it: sha1 over `blob <byte length>\0` followed
 * by the bytes. Content-addressed, so it equals the sha GitHub reports for
 * the same bytes in the Contents directory listing and in a blob-creation
 * response, with no API call involved.
 *
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
 * The sha256 of one post's rendered HTML.
 *
 * Same source bytes rendered by the Worker and by the Node build must produce
 * the same value; a row whose source matches the file while this differs from
 * a fresh build is Worker-versus-Node render drift, reported by the ship-time
 * drift table in sync-content.mjs.
 *
 * @param {string} html
 * @returns {Promise<string>}
 */
export async function renderHash(html) {
  return digestHex("SHA-256", encoder.encode(html));
}
