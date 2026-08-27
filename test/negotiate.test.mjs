/**
 * Which representation a reader asked for, and what the Worker's cache may
 * therefore answer from.
 *
 * THE DEFECT THIS REPLAYS REACHED PRODUCTION. `workers/app.ts` keys its own
 * `caches.default` entry on the request URL plus the resolved theme plus the
 * build, and `caches.default` carries no headers, so `Vary: Accept` cannot be
 * honoured there. The HTML copy of `/blog/:slug` was stored under a key that
 * the `Accept: text/markdown` request also matched. MEASURED on the wire after
 * the deploy of 2f0b4d5: 31,869 bytes of `text/html` marked
 * `x-theme-cache: hit` in answer to a markdown request.
 *
 * The wire half of the proof is `check:browser`, which warms the HTML entry
 * and then asks the same URL for markdown. This half is the predicate: the
 * browser strings below are real headers, and the point of them is that every
 * one must stay CACHEABLE. A predicate that fixed the bug by excluding every
 * reader would pass a test that only checked the markdown case.
 *
 * @see app/lib/negotiate.mjs
 */

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

/*
 * REAL BROWSER HEADERS, copied rather than invented. These are the requests
 * the shared cache exists for, and every one of them must stay in it.
 */
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
  /*
   * THE INVARIANT THAT MAKES THE BYPASS SOUND. Every request a route would
   * answer with an alternate representation must be one the cache declines to
   * serve; the reverse is allowed and costs only a miss. Both compare against
   * the same HTML weight, so this holds by construction, and it is asserted
   * because the construction is two functions in one file rather than one.
   */
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
