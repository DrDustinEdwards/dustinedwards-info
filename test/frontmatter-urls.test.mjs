import test from "node:test";
import assert from "node:assert/strict";

import { frontmatterSchema } from "../app/lib/content/pipeline.mjs";

const BASE = { title: "t", slug: "a-slug", date: "2026-01-01", description: "d" };

/** @param {string} value */
const cover = (value) =>
  frontmatterSchema.safeParse({ ...BASE, cover: { src: value, alt: "a" } }).success;

/** @param {string} value */
const furtherReading = (value) =>
  frontmatterSchema.safeParse({ ...BASE, further_reading: [{ title: "x", url: value }] }).success;

/** @type {Array<[string, (v: string) => boolean, string, boolean]>} */
const CASES = [
  // ACCEPTED. These exist so a fix cannot pass by refusing everything.
  ["cover: a site-absolute media path", cover, "/media/x.png", true],
  ["cover: a generated social card", cover, "/og/a-b_c-1200x630.png", true],
  ["cover: a rendered diagram asset", cover, "/diagrams/d.svg", true],
  ["further_reading: an ordinary https url", furtherReading, "https://example.com/a", true],
  // A path, not an absolute URL, because the origin changes at cutover and a path survives it.
  ["further_reading: an internal /blog/ path", furtherReading, "/blog/a-real-post", true],

  ["cover: protocol-relative host (finding B008)", cover, "//evil.com/x.png", false],
  ["cover: javascript scheme", cover, "javascript:alert(1)", false],
  ["cover: a full absolute url", cover, "https://evil.com/x.png", false],
  ["further_reading: javascript scheme (finding B001)", furtherReading, "javascript:alert(1)", false],
  ["further_reading: data url", furtherReading, "data:text/html,x", false],
  // Further reading is things to READ: http(s) or a `/blog/` path only, though `isAllowedUrl` permits mailto.
  ["further_reading: mailto", furtherReading, "mailto:a@b.c", false],
  // Accepting paths means protocol-relative is no longer refused as a side effect, so it is pinned here.
  ["further_reading: protocol-relative host", furtherReading, "//evil.com/x", false],
  ["further_reading: a site path that is not a post", furtherReading, "/about", false],
  ["further_reading: /blog/ with no slug", furtherReading, "/blog/", false],
];

for (const [label, field, value, expected] of CASES) {
  test(`${label} is ${expected ? "accepted" : "REFUSED"}`, () => {
    assert.equal(
      field(value),
      expected,
      expected
        ? `the schema refused ${JSON.stringify(value)}, which is legitimate input`
        : `the schema ACCEPTED ${JSON.stringify(value)}`,
    );
  });
}
