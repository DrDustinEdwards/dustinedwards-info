/* `caches.default` carries no headers, so `Vary: Accept` cannot be honored there. Every browser
 * string below must stay CACHEABLE, or excluding every reader would "fix" the markdown case. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  acceptQValues,
  negotiatesAwayFromHtml,
  prefersType,
} from "../app/lib/negotiate.mjs";

/** @param {string} [accept] */
const req = (accept) =>
  new Request("https://example.test/blog/a-post", {
    headers: accept === undefined ? {} : { accept },
  });

/* Real browser headers, copied rather than invented. */
const BROWSERS = {
  chrome:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  firefox: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  safari: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

test("every real browser request stays cacheable", () => {
  for (const [name, accept] of Object.entries(BROWSERS)) {
    assert.equal(
      negotiatesAwayFromHtml(req(accept)),
      false,
      `${name} would have been excluded from the shared cache entry`,
    );
  }
});

test("a client with no opinion stays cacheable", () => {
  // No header at all is curl's default posture and a monitor's; `*_/_*` is
  // curl's actual header. Both are votes for HTML, not votes against it.
  assert.equal(negotiatesAwayFromHtml(req()), false);
  assert.equal(negotiatesAwayFromHtml(req("*/*")), false);
  assert.equal(negotiatesAwayFromHtml(req("text/html")), false);
});

test("THE TWO NEGOTIATING FORMS ARE EXCLUDED, which is the defect", () => {
  assert.equal(negotiatesAwayFromHtml(req("text/markdown")), true);
  assert.equal(negotiatesAwayFromHtml(req("application/json")), true);
});

test("an explicit preference for HTML beats a listed alternative", () => {
  // An agent that lists both and means HTML gets HTML, and gets it from the
  // cache. Equal weight goes to HTML, the same tie-break `prefersType` makes.
  assert.equal(negotiatesAwayFromHtml(req("text/markdown;q=0.5,text/html")), false);
  assert.equal(negotiatesAwayFromHtml(req("text/markdown,text/html")), false);
  assert.equal(negotiatesAwayFromHtml(req("text/html;q=0.5,text/markdown")), true);
});

test("q=0 is a refusal, not a preference", () => {
  assert.equal(negotiatesAwayFromHtml(req("application/json;q=0")), false);
});

test("the predicate is wider than prefersType, never narrower", () => {
  /* Every request a route would answer with an alternate representation must be one the cache
   * declines to serve; the reverse is allowed and costs only a miss. */
  const cases = [
    ...Object.values(BROWSERS),
    "text/markdown",
    "application/json",
    "text/markdown;q=0.9,text/html;q=0.8",
    "application/json;q=0.1,*/*;q=0.05",
    "text/*",
    "application/xhtml+xml",
  ];
  for (const accept of cases) {
    for (const wanted of ["text/markdown", "application/json"]) {
      if (prefersType(req(accept), wanted)) {
        assert.equal(
          negotiatesAwayFromHtml(req(accept)),
          true,
          `a route would serve ${wanted} for ${JSON.stringify(accept)} while the ` +
            `cache would answer it from the HTML entry`,
        );
      }
    }
  }
});

test("q-values parse: highest wins on a repeated range, a bare range is 1", () => {
  const values = acceptQValues(req("text/html;q=0.2,text/html;q=0.8,application/json"));
  assert.equal(values.get("text/html"), 0.8);
  assert.equal(values.get("application/json"), 1);
});
