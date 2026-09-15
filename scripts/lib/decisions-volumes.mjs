/**
 * WHICH DECISIONS VOLUME IS ACTIVE, AND HAS IT PASSED ITS OWN FREEZE POINT.
 *
 * Pure, so the replay proof can drive it without a network. The fetching lives
 * in check-volumes.mjs; everything that can be wrong about the ANSWER is here.
 *
 * ## THE DEFECT THIS IS FOR
 *
 * Every volume's header states its own limit, "Freeze at 20KB." Vol 17
 * respected it and froze at 20.6KB. Vol 18 ran to 36,667 bytes, 79 percent
 * past, and stayed there for four days. Nothing gated it: the limit was a
 * sentence inside the artifact it limited, enforced by whoever happened to read
 * it. Third instance in two days, after the carried-token map's build-4
 * deadline and check:contrast's pairs against surfaces nothing paints.
 *
 * ## THE LIMIT IS READ, NEVER HARD-CODED
 *
 * Hard rule 17, one owner per fact. The number lives in the volume that owns
 * it, this parses it, and nothing here restates it. A volume that wants a
 * different limit says so in its own header and this follows.
 *
 * ## "ACTIVE" IS THE HIGHEST NUMBER, NOT THE TITLE, AND THAT IS MEASURED
 *
 * The obvious test is the title, which says "(active)" or "(FROZEN ...)". It
 * does not work, and the reason is the finding rather than an inconvenience:
 * MEASURED 2026-09-15 across the namespace, volumes frozen for days still carry
 * "(active)" in their titles, while vol 18's own header records vol 17 as
 * frozen on 2026-09-11. Capsid's `status` field is no better: vol 18 is
 * "published" while vols 2 to 5, frozen since August, are "active".
 *
 * THE COUNT IS THE GATE'S TO PRINT, not this comment's to carry. check:volumes
 * names them on every run; a number written here would be a second owner that
 * rots, which is the rule this whole gate exists to enforce elsewhere.
 *
 * A title is a written record read as a current property, which is the shape
 * FAILURES.md carries a line about. So it is not the signal. The HIGHEST
 * NUMBERED volume is the active one, which is true by construction: a new
 * volume is opened by taking the next number, and that is the act of freezing
 * the previous one whether or not anybody retitled it.
 *
 * Everything below the highest number is history and is NOT checked. A frozen
 * volume over its limit is a fact about the day it froze; failing on it would
 * red the gate forever over something nobody can now change, and a gate that
 * cannot go green is one somebody deletes.
 */

/** KB as 1024 bytes. Stated once, here, because two readings of "KB" would be
 *  two owners of the threshold. */
export const BYTES_PER_KB = 1024;

/** `decisions-vol-<n>.md`. `decisions.md` is vol 6 by its title alone and is
 *  long frozen; it is not matched, and it cannot be the highest number. */
const VOLUME_PATH = /^decisions-vol-(\d+)\.md$/;

/**
 * The limit a volume states for itself.
 * @param {string} body
 * @returns {number | null} bytes, or null when the volume states no limit
 */
export function parseFreezeLimit(body) {
  /*
   * Anchored on the words, not on the emphasis. Vol 18 writes it bare inside a
   * bold run and vol 19 writes it as its own bold phrase; matching the markdown
   * would make the gate care about styling, which is the kind of needle that
   * silently stops matching.
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
   * REPORTED, NOT FAILED. A volume below the top that still says "(active)" is
   * a stale title, and there are eleven of them. Failing on it would red the
   * gate over history nobody is going to retitle; naming them is the useful
   * half, and it is how the next reader learns the titles cannot be trusted.
   */
  const staleTitles = volumes
    // `\(active\b` rather than `\(active\)`: vols 2 to 5 are titled "Decisions
    // (active volume)", and the tighter needle missed all four of them. The
    // count this reports moved from 8 to 12 on that one character, which is
    // hard rule 10's anchor-every-needle discipline arriving as a number.
    .filter((v) => v !== top && /\(active\b/i.test(v.title))
    .map((v) => v.path);

  return {
    volumes: volumes.map((v) => ({ path: v.path, n: v.n, bytes: v.bytes })),
    active,
    staleTitles,
  };
}
