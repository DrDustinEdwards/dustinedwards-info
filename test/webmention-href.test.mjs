import assert from "node:assert/strict";
import test from "node:test";

import { safeHttpHref } from "../app/lib/webmention/urls.mjs";

/**
 * The render-time href check, held on its own.
 *
 * `safeHttpHref` decides whether a stranger's URL may become an `href` on a
 * public page. It is the last check in a chain of three (`sourceVerdict` on the
 * way in, `readAuthor` at verification, this at render), and it is the only one
 * of the three that runs on the value that actually reaches the attribute.
 *
 * Held here rather than only in the browser gate because a pure function is the
 * part of a render a test can hold, and because the browser gate can exercise
 * exactly the two rows it seeds while this can enumerate the refusals.
 */

test("it accepts http and https and returns the parser's own output", () => {
  assert.equal(safeHttpHref("https://a.example/post"), "https://a.example/post");
  assert.equal(safeHttpHref("http://a.example/post"), "http://a.example/post");
  /* The PARSER'S output, not the input: a bare origin gains its root path,
     which is what a browser would resolve it to anyway. Asserted so the choice
     is a decision rather than a surprise. */
  assert.equal(safeHttpHref("https://a.example"), "https://a.example/");
});

test("it REFUSES every scheme that is not http or https", () => {
  const refused = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "mailto:someone@example.com",
    "ftp://a.example/x",
  ];
  for (const value of refused) {
    assert.equal(safeHttpHref(value), null, `${value} was not refused`);
  }
  /* SCOPE, ASSERTED. An empty list passes this test by examining nothing,
     which is what a clean sweep looks like. */
  assert.equal(refused.length, 7);
});

test("it REFUSES anything that is not an absolute URL at all", () => {
  for (const value of ["/relative/path", "not a url", "//protocol-relative", ""]) {
    assert.equal(safeHttpHref(value), null, `${JSON.stringify(value)} was not refused`);
  }
});

test("it REFUSES absence without throwing, since a column is nullable", () => {
  assert.equal(safeHttpHref(null), null);
  assert.equal(safeHttpHref(undefined), null);
});

test("a leading-whitespace javascript URL is still refused", () => {
  /*
   * `new URL` trims leading control characters and whitespace before parsing,
   * which is the behaviour that makes a naive `startsWith("javascript:")`
   * guard useless and is the reason this function asks the PARSER for the
   * protocol instead of reading the string.
   */
  assert.equal(safeHttpHref("  javascript:alert(1)"), null);
  assert.equal(safeHttpHref("\tjavascript:alert(1)"), null);
});
