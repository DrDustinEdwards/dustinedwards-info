/* `citation_pdf_url` must sit in the abstract page's subdirectory (Google Scholar's condition),
 * so the old flat PDF paths redirect. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  paperSlashTarget,
  pdfRedirectStatus,
  pdfRedirectTarget,
} from "../app/lib/publications/pdf-redirect.mjs";

const MAP = {
  "/publications/edwards-2025-godfather.pdf":
    "/publications/10-1128-mra-00888-24/dustin-edwards-10-1128-mra-00888-24.pdf",
};

test("a moved PDF redirects to its new path", () => {
  assert.equal(
    pdfRedirectTarget("/publications/edwards-2025-godfather.pdf", MAP),
    "/publications/10-1128-mra-00888-24/dustin-edwards-10-1128-mra-00888-24.pdf",
  );
});

test("a path outside the publications prefix is refused", () => {
  // The map is consulted only under its own prefix, so its contents can never
  // become load-bearing for the rest of the site.
  assert.equal(pdfRedirectTarget("/blog/edwards-2025-godfather.pdf", MAP), null);
  assert.equal(pdfRedirectTarget("/edwards-2025-godfather.pdf", MAP), null);
});

test("an unmapped path under the prefix is refused", () => {
  assert.equal(pdfRedirectTarget("/publications/not-a-real-file.pdf", MAP), null);
});

test("an INHERITED key is not a redirect", () => {
  // `MAP.constructor` is truthy. A bare lookup would answer a 301 here.
  assert.equal(pdfRedirectTarget("/publications/constructor", MAP), null);
  assert.equal(pdfRedirectTarget("/publications/toString", MAP), null);
  assert.equal(pdfRedirectTarget("/publications/__proto__", MAP), null);
});

test("a target outside the prefix is refused even when the map says so", () => {
  // The map is committed data, so a foreign target means it was edited into something this
  // module should not be serving.
  assert.equal(
    pdfRedirectTarget("/publications/x.pdf", { "/publications/x.pdf": "/admin" }),
    null,
  );
  assert.equal(
    pdfRedirectTarget("/publications/x.pdf", {
      "/publications/x.pdf": "https://example.invalid/x.pdf",
    }),
    null,
  );
});

test("bad input is refused rather than thrown on", () => {
  assert.equal(pdfRedirectTarget(null, MAP), null);
  assert.equal(pdfRedirectTarget("/publications/x.pdf", null), null);
  assert.equal(pdfRedirectTarget("/publications/x.pdf", { "/publications/x.pdf": "" }), null);
});

test("the slashless paper URL redirects to the slash form", () => {
  assert.equal(
    paperSlashTarget("/publications/10-1128-mra-00888-24"),
    "/publications/10-1128-mra-00888-24/",
  );
});

test("paperSlashTarget NEVER claims an asset path", () => {
  // The load-bearing case. A request for the PDF is on its way to the static
  // handler; redirecting it would loop, and the loop would only appear for
  // papers whose file had been removed.
  assert.equal(
    paperSlashTarget("/publications/10-1128-mra-00888-24/dustin-edwards-10-1128-mra-00888-24.pdf"),
    null,
  );
  assert.equal(paperSlashTarget("/publications/anything.pdf"), null);
  assert.equal(paperSlashTarget("/publications/x.md"), null);
});

test("paperSlashTarget leaves the index and the already-slashed form alone", () => {
  assert.equal(paperSlashTarget("/publications"), null);
  assert.equal(paperSlashTarget("/publications/"), null);
  assert.equal(paperSlashTarget("/publications/10-1128-mra-00888-24/"), null);
});

test("301 for GET and HEAD, 308 otherwise", () => {
  assert.equal(pdfRedirectStatus("GET"), 301);
  assert.equal(pdfRedirectStatus("head"), 301);
  assert.equal(pdfRedirectStatus("POST"), 308);
  assert.equal(pdfRedirectStatus(undefined), 308);
});

test("the COMMITTED map resolves end to end, for every entry", () => {
  /* `check:machine-readable` checks the map as data; this checks the PREDICATE agrees, so a
   * map that is correct but unreachable through the function still fails. */
  const { pdfs } = JSON.parse(readFileSync("content/redirects.json", "utf8"));
  const entries = Object.entries(pdfs);
  assert.ok(entries.length > 0, "the committed map is populated");
  for (const [from, to] of entries) {
    assert.equal(pdfRedirectTarget(from, pdfs), to, `${from} should resolve`);
  }
});
