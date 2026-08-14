/**
 * Colour contrast maths: sRGB parsing, WCAG 2.2 relative luminance and ratio,
 * and APCA signed Lc.
 *
 * A .mjs rather than a .ts for the reason `app/lib/search/query.mjs` is: the
 * Worker imports it AND `npm run check:contrast` imports it, so the gate
 * computes with exactly the functions that ship rather than a copy of their
 * rules. `/playground`'s contrast lab renders what the gate would compute, and
 * there is no second implementation of the law for the two to drift apart on.
 *
 * EXTRACTED from scripts/check-contrast.mjs, byte-identical. The gate's own
 * assertions are the regression test for the move: it verifies this `apca`
 * against all EIGHT published apca-w3 0.1.9 keystone vectors and recomputes the
 * whole 76-pair matrix from the shipped stylesheet, so a transcription error
 * here fails there. Measured before and after the extraction: 599 checks, 0
 * failures, `apcaWorstDelta` 0.00e+0 both times.
 *
 * WHAT THIS MODULE IS NOT. It does not read the stylesheet, name a token, hold a
 * threshold, or know which pairs the design system ratifies. All of that stays
 * in the gate, which is what keeps `check:contrast` reading TWO INDEPENDENT
 * SOURCES: the hexes come from the stylesheet that ships, the pairs come from
 * the transcribed matrix, and this module is only the arithmetic between them.
 * Fixture independence is therefore untouched by the extraction.
 *
 * Pure: no filesystem, no network, no clock, no module state. Safe in a Worker,
 * in a browser and in a build script.
 */

/**
 * sRGB channels, 0 to 1. Accepts `#rgb`, `#rrggbb`, with or without the hash.
 *
 * @param {string} hex
 */
export function channels(hex) {
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

/** WCAG 2.x relative luminance. @param {string} hex */
export function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1 to 21. @param {string} a @param {string} b */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * APCA (SAPC) lightness contrast, W3C draft 0.1.9 constants.
 *
 * Advisory only. It is reported because the dark-mode fills rule was decided on
 * it: the dark semantic pastels clear WCAG comfortably and APCA still rates
 * them around Lc 57 to 60, which is why interactive semantics take fills.
 * Sign carries polarity; magnitude is what is compared.
 *
 * @param {string} textHex
 * @param {string} bgHex
 */
export function apca(textHex, bgHex) {
  /** @param {string} hex */
  const Y = (hex) => {
    const [r, g, b] = channels(hex);
    return 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  };
  /** @param {number} y */
  const clampBlack = (y) => (y < 0.022 ? y + (0.022 - y) ** 1.414 : y);

  const Ytxt = clampBlack(Y(textHex));
  const Ybg = clampBlack(Y(bgHex));
  if (Math.abs(Ybg - Ytxt) < 0.0005) return 0;

  let out;
  if (Ybg > Ytxt) {
    const sapc = (Ybg ** 0.56 - Ytxt ** 0.57) * 1.14;
    out = sapc < 0.1 ? 0 : sapc - 0.027;
  } else {
    const sapc = (Ybg ** 0.65 - Ytxt ** 0.62) * 1.14;
    out = sapc > -0.1 ? 0 : sapc + 0.027;
  }
  return out * 100;
}

/**
 * Normalises a hex to `#rrggbb` lower case, or returns null if it is not one.
 *
 * The lab's input validator. It is here rather than in the route because it must
 * agree with `channels()` about what a hex IS: a route that accepted a string
 * `channels()` then threw on would render a 500 instead of a boring error, and a
 * route that refused one `channels()` accepts would be a second, stricter rule.
 * Parsing through `channels()` is what keeps the two answers the same one.
 *
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeHex(input) {
  try {
    const [r, g, b] = channels(input);
    return `#${[r, g, b]
      .map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
      .join("")}`;
  } catch {
    return null;
  }
}
