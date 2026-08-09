/**
 * `joinConcatenatedLiterals()`, replaying the two defects it was written for.
 *
 * Hard rule 12: a new gate must be tested by REPLAYING THE DEFECT it was
 * written for, not only by planted variants, because plants get written to
 * match the implementation rather than the bug. These two are the real ones.
 *
 * The defect this function closed: `check:invariants` section 5 binds every
 * column named in raw SQL to `schema.ts`. `sync-content.mjs` builds its SQL by
 * concatenating literals across `+` for line length, so the INSERT column list
 * ran three fragments past the extractor's closing paren. The file APPEARED in
 * the scan, because its single-fragment statements matched, so the gate
 * reported healthy coverage while missing the largest write path in the repo.
 * A misspelled column there is guaranteed to throw on the one path it exists
 * to protect.
 *
 * `og_titl` and `titl` are the two names actually measured getting through.
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

/*
 * The safety argument, asserted rather than trusted. Joining can only make a
 * literal LONGER, so it must not invent or destroy content, and it must leave
 * anything that is not a literal-plus-literal alone.
 */
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
