/**
 * `sync-content.mjs` concatenates SQL literals across `+`, so column names split across fragments
 * escaped the schema column check without this join.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { joinConcatenatedLiterals } from "../scripts/lib/sql-literals.mjs";

test("REPLAY: og_titl survives the join and becomes findable", () => {
  const source = "const sql = `INSERT INTO posts (slug, og_titl` + `e) VALUES (?1, ?2)`;";
  const joined = joinConcatenatedLiterals(source);
  assert.match(joined, /og_title/, "the split name was not rejoined");
  assert.doesNotMatch(joined, /og_titl` \+ `e/, "the concatenation survived");
});

test("REPLAY: titl split across a fragment boundary", () => {
  const source = "`UPDATE posts SET titl` + `e = ?1 WHERE slug = ?2`";
  assert.match(joinConcatenatedLiterals(source), /title = \?1/);
});

test("a statement split into THREE fragments joins in one call", () => {
  const source =
    "`INSERT INTO posts (slug, kind, title, ` + `html, description, ` + `og_image) VALUES (`";
  const joined = joinConcatenatedLiterals(source);
  assert.match(joined, /\(slug, kind, title, html, description, og_image\) VALUES \(/);
});

test("single quotes join too, not just backticks", () => {
  assert.equal(joinConcatenatedLiterals("'SELECT a, ' + 'b FROM t'"), "'SELECT a, b FROM t'");
});

test("whitespace and newlines around the + are tolerated", () => {
  const source = "`SELECT a, `\n  + `b FROM t`";
  assert.match(joinConcatenatedLiterals(source), /`SELECT a, b FROM t`/);
});

test("a lone literal is returned unchanged", () => {
  const source = "`SELECT a FROM t`";
  assert.equal(joinConcatenatedLiterals(source), source);
});

test("addition between non-literals is NOT joined", () => {
  const source = "const n = a + b;";
  assert.equal(joinConcatenatedLiterals(source), source);
});

test("mismatched quote styles are NOT joined across", () => {
  const source = "`SELECT a, ` + 'b FROM t'";
  assert.equal(
    joinConcatenatedLiterals(source),
    source,
    "joining across quote styles would fabricate a literal that does not exist",
  );
});

test("it terminates and is idempotent", () => {
  const once = joinConcatenatedLiterals("`a` + `b` + `c` + `d`");
  assert.equal(once, "`abcd`");
  assert.equal(joinConcatenatedLiterals(once), once, "a second pass changed the result");
});
