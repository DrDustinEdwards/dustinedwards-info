/**
 * The frontmatter URL allowlist, as BEHAVIOUR.
 *
 * Imports `frontmatterSchema` from the module the Worker imports. Testing a
 * copy would prove the copy correct and say nothing about what ships.
 *
 * WHY THESE TEN CASES. On 2026-08-07 an audit found `cover.src` validated by a
 * site-absolute path regex and NOT by `isAllowedUrl`, the shared predicate the
 * ruling says both frontmatter URL fields call. It blocked `javascript:` only
 * as a SIDE EFFECT of demanding a leading slash: the outcome was right and the
 * mechanism was wrong, which is the harder defect, because relaxing the path
 * rule for a legitimate reason would have reopened the protocol hole with
 * nothing failing.
 *
 * The refusals are the security half. **The three ACCEPTED cover paths are the
 * other half and are why this is a table rather than a list of attacks:** they
 * are what would catch a "fix" that closed the hole by rejecting real input.
 * A test suite that only asserts refusals passes on a schema that refuses
 * everything.
 *
 * `check:urls` covers the same ground from the other side: it asserts against
 * the SOURCE TEXT that both fields call the predicate, which is the part
 * behaviour cannot see. Neither replaces the other.
 */

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
  /*
   * THE INTERNAL LINK, accepted since 2026-09-03. The editor's picker writes a
   * path rather than an absolute URL because the origin changes at cutover and
   * a path survives it; the schema's own comment carries the argument.
   */
  ["further_reading: an internal /blog/ path", furtherReading, "/blog/a-real-post", true],

  // REFUSED. Each was reachable through a write path when it was found.
  ["cover: protocol-relative host (finding B008)", cover, "//evil.com/x.png", false],
  ["cover: javascript scheme", cover, "javascript:alert(1)", false],
  ["cover: a full absolute url", cover, "https://evil.com/x.png", false],
  ["further_reading: javascript scheme (finding B001)", furtherReading, "javascript:alert(1)", false],
  ["further_reading: data url", furtherReading, "data:text/html,x", false],
  /*
   * NARROWED IN THE SAME CHANGE THAT WIDENED THE FIELD, and it moved from the
   * accepted group above. `z.url()` took `mailto:` because it is a well-formed
   * absolute URL, and `isAllowedUrl` permits the protocol elsewhere; further
   * reading is a list of things to READ, so the field now takes http(s) or a
   * `/blog/` path and nothing else. No corpus post sets `further_reading`, so
   * the narrowing invalidated nothing. `isAllowedUrl` still runs and still
   * governs every other field.
   */
  ["further_reading: mailto", furtherReading, "mailto:a@b.c", false],
  /*
   * THE HOLE THE WIDENING COULD HAVE OPENED. Accepting paths means the
   * protocol-relative shape is no longer refused as a side effect of demanding
   * an absolute URL, so it is pinned here explicitly for this field, the way
   * `cover` already pins it. `/about` is the same rule from the other side: a
   * site path that is not a post is not further reading.
   */
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

/*
 * FAIL CLOSED on the table itself. A suite that lost its refusals would pass
 * while asserting nothing that matters, which is the shape hard rule 10 is
 * about: count the assertions that can fail, not the ones that ran.
 */
test("the table still carries both outcomes for both fields", () => {
  const accepted = CASES.filter(([, , , e]) => e === true);
  const refused = CASES.filter(([, , , e]) => e === false);
  assert.ok(accepted.length >= 5, `only ${accepted.length} accepted cases`);
  assert.ok(refused.length >= 5, `only ${refused.length} refused cases`);
  for (const [name, field] of [
    ["cover", cover],
    ["further_reading", furtherReading],
  ]) {
    assert.ok(
      CASES.some(([, f, , e]) => f === field && e === true) &&
        CASES.some(([, f, , e]) => f === field && e === false),
      `${name} lost one side of its coverage`,
    );
  }
});
