/**
 * @param {string} hex
 * @returns {[number, number, number]}
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
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex color: ${hex}`);
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

/** @param {string} hex */
export function luminance(hex) {
  // Destructured before the transform: `.map` over a tuple loses its length for the type checker.
  const [r, g, b] = channels(hex);
  /** @param {number} c */
  const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** @param {string} a @param {string} b */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * APCA, W3C draft 0.1.9 constants. Sign carries polarity; magnitude is what is compared.
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
