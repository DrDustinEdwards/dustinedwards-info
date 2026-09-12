/**
 * Character references in registry text, decoded at the point a human reads it.
 *
 * ## THE DEFECT, WHICH HAS BEEN SHIPPING SINCE JULY
 *
 * Six character references survive into the stored corpus: one `&amp;` in a
 * journal name (Journal of Microbiology &amp; Biology Education), four `&gt;`
 * and one `&lt;` inside abstracts. The route renders an abstract as
 * `{italicizeOrganisms(p.abstract)}`, React sets that as TEXT, and a reader
 * therefore sees
 *
 *     confidence in recommending it (p &lt; 0.05)
 *
 * on the page, spelt out, instead of `p < 0.05`. It is not a rendering
 * subtlety; it is four characters of markup showing through on the most
 * quotable sentence in the phage therapy paper.
 *
 * ## WHY THE FIX IS HERE AND NOT IN THE STORED DATA
 *
 * The obvious repair is to decode on the way in and store `<`. That is the one
 * repair not available, and the reason is gated: `check:publications` asserts
 * NO STORED ABSTRACT CONTAINS A LEFT ANGLE BRACKET, paired with a count of the
 * abstracts it read. That invariant is what keeps a registry string safe in the
 * `<script type="application/ld+json">` block, in the CSL export, and in any
 * consumer that does not escape for itself. Decoding at rest would delete the
 * invariant to fix a display bug.
 *
 * So the stored form stays escaped and this runs at the boundary where text
 * becomes something a person reads: the page, the exports, the markdown twins.
 * `jsonLd()` re-escapes `<` and `>` on its own way out, so decoded text is safe
 * to hand it.
 *
 * ## ONE PASS, WHICH IS THE WHOLE OF THE CORRECTNESS ARGUMENT
 *
 * `&amp;lt;` must decode to `&lt;` and stop. A two-step implementation that
 * replaces `&lt;` and then `&amp;` produces `<` instead, which is the classic
 * double-decode hole: text that was escaped twice on purpose comes out as
 * markup. A single `replace` over one alternation cannot do that, because the
 * replacement is never rescanned.
 *
 * Written as a `\u` escape nowhere and as literal ASCII throughout, because
 * every character this file names is ASCII.
 *
 * ## UNKNOWN NAMES ARE LEFT ALONE, DELIBERATELY
 *
 * This decodes the five XML predefined entities and numeric references, and
 * returns anything else verbatim. It is NOT an HTML entity table and should not
 * become one: the corpus contains three distinct names, a full table would be
 * several kilobytes in the Worker for entities no registry here deposits, and
 * an unrecognised `&foo;` left as `&foo;` is visibly wrong in a way somebody
 * reports, while a wrong guess at what it meant is not.
 */

/** The five XML predefined entities. Case-sensitive, as the spec defines them. */
const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/**
 * Decimal, hex, or a name, in ONE alternation so nothing is rescanned.
 * Built with `new RegExp` for no reason other than symmetry with the other
 * patterns in this corpus; a literal would be identical here.
 */
const REFERENCE = /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g;

/**
 * A code point turned into a string, or `null` when it is not one.
 *
 * `String.fromCodePoint` THROWS on an out-of-range value, and a registry is
 * exactly the kind of input that eventually carries `&#1114112;`. A throw here
 * would take down a page render over a typo in somebody's deposit, so the
 * range is checked first and an impossible value falls through to "leave it
 * verbatim", which is this module's answer to everything it does not
 * understand.
 *
 * @param {number} code
 * @returns {string | null}
 */
function fromCodePoint(code) {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return null;
  // Lone surrogates are valid integers and produce unpaired halves.
  if (code >= 0xd800 && code <= 0xdfff) return null;
  return String.fromCodePoint(code);
}

/**
 * Decode character references in registry-sourced text.
 *
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
