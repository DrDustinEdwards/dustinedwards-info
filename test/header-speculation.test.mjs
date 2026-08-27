/**
 * The header's speculation rules list EXACTLY the paths the header links to.
 *
 * REPLAYS THE DEFECT THIS SPLIT CREATES, per hard rule 12. Before `~/lib/nav`
 * the four NavLinks were four literals in `site-header.tsx`, and the only
 * speculation on the site was `BlogSpeculation`, scoped to `/blog/*` and
 * rendered on the two blog routes alone. Adding a second speculation block
 * introduces a list that CAN disagree with the nav, and the disagreement is
 * invisible in a render: a nav link with no speculation entry still navigates,
 * just slower, and a speculation entry whose link has been removed speculates a
 * URL nothing points at. Neither produces a visual difference, an error, or a
 * console warning.
 *
 * Asserted in BOTH directions, because one direction is not a set equality and
 * this is exactly the "missing and orphaned" shape the portfolio conventions
 * ask for where code mirrors a list.
 *
 * ## OBSERVATION BOUNDARY
 *
 * This holds the DERIVATION: what `HEADER_PATHS` contains and what the rules
 * payload is built from. It does not render the header, so it cannot see a
 * NavLink whose `to` was typed by hand instead of coming from `NAV`, and it
 * does not drive a browser, so it cannot see whether Chrome accepts the rules
 * or whether the CSP admits the element. The nonce half is `check:headers`;
 * the wire half is `verify-live`.
 *
 * @see app/lib/nav.ts, app/components/site-speculation.tsx
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { stripComments } from "../scripts/lib/strip-comments.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/*
 * The TypeScript modules are read as source rather than imported, because
 * `node --test` runs without a TS loader and `site-speculation.tsx` imports
 * react-router. Reading the source is what the gates in `scripts/` already do
 * for the same reason.
 */
/*
 * COMMENTS ARE STRIPPED FIRST, and this test needed it on its own first run.
 * `site-header.tsx`'s doc comment now explains the change by quoting both
 * `prefetch="none"` and `prefetch="intent"`, so the count assertion below read
 * FOUR against a file carrying two. A comment has both satisfied an assertion
 * and failed one in this repo; here it failed one.
 */
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), "utf8"));

const navSource = read("app", "lib", "nav.ts");
const speculationSource = read("app", "components", "site-speculation.tsx");
const headerSource = read("app", "components", "site-header.tsx");

/** Every `to: "/path"` in the NAV array. */
const navPaths = [...navSource.matchAll(/\bto:\s*"([^"]+)"/g)].map((m) => m[1]);

test("NAV is not empty, so every assertion below has a scope", () => {
  // A zero from a search proves nothing until the scope is proven non-empty.
  assert.ok(navPaths.length >= 4, `NAV parsed ${navPaths.length} paths`);
});

test("every NAV path is absolute", () => {
  for (const path of navPaths) {
    assert.match(path, /^\//, `${path} is relative, so speculation would resolve it per page`);
  }
});

test("HEADER_PATHS is derived from NAV rather than written out again", () => {
  assert.match(
    navSource,
    /HEADER_PATHS[^=]*=\s*\["\/",\s*\.\.\.NAV\.map\(/,
    "a hand-written HEADER_PATHS is the mirror this module exists to prevent",
  );
});

test("the speculation payload is built from HEADER_PATHS, not its own list", () => {
  /*
   * The pattern moved on 2026-08-27 and the property did not. It was
   * `urls: [...HEADER_PATHS]` until the current page was excluded from its own
   * rule, which made the payload a filter over that same constant. What this
   * test is about is that the list is DERIVED from the nav rather than written
   * out again, and both spellings satisfy that; a pattern pinned to the old
   * expression would have failed a change it has no opinion about.
   */
  assert.match(
    speculationSource,
    /HEADER_PATHS\.filter\(/,
    "a literal urls array here can drift from the nav without any render changing",
  );
  assert.ok(
    !/urls:\s*\[\s*"/.test(speculationSource),
    "the payload names a path literally, which is the drift this test exists for",
  );
});

test("THE CURRENT PAGE IS EXCLUDED FROM ITS OWN SPECULATION RULE", () => {
  /*
   * A page that prerenders itself spends a request on a navigation that cannot
   * happen, and on this site that request reaches the ORIGIN for any reader
   * carrying a cookie. Chrome caps moderate-eagerness prerenders at two, so the
   * useless one can evict a useful one: it was not merely free waste.
   *
   * Asserted on the source rather than on a render, in the same way as the
   * derivation above, because the alternative is mounting the component and
   * this file deliberately reads modules rather than rendering them.
   */
  assert.match(
    speculationSource,
    /filter\(\s*\(\s*path\s*\)\s*=>\s*path\s*!==\s*pathname\s*\)/,
    "the header rules no longer drop the current path, so every page prerenders itself",
  );
  assert.match(
    speculationSource,
    /useLocation\(\)/,
    "the component cannot know which page it is on without reading the location",
  );
});

test("the speculation rules use moderate eagerness, not eager", () => {
  assert.match(speculationSource, /eagerness:\s*"moderate"/);
  assert.ok(
    !/eagerness:\s*"eager"/.test(speculationSource),
    "eager prerenders every header path on load, which is a crawler, not an optimisation",
  );
});

test("the header renders its NavLinks from NAV, so the two lists cannot disagree", () => {
  assert.match(
    headerSource,
    /NAV\.map\(\s*\(item\)\s*=>/,
    "NavLinks written as literals put the paths back in two places",
  );
  for (const path of navPaths) {
    assert.ok(
      !headerSource.includes(`to="${path}"`),
      `${path} is hard-coded in site-header.tsx as well as in NAV`,
    );
  }
});

test("the brand link is the one path NAV does not carry, and it is speculated", () => {
  assert.ok(headerSource.includes('to="/"'), "the brand link is gone");
  assert.match(
    navSource,
    /\["\/",/,
    "HEADER_PATHS must carry the brand's / because NAV deliberately does not",
  );
});

test("no header link carries a prefetch prop, because none could run", () => {
  /*
   * INVERTED 2026-08-26 with the unhydration arc. This test used to require
   * `prefetch="intent"` on the mapped NavLink and the brand Link. The prop
   * works through React event handlers, which attach only on a hydrated
   * page, and the public plane no longer hydrates, so a prefetch prop here
   * is dead configuration that reads as an optimisation. Hover speculation
   * is SiteSpeculation's job now (the tests above), which is declarative and
   * needs no script. A prefetch prop reappearing means either someone
   * re-added a dead prop, or the header moved to a hydrated plane and this
   * test's premise changed; both deserve a stop.
   */
  const prefetches = [...headerSource.matchAll(/prefetch="([a-z]+)"/g)].map((m) => m[1]);
  assert.equal(
    prefetches.length,
    0,
    `found prefetch props [${prefetches.join(", ")}] in an unhydrated header, where ` +
      `the React event handlers that implement them never attach`,
  );
});
