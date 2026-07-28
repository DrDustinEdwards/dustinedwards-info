/**
 * Gate for the query parser and rank fusion.
 *
 *   npm run check:search
 *
 * Imports app/lib/search/query.mjs directly, so it exercises the parser the
 * Worker actually runs rather than a restatement of its rules. Pure functions
 * only: no database, no network, so it is safe to run anywhere and fast enough
 * to run on every build.
 *
 * EVERY RULE HAS A PAIRED NEGATIVE. A parser rule that has only ever been seen
 * matching has not been verified: a rule that fires on everything passes every
 * positive test there is. The negative case is what proves the rule has an
 * edge. The year rule is the clearest example, since a rule that turned any
 * four-digit number into a date filter would pass "2019 is a year" and would
 * silently make a search for port 8080 return nothing at all.
 */

import { fuse, parseQuery, toMatchExpression, RRF_K } from "../app/lib/search/query.mjs";

let checks = 0;
/** @type {string[]} */
const failures = [];

/**
 * @param {string} label
 * @param {unknown} actual
 * @param {unknown} expected
 */
function eq(label, actual, expected) {
  checks += 1;
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) failures.push(`${label}\n    expected ${b}\n    actual   ${a}`);
}

/**
 * @param {string} label
 * @param {boolean} condition
 */
function ok(label, condition) {
  checks += 1;
  if (!condition) failures.push(label);
}

// Fixed so the year ceiling cannot move under the gate as the clock advances.
const OPTS = { minYear: 2000, maxYear: 2030 };

// -- Rule 1: quoted phrases -------------------------------------------------

eq(
  "phrase: a quoted run becomes one phrase",
  parseQuery('"content model" search', OPTS).phrases,
  ["content model"],
);
eq(
  "phrase: the quoted text does not also appear as loose terms",
  parseQuery('"content model" search', OPTS).terms,
  ["search"],
);
// NEGATIVE: without quotes the same words are separate terms, not a phrase.
eq(
  "phrase NEGATIVE: unquoted words are terms, not a phrase",
  parseQuery("content model", OPTS).phrases,
  [],
);
// NEGATIVE: an operator inside quotes stays literal text. This is why the
// phrase rule has to run before the operator rule.
eq(
  "phrase NEGATIVE: tag: inside quotes is not an operator",
  parseQuery('"tag:d1"', OPTS).tags,
  [],
);

// -- Rule 2: field operators -------------------------------------------------

eq("operator: tag:", parseQuery("tag:d1 storage", OPTS).tags, ["d1"]);
eq("operator: type:", parseQuery("type:post storage", OPTS).types, ["post"]);
eq(
  "operator: the operator is consumed, not left as a term",
  parseQuery("tag:d1 storage", OPTS).terms,
  ["storage"],
);
eq("operator: repeated tags narrow", parseQuery("tag:d1 tag:cloudflare", OPTS).tags, [
  "d1",
  "cloudflare",
]);
// NEGATIVE: a bare colon in prose is not an operator.
eq(
  "operator NEGATIVE: an unknown field is left alone",
  parseQuery("author:dustin", OPTS).tags,
  [],
);
eq(
  "operator NEGATIVE: an unknown field stays a search term",
  parseQuery("author:dustin", OPTS).terms,
  ["author:dustin"],
);

// -- Rule 3: bare year -------------------------------------------------------

eq("year: a bare in-range year becomes a filter", parseQuery("2026 storage", OPTS).year, 2026);
eq(
  "year: the year is consumed, not left as a term",
  parseQuery("2026 storage", OPTS).terms,
  ["storage"],
);
// NEGATIVE, and the one that matters most. A four-digit number outside the
// corpus range is a search term. Without this the query `8080` would filter
// every result away and return nothing, which reads as a broken site.
eq("year NEGATIVE: 8080 is out of range and stays a term", parseQuery("8080", OPTS).year, null);
eq("year NEGATIVE: 8080 survives as a term", parseQuery("8080", OPTS).terms, ["8080"]);
eq("year NEGATIVE: 1999 is below the corpus range", parseQuery("1999", OPTS).year, null);
// NEGATIVE: three and five digit numbers are not years.
eq("year NEGATIVE: 202 is not a year", parseQuery("202", OPTS).year, null);
eq("year NEGATIVE: 20260 is not a year", parseQuery("20260", OPTS).year, null);
// NEGATIVE: ordering. tag:2026 is a tag, not a year, and only because the
// operator rule consumed it first.
eq("year NEGATIVE: tag:2026 is a tag", parseQuery("tag:2026", OPTS).tags, ["2026"]);
eq("year NEGATIVE: tag:2026 sets no year", parseQuery("tag:2026", OPTS).year, null);

