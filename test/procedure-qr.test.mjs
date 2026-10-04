import test from "node:test";
import assert from "node:assert/strict";

import { sheetQr } from "../app/lib/procedures/qr.mjs";

/* The bench sheet's QR code (app/lib/procedures/qr.mjs): an inline SVG of the address, black on white. */

test("sheetQr draws an SVG with a white ground and black modules", () => {
  const svg = sheetQr("https://dustinedwards.info/research/protocols/phage-isolation");
  assert.match(svg, /^<svg [^>]*viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /fill="#ffffff"/);
  assert.match(svg, /fill="#000000"/);
  assert.ok(!/<script|href=/.test(svg), "the SVG carries no script or link");
});

test("the same address draws the same code, and another address a different one", () => {
  const a = "https://dustinedwards.info/research/protocols/a";
  assert.equal(sheetQr(a), sheetQr(a));
  assert.notEqual(sheetQr(a), sheetQr("https://dustinedwards.info/research/protocols/b"));
});

test("an address that is not absolute http(s) is refused rather than encoded", () => {
  for (const bad of ["", "/research/protocols/a", "javascript:alert(1)", "https://x y"]) {
    assert.throws(() => sheetQr(bad), /absolute address/);
  }
});
