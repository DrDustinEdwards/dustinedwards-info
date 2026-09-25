import assert from "node:assert/strict";
import test from "node:test";

import { safeHttpHref } from "../app/lib/webmention/urls.mjs";

/* The last of three href checks, and the only one that runs on the value that actually
 * reaches the attribute. */

test("it accepts http and https and returns the parser's own output", () => {
  assert.equal(safeHttpHref("https://a.example/post"), "https://a.example/post");
  assert.equal(safeHttpHref("http://a.example/post"), "http://a.example/post");
  /* The PARSER'S output, not the input: a bare origin gains its root path. */
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
  /* `new URL` trims leading control characters and whitespace, which makes a naive
   * `startsWith("javascript:")` guard useless, so the PARSER is asked for the protocol. */
  assert.equal(safeHttpHref("  javascript:alert(1)"), null);
  assert.equal(safeHttpHref("\tjavascript:alert(1)"), null);
});
