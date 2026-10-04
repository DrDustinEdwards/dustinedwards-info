import test from "node:test";
import assert from "node:assert/strict";

import { FOOTER_COLUMNS } from "../app/lib/footer.ts";
import { LICENSE_LINK, TERMS_PATH } from "../app/lib/license.mjs";
import { exportHeaders } from "../app/lib/publications/export-response.mjs";
import { LICENSE_URL, SITE_ORIGIN } from "../app/lib/seo.ts";

// The license on every data set is the site's terms page (Dustin, 2026-10-04). The Dataset JSON-LD is held by
// test/worker/structured-data.test.ts; these hold the downloads, which have no field to put it in, and the
// footer link, which is how a visitor finds the page.

test("the license address is the terms page, stored once", () => {
  assert.equal(TERMS_PATH, "/terms");
  assert.equal(LICENSE_URL, `${SITE_ORIGIN}${TERMS_PATH}`);
});

test("every publications export names the terms as its license in the Link header", () => {
  for (const [type, filename] of [
    ["application/vnd.citationstyles.csl+json", "publications.json"],
    ["application/x-research-info-systems", "publications.ris"],
    ["application/x-bibtex", "publications.bib"],
  ]) {
    assert.equal(exportHeaders(type, "public, max-age=0", filename).link, LICENSE_LINK, filename);
  }
  assert.equal(LICENSE_LINK, '</terms>; rel="license"');
});

test("the footer links the terms page", () => {
  const links = FOOTER_COLUMNS.flatMap((column) => column.items).filter((item) => item.to === TERMS_PATH);
  assert.equal(links.length, 1);
});
