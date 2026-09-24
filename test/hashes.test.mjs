/* Every expected value came from `git hash-object` and `sha256sum`, never from the module's own
 * crypto, or every case would be unfailable. The git header frames the BYTE length, so the
 * multibyte case catches an implementation framing `string.length`. */

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
