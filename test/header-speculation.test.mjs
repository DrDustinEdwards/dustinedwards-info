/**
 * The speculation rules: the payload a browser will parse.
 *
 * ## WHAT CHANGED 2026-08-28, and why this file got stronger rather than longer
 *
 * The rules used to be two literal objects inside two components, so this file
 * could only read their SOURCE and match patterns against it. The payload now
 * comes from `app/lib/speculation.mjs`, which is plain ESM with no react-router
 * import, so `node --test` can CALL it. Every assertion about the rules below is
 * therefore about the object a browser will parse, not about the spelling of the
 * expression that produces it.
 *
 * ## THE MIRROR THIS FILE WAS ORIGINALLY WRITTEN FOR IS GONE
 *
 * It began as a two-directional check between `~/lib/nav`'s `HEADER_PATHS` and a
 * `urls` list in `site-speculation.tsx`, because a list that can disagree with
 * the nav is invisible in a render: a nav link with no speculation entry still
 * navigates, just slower, and an entry whose link was removed speculates a URL
 * nothing points at. Neither produces a visual difference, an error, or a
 * console warning.
 *
 * **The rules are DOCUMENT rules now, so there is no list to disagree with.** A
 * header link is speculated because it is an `<a href>` in the page, and
 * `HEADER_PATHS` was deleted with its last consumer. What remains here about the
 * nav is the one fact still worth pinning: `site-header.tsx` renders its
 * NavLinks from `NAV` rather than from literals, which is what makes the
 * document rule's coverage of the header derived rather than coincidental.
 *
 * ## OBSERVATION BOUNDARY
 *
 * This holds the PAYLOAD. It does not render the header, and it does not drive a
 * browser, so it cannot see whether Chrome ACCEPTS the rules. `check:browser`
 * owns that on a real page, against Chrome's own resolved candidate list, and it
 * is where a malformed `href_matches` shows up. The nonce half is
 * `check:headers`.
 *
 * **AND NOTHING HERE OR ANYWHERE CAN SEE A PRERENDER ACTIVATE.** Chrome refuses
 * to prerender while CDP is attached: measured 2026-08-28, every attempt under
 * Puppeteer reports `PrerenderingDisabledByDevTools` and falls back to prefetch,
 * with or without the Preload domain enabled. So the whole gated claim is "the
 * rules a browser would act on are correct", never "the browser acted".
 *
 * @see app/lib/nav.ts, app/lib/speculation.mjs, app/components/site-speculation.tsx
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { stripComments } from "../scripts/lib/strip-comments.mjs";
import {
  DOCUMENT_ACTION,
  DOCUMENT_EAGERNESS,
  EXCLUDED_PATHS,
  EXCLUDED_PREFIXES,
  EXCLUDED_SUFFIXES,
  buildSpeculationRules,
} from "../app/lib/speculation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/*
 * COMMENTS ARE STRIPPED FIRST, and this test needed it on its own first run.
 * A comment has both satisfied an assertion and failed one in this repo.
 */
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), "utf8"));

const navSource = read("app", "lib", "nav.ts");
const headerSource = read("app", "components", "site-header.tsx");
const componentSource = read("app", "components", "site-speculation.tsx");

/** Every `to: "/path"` in the NAV array. */
const navPaths = [...navSource.matchAll(/\bto:\s*"([^"]+)"/g)].map((m) => m[1]);

/** The whole payload for one page, so the ACTION KEY itself is assertable. */
/** @param {string} pathname */
const payloadOn = (pathname) => JSON.parse(buildSpeculationRules({ pathname }));

/** @param {string} pathname */
const rulesOn = (pathname) => payloadOn(pathname)[DOCUMENT_ACTION];

/**
 * Every `href_matches` pattern under a `not`, as a comparable string.
 * Object-form patterns render as `search:(.+)`, so one comparison covers both
 * shapes and a spelling change from one to the other cannot pass silently.
 *
 * @param {string} pathname
 */
function exclusions(pathname) {
  return (rulesOn(pathname)[0].where.and ?? [])
    .filter((clause) => clause.not)
    .map((clause) => {
      const m = clause.not.href_matches;
      return typeof m === "string" ? m : Object.entries(m).map(([k, v]) => `${k}:${v}`).join(",");
    });
}

test("NAV is not empty, so every assertion about it has a scope", () => {
  // A zero from a search proves nothing until the scope is proven non-empty.
  assert.ok(navPaths.length >= 4, `NAV parsed ${navPaths.length} paths`);
});

