// The QR code on a procedure's printed sheet: an inline SVG drawn on the server, so the sheet needs no
// script and the code is in the HTML a machine reads. It encodes one absolute address.

import { renderSVG } from "uqr";

/**
 * The QR code for `url` as an SVG string. Medium error correction survives a smudged or folded sheet.
 * Black on white with a quiet zone, whatever the reader's theme, because a scanner reads contrast.
 *
 * @param {string} url an absolute http(s) address
 */
export function sheetQr(url) {
  if (!/^https?:\/\/\S+$/.test(url)) throw new Error(`A sheet's QR code encodes an absolute address; got ${JSON.stringify(url)}.`);
  return renderSVG(url, { ecc: "M", border: 2, whiteColor: "#ffffff", blackColor: "#000000" });
}
