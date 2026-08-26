/**
 * The provenance hashes against INDEPENDENTLY derived values.
 *
 * Every expected value here was produced by a tool that is not the module
 * under test: the blob shas by `git hash-object --stdin` and the sha256s by
 * `sha256sum`, both run 2026-08-25 over the same bytes each case encodes.
 * Fixture independence (hard rule 10): a gate's expected values are never
 * produced by the process it checks, and re-deriving them here with
 * crypto.subtle would make every case unfailable by construction.
 *
 * The multibyte case is the one that earns its place: the git header frames
 * the BYTE length, and "café ☕\n" is 10 bytes across 8 code points, so an
 * implementation framing `string.length` produces a plausible sha that
 * matches nothing git ever computed.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { gitBlobSha, renderHash } from "../app/lib/content/hashes.mjs";

test("gitBlobSha matches git hash-object for ascii content", async () => {
  assert.equal(await gitBlobSha("hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a");
});

test("gitBlobSha matches git hash-object for the empty file", async () => {
  assert.equal(await gitBlobSha(""), "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
});

test("gitBlobSha frames byte length, not code units", async () => {
  // 10 bytes, 8 code points. git hash-object said df1134...
  assert.equal(await gitBlobSha("café ☕\n"), "df113425d6f29a3f8cfb2ca897bebf8703e56d20");
});

test("renderHash is the sha256 of the html bytes", async () => {
  assert.equal(
    await renderHash("<p>x</p>"),
    "31d8e07ec305ac4e2515d1f0b1c8c603b3858044eb7d97807d6d0970838cb0be",
  );
  assert.equal(
    await renderHash(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});
