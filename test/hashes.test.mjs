/* Every expected value came from `git hash-object` and `sha256sum`, never from the module's own
 * crypto, or every case would be unfailable. The git header frames the BYTE length, so the
 * multibyte case catches an implementation framing `string.length`. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { gitBlobSha } from "../app/lib/content/hashes.mjs";

await test("gitBlobSha matches git hash-object for ascii content", async () => {
  assert.equal(await gitBlobSha("hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a");
});

await test("gitBlobSha frames byte length, not code units", async () => {
  // 10 bytes, 8 code points. git hash-object said df1134...
  assert.equal(await gitBlobSha("café ☕\n"), "df113425d6f29a3f8cfb2ca897bebf8703e56d20");
});