// -- Empty and filter-only queries ------------------------------------------

ok("empty: a blank query is empty", parseQuery("", OPTS).isEmpty);
ok("empty: a filter-only query has nothing to match", parseQuery("tag:d1", OPTS).isEmpty);
ok("empty NEGATIVE: a query with a term is not empty", !parseQuery("d1", OPTS).isEmpty);

// -- MATCH expression building ----------------------------------------------

eq(
  "match: terms are ANDed",
  toMatchExpression(parseQuery("content model", OPTS)),
  '"content" AND "model"',
);
eq(
  "match: a phrase is one quoted literal",
  toMatchExpression(parseQuery('"content model"', OPTS)),
  '"content model"',
);
eq("match: an empty query produces no expression", toMatchExpression(parseQuery("", OPTS)), null);
// Escaping. Everything a visitor types is quoted, so fts5 operators arrive as
// literal text rather than as syntax.
eq(
  "match: fts5 operators are quoted, not interpreted",
  toMatchExpression(parseQuery("NEAR OR NOT", OPTS)),
  '"NEAR" AND "OR" AND "NOT"',
);
eq(
  "match: a hyphen is quoted rather than read as a negation",
  toMatchExpression(parseQuery("well-known", OPTS)),
  '"well-known"',
);
eq(
  "match: an embedded double quote is doubled",
  toMatchExpression(parseQuery('say"hi', OPTS)),
  '"say""hi"',
);
eq(
  "match: prefix mode marks only the last term",
  toMatchExpression(parseQuery("content mod", OPTS), true),
  '"content" AND "mod"*',
);
eq(
  "match NEGATIVE: without prefix mode nothing is a prefix",
  toMatchExpression(parseQuery("content mod", OPTS), false),
  '"content" AND "mod"',
);

// -- Rank fusion -------------------------------------------------------------

// A document ranked second in BOTH lists beats one ranked first in only one.
// That is the whole point of RRF and the reason the two indexes can disagree
// without one of them dominating.
{
  const identity = [{ uid: "solo" }, { uid: "both" }];
  const prose = [{ uid: "other" }, { uid: "both" }];
  const fused = fuse([identity, prose]);
  eq("fuse: agreement across lists wins", fused[0].item.uid, "both");
  eq("fuse: a record in two lists records two sources", fused[0].sources.length, 2);
  ok(
    "fuse: score is the sum of reciprocal ranks",
    Math.abs(fused[0].score - (1 / (RRF_K + 2)) * 2) < 1e-12,
  );
}
// NEGATIVE: with only one list, fusion cannot invent agreement and order is
// preserved exactly.
{
  const fused = fuse([[{ uid: "a" }, { uid: "b" }, { uid: "c" }]]);
  eq(
    "fuse NEGATIVE: a single list keeps its order",
    fused.map((f) => f.item.uid),
    ["a", "b", "c"],
  );
}
// NEGATIVE: rank, not score. Fusion is handed no scores at all, so it cannot
// be accidentally reintroduced.
{
  const fused = fuse([[{ uid: "x" }], []]);
  ok("fuse NEGATIVE: an empty list contributes nothing", fused.length === 1);
}

// -- Report ------------------------------------------------------------------

if (failures.length > 0) {
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  console.error(`check:search failed. ${failures.length} of ${checks} assertions failed.`);
  process.exit(1);
}

// An assertion count that can never be zero. A gate that silently ran nothing
// reports success indistinguishable from a gate that checked everything.
if (checks < 30) {
  console.error(`check:search failed. Only ${checks} assertions ran, which cannot be right.`);
  process.exit(1);
}

console.log(`check:search ok. ${checks} assertions.`);