test("every NAV path is absolute", () => {
  for (const path of navPaths) {
    assert.match(path, /^\//, `${path} is relative, so it would resolve per page`);
  }
});

test("HEADER_PATHS IS GONE, and the component does not build a urls list", () => {
  /*
   * Both halves, because either alone passes on a half-done revert. A
   * reintroduced `HEADER_PATHS` with no consumer is dead configuration; a
   * `urls` list in the component is the mirror this file existed to police,
   * back without the check that used to police it.
   */
  assert.ok(
    !/export const HEADER_PATHS/.test(navSource),
    "HEADER_PATHS is exported again. Its last consumer went when the rules became " +
      "document rules; a derived export nobody reads reads as load-bearing.",
  );
  assert.ok(
    !/urls:\s*\[/.test(componentSource),
    "the component builds a urls list again, which is a path list that can drift " +
      "from the links the page actually renders",
  );
});

test("the component asks the module for the payload rather than composing one", () => {
  assert.match(
    componentSource,
    /buildSpeculationRules\(\s*\{\s*pathname\s*\}\s*\)/,
    "a payload composed in the component is a second owner of the rule shape",
  );
});

test("THE ACTION IS PREFETCH, NOT PRERENDER", () => {
  /*
   * The action is the whole of the 2026-08-28 navigation-blink fix and it is the
   * one thing here a well-meaning change would put back.
   *
   * A prerender that has not painted is still ACTIVATABLE, and `moderate` starts
   * the speculation on pointerdown, so a click with no hover dwell swaps in an
   * empty frame host and the reader gets the themed canvas instead of the paint
   * hold. Measured on production by screen capture with no CDP: fourteen runs,
   * both themes, seven with prerendering on and seven with it off at the
   * browser. All seven prerendering runs showed blank frames at 100% of the
   * `--bg` token with a luma standard deviation of zero. None of the other seven
   * did.
   *
   * The action is asserted as the payload's own KEY, not as a property of a rule
   * object, because that key is what selects the browser's behavior.
   */
  const payload = payloadOn("/blog");
  assert.equal(DOCUMENT_ACTION, "prefetch");
  assert.deepEqual(Object.keys(payload), ["prefetch"], `payload keys are ${JSON.stringify(Object.keys(payload))}`);
  assert.equal(payload.prerender, undefined, "the payload still carries a prerender rule");
});

test("THERE IS EXACTLY ONE RULE, and it is a document rule at moderate eagerness", () => {
  /*
   * ONE, deliberately. An `immediate` list rule for the header's destinations
   * was built and measured on 2026-08-28: it cost 4 to 5 extra credentialed
   * document requests on every public page load, and Dustin reverted it. Two
   * rules reappearing means that decision was undone, which deserves a stop
   * rather than a silent 5x on origin requests.
   */
  const rules = rulesOn("/blog");
  assert.equal(rules.length, 1, `expected one rule, got ${JSON.stringify(rules)}`);
  assert.ok(rules[0].where, "the rule is not a document rule");
  assert.ok(!rules[0].urls, "the rule carries a urls list");
  assert.equal(rules[0].eagerness, DOCUMENT_EAGERNESS);
  assert.equal(DOCUMENT_EAGERNESS, "moderate");
});

test("the rule has a positive scope, not only exclusions", () => {
  /*
   * An `and` of nothing but `not` clauses matches every link the exclusions do
   * not name, INCLUDING cross-origin ones, and reads as a tighter rule than it
   * is. The positive clause is a pathname pattern, so it takes its origin from
   * the document and makes the rule same-origin by construction.
   */
  const positive = rulesOn("/blog")[0].where.and.filter((clause) => clause.href_matches);
  assert.deepEqual(positive, [{ href_matches: "/*" }]);
});

test("THE CURRENT PAGE IS EXCLUDED FROM ITS OWN RULE", () => {
  /*
   * A page that speculates itself spends a request on a navigation that cannot
   * happen, and on this site that request reaches the ORIGIN for any reader
   * carrying a cookie. Chrome caps moderate speculations, so the useless one
   * can evict a useful one.
   */
  for (const pathname of ["/", "/blog", "/blog/ten-years-on-cloudflare", "/colophon"]) {
    assert.ok(
      exclusions(pathname).includes(pathname),
      `${pathname} is not excluded from its own rule`,
    );
  }
});

test("every excluded prefix is excluded as a path AND as a subtree", () => {
  /*
   * Two patterns, and a rule carrying only one of them leaks the other. The
   * bare prefix alone would still speculate `/admin/posts`; the subtree alone
   * would still speculate `/admin` itself.
   */
  const found = exclusions("/blog");
  assert.ok(EXCLUDED_PREFIXES.length > 0, "no prefixes to check");
  for (const prefix of EXCLUDED_PREFIXES) {
    assert.ok(found.includes(prefix), `${prefix} itself is not excluded`);
    assert.ok(found.includes(`${prefix}/*`), `${prefix} subtree is not excluded`);
  }
});

test("the named single paths and the non-page extensions are excluded", () => {
  const found = exclusions("/blog");
  assert.ok(EXCLUDED_PATHS.length > 0 && EXCLUDED_SUFFIXES.length > 0, "nothing to check");
  for (const path of EXCLUDED_PATHS) {
    assert.ok(found.includes(path), `${path} is not excluded`);
  }
  for (const suffix of EXCLUDED_SUFFIXES) {
    assert.ok(found.includes(`/*${suffix}`), `${suffix} is not excluded`);
  }
});

test("the routes that must never be speculated are each named by an exclusion", () => {
  /*
   * The test above checks that the CONSTANTS reached the payload. This one
   * checks the constants themselves against the routes they exist for, which is
   * the half a self-referential assertion cannot cover: emptying
   * `EXCLUDED_PATHS` would pass every assertion above.
   *
   * `/search/ask` is the expensive one. It reaches a billed model, so
   * speculating it spends money on a click nobody made.
   */
  const found = exclusions("/blog");
  const MUST_BE_EXCLUDED = [
    "/admin",
    "/admin/*",
    "/api",
    "/api/*",
    "/media",
    "/media/*",
    "/login",
    "/theme",
    "/search/ask",
    "/*.md",
    "/*.xml",
    "/*.json",
    "/*.txt",
  ];
  for (const pattern of MUST_BE_EXCLUDED) {
    assert.ok(found.includes(pattern), `${pattern} is not in the rule's exclusions`);
  }
});

test("ANY URL CARRYING A QUERY IS EXCLUDED, as a search component", () => {
  /*
   * A pathname pattern cannot see the query string, and the pathname-glob
   * spelling of this exclusion was PLANTED on 2026-08-28: Chrome then resolved
   * ZERO candidates on every page, so it does not leak queries, it collapses
   * the whole rule. The wrong spelling looks correct and fails silently, which
   * is why the assertion is on the component rather than on behavior.
   */
  assert.ok(
    exclusions("/blog").includes("search:(.+)"),
    "the query exclusion is not a search-component pattern",
  );
});

test("the header renders its NavLinks from NAV, so its links are derived", () => {
  assert.match(
    headerSource,
    /NAV\.map\(\s*\(item\)\s*=>/,
    "NavLinks written as literals put the paths in two places",
  );
  for (const path of navPaths) {
    assert.ok(
      !headerSource.includes(`to="${path}"`),
      `${path} is hard-coded in site-header.tsx as well as in NAV`,
    );
  }
});

test("the brand link is the one header path NAV does not carry", () => {
  assert.ok(headerSource.includes('to="/"'), "the brand link is gone");
  assert.ok(
    !exclusions("/blog").includes("/"),
    "/ is excluded from the rule on /blog, so the brand link would not be speculated",
  );
});

test("no header link carries a prefetch prop, because none could run", () => {
  /*
   * INVERTED 2026-08-26 with the unhydration arc. This test used to require
   * `prefetch="intent"`. The prop works through React event handlers, which
   * attach only on a hydrated page, and the public plane no longer hydrates, so
   * a prefetch prop here is dead configuration that reads as an optimization.
   * Speculation rules are declarative and need no script. A prefetch prop
   * reappearing means either someone re-added a dead prop, or the header moved
   * to a hydrated plane and this test's premise changed; both deserve a stop.
   */
  const prefetches = [...headerSource.matchAll(/prefetch="([a-z]+)"/g)].map((m) => m[1]);
  assert.equal(
    prefetches.length,
    0,
    `found prefetch props [${prefetches.join(", ")}] in an unhydrated header, where ` +
      `the React event handlers that implement them never attach`,
  );
});
