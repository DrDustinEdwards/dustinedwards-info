/**
 * WHICH DECISIONS VOLUME IS ACTIVE, AND HAS IT PASSED ITS OWN FREEZE POINT. Pure, so the replay
 * proof can drive it without a network; the fetching lives in the gate.
 *
 * BOUNDARY: the limit is READ from the volume that owns it and never restated here, the one-owner rule,
 * and ACTIVE is the highest NUMBER rather than the title, which is measured: volumes frozen for
 * days still carry "(active)". Everything below the highest is history and is not checked.
 */

/**
 * KB as 1024 bytes. Stated once, here, because two readings of "KB" would be two owners of the
 * threshold.
 */
export const BYTES_PER_KB = 1024;

/**
 * `decisions-vol-<n>.md`. The unnumbered volume is long frozen, is not matched, and cannot be
 * the highest number.
 */
const VOLUME_PATH = /^decisions-vol-(\d+)\.md$/;

/**
 * The limit a volume states for itself.
 *
 * @param {string} body
 * @returns {number | null} bytes, or null when the volume states no limit
 */
export function parseFreezeLimit(body) {
  /*
   * Anchored on the words, not on the emphasis: two volumes write the phrase with different markup
   * around it, and matching that would make the gate care about styling, which is the kind of needle
   * that silently stops matching.
   */
  const m = /Freeze at (\d+)\s*KB/.exec(body);
  return m ? Number(m[1]) * BYTES_PER_KB : null;
}

/**
 * @param {Array<{path: string, title?: string, body: string}>} docs
 * @returns {{
 *   volumes: Array<{path: string, n: number, bytes: number}>,
 *   active: {path: string, n: number, bytes: number, limit: number | null} | null,
 *   staleTitles: string[],
 * }}
 */
export function classifyVolumes(docs) {
  const volumes = [];
  for (const d of docs) {
    const m = VOLUME_PATH.exec(d.path);
    if (!m) continue;
    volumes.push({
      path: d.path,
      n: Number(m[1]),
      bytes: Buffer.byteLength(d.body ?? "", "utf8"),
      title: d.title ?? "",
      body: d.body ?? "",
    });
  }
  volumes.sort((a, b) => a.n - b.n);

  const top = volumes.length ? volumes[volumes.length - 1] : null;
  const active = top
    ? { path: top.path, n: top.n, bytes: top.bytes, limit: parseFreezeLimit(top.body) }
    : null;

  /*
   * REPORTED, NOT FAILED. A volume below the top that still says "(active)" is a stale title, and
   * failing on it would red the gate over history nobody is going to retitle; naming them is how the
   * next reader learns the titles cannot be trusted.
   */
  const staleTitles = volumes
    // The looser word boundary rather than the exact parenthesis: four volumes are titled with a word
    // after "active", and the tighter needle missed all of them, which is the vacuity rule's
    // anchor-every-needle discipline arriving as a number.
    .filter((v) => v !== top && /\(active\b/i.test(v.title))
    .map((v) => v.path);

  return {
    volumes: volumes.map((v) => ({ path: v.path, n: v.n, bytes: v.bytes })),
    active,
    staleTitles,
  };
}
