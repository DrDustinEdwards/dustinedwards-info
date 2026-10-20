/* `citation_pdf_url` must sit in the abstract page's subdirectory (Google Scholar's condition),
 * so the slashless paper URL redirects to the slash form. */

import test from "node:test";
import assert from "node:assert/strict";

import { paperSlashTarget, pdfRedirectStatus } from "../app/lib/publications/pdf-redirect.mjs";

await test("the slashless paper URL redirects to the slash form", () => {
  assert.equal(
    paperSlashTarget("/research/publications/10-1128-mra-00888-24"),
    "/research/publications/10-1128-mra-00888-24/",
  );
});

await test("paperSlashTarget NEVER claims an asset path", () => {
  // The load-bearing case. A request for the PDF is on its way to the static
  // handler; redirecting it would loop, and the loop would only appear for
  // papers whose file had been removed.
  assert.equal(
    paperSlashTarget("/research/publications/10-1128-mra-00888-24/dustin-edwards-10-1128-mra-00888-24.pdf"),
    null,
  );
  assert.equal(paperSlashTarget("/research/publications/anything.pdf"), null);
  assert.equal(paperSlashTarget("/research/publications/x.md"), null);
});

await test("paperSlashTarget leaves the index and the already-slashed form alone", () => {
  assert.equal(paperSlashTarget("/research/publications"), null);
  assert.equal(paperSlashTarget("/research/publications/"), null);
  assert.equal(paperSlashTarget("/research/publications/10-1128-mra-00888-24/"), null);
});

await test("301 for GET and HEAD, 308 otherwise", () => {
  assert.equal(pdfRedirectStatus("GET"), 301);
  assert.equal(pdfRedirectStatus("head"), 301);
  assert.equal(pdfRedirectStatus("POST"), 308);
  assert.equal(pdfRedirectStatus(undefined), 308);
});
