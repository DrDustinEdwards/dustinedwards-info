/**
 * The vintage-ad theme slot for the utility pages (docs/UTILITY-ADS.md). Pure functions, no framework, so the same
 * checks run in a test and the same geometry runs on the server: an ad is data in `<id>/ad.json` plus symbols in
 * `<id>/art.svg`, and everything here only reads it.
 */

/** The lettering. Display and slab are the two self-hosted Open Font License faces; serif is the site's own Source Serif 4. */
const FONTS = ["display", "slab", "serif"];

const PART_KINDS = ["text", "burst", "rect", "use"];

const ID = /^[a-z][a-z0-9-]*$/;
const HEX = /^#[0-9a-f]{6}$/i;

/** A fill is a hex color, or "ink": the page's text color for the ad, light in dark mode, so copy never vanishes into the page. */
const isFill = (/** @type {unknown} */ value) =>
  value === "ink" || (typeof value === "string" && HEX.test(value));

/**
 * Everything wrong with an ad's data, as sentences; an empty list is a valid ad.
 * @param {any} ad the parsed ad.json
 * @param {string} art the raw art.svg of the same folder
 * @returns {string[]}
 */
export function adProblems(ad, art) {
  /** @type {string[]} */
  const out = [];
  if (typeof ad?.id !== "string" || !ID.test(ad.id)) out.push("id must be kebab-case");
  if (!ad?.title) out.push("title is missing");
  if (!/^19[4-7]0s$/.test(ad?.era ?? "")) out.push("era must be 1940s to 1970s");
  if (!ad?.credit) out.push("credit is missing (say who made the art and copy)");
  const [w, h] = Array.isArray(ad?.viewBox) ? ad.viewBox : [0, 0];
  if (!(w > 0 && h > 0)) out.push("viewBox must be [width, height]");
  const symbols = new Set([...art.matchAll(/<symbol\s+id="([^"]+)"/g)].map((m) => m[1]));
  for (const [i, part] of (ad?.parts ?? []).entries()) {
    const at = `parts[${i}]`;
    if (!PART_KINDS.includes(part.kind)) {
      out.push(`${at}.kind is unknown`);
      continue;
    }
    if (part.kind === "text") {
      if (!FONTS.includes(part.font)) out.push(`${at}.font must be one of ${FONTS.join(", ")}`);
      if (!Array.isArray(part.lines) || part.lines.length === 0) out.push(`${at}.lines is empty`);
      if (!isFill(part.fill)) out.push(`${at}.fill must be a hex color or "ink"`);
      if (!(part.size > 0)) out.push(`${at}.size must be positive`);
    }
    if (part.kind === "use" && !symbols.has(part.ref))
      out.push(`${at}.ref "${part.ref}" is not a symbol in art.svg`);
    if (part.kind === "burst" && !(part.outer > part.inner && part.inner > 0))
      out.push(`${at} needs outer > inner > 0`);
    const x = part.x ?? part.cx;
    const y = part.y ?? part.cy;
    if (!(x >= 0 && x <= w && y >= 0 && y <= h))
      out.push(`${at} is placed outside the ${w} by ${h} box`);
  }
  return out;
}

/**
 * The points of a starburst: `points` spikes alternating between `outer` and `inner` radius.
 * @param {number} cx
 * @param {number} cy
 * @param {number} outer
 * @param {number} inner
 * @param {number} points
 * @returns {string} an SVG `points` value
 */
export function burstPoints(cx, cy, outer, inner, points) {
  const out = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    out.push(
      `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`,
    );
  }
  return out.join(" ");
}

/**
 * Prefix an art file's ids (and its internal links) with the ad's id, so two ads' symbols never collide.
 * @param {string} art
 * @param {string} adId
 */
export function scopeArt(art, adId) {
  return art
    .replace(/\bid="([^"]+)"/g, `id="ad-${adId}-$1"`)
    .replace(/href="#([^"]+)"/g, `href="#ad-${adId}-$1"`);
}

/**
 * The ad a request gets: the one named by `?ad=` when it exists (so a link can show one), else a random one.
 * @template {{ id: string }} T
 * @param {T[]} ads
 * @param {string} search the URL's query string
 * @param {() => number} [random] a number in [0, 1), `Math.random` by default
 * @returns {T | undefined}
 */
export function chooseAd(ads, search, random = Math.random) {
  const named = new URLSearchParams(search).get("ad");
  return ads.find((ad) => ad.id === named) ?? ads[Math.floor(random() * ads.length)];
}
