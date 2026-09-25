// Decoded where a person reads it, never at rest: check:machine-readable asserts no stored abstract
// contains <, which keeps registry text safe in JSON-LD and exports. One alternation in one pass, so
// &amp;lt; decodes to &lt; and stops. Unknown names are left verbatim on purpose.

const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

const REFERENCE = /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g;

/**
 * String.fromCodePoint throws out of range, which would fail a render over one bad deposit.
 *
 * @param {number} code
 * @returns {string | null}
 */
function fromCodePoint(code) {
  // Zero too: &#0; is a NUL, which no reader should receive from a deposit or a feed.
  if (!Number.isInteger(code) || code < 1 || code > 0x10ffff) return null;
  // Lone surrogates are valid integers and produce unpaired halves.
  if (code >= 0xd800 && code <= 0xdfff) return null;
  return String.fromCodePoint(code);
}

/**
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function decodeEntities(text) {
  return String(text ?? "").replace(REFERENCE, (whole, dec, hex, name) => {
    if (dec !== undefined) return fromCodePoint(Number(dec)) ?? whole;
    if (hex !== undefined) return fromCodePoint(Number.parseInt(hex, 16)) ?? whole;
    return Object.prototype.hasOwnProperty.call(NAMED, name)
      ? /** @type {string} */ (NAMED[/** @type {keyof NAMED} */ (name)])
      : whole;
  });
}
