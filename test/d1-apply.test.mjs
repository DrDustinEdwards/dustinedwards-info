/**
 * A remote write is one batch through D1's query API, never wrangler's import, which refuses the live site's queries
 * while it runs (DUSTINEDWARDS-1/3/4). A failed statement inside an answered batch must still fail the write.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { applySqlFile } from "../scripts/lib/d1-apply.mjs";

const dir = await mkdtemp(path.join(os.tmpdir(), "d1-apply-"));
const file = path.join(dir, "write.sql");
await writeFile(file, "DELETE FROM t;\nINSERT INTO t (a) VALUES ('x;y');\n", "utf8");
const env = { CLOUDFLARE_API_TOKEN: "token", CLOUDFLARE_ACCOUNT_ID: "acct" };

/** @param {number} status @param {unknown} body */
function answering(status, body, sent = /** @type {any[]} */ ([])) {
  /** @type {typeof fetch} */
  const fetchImpl = async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(body), { status });
  };
  return { fetchImpl, sent };
}

await test("a remote file is sent as one batch to the query endpoint, never imported", async () => {
  const { fetchImpl, sent } = answering(200, {
    success: true,
    result: [{ success: true }, { success: true }],
  });
  const applied = await applySqlFile({
    address: "uuid-1",
    target: "--remote",
    file,
    env,
    fetchImpl,
  });
  assert.equal(applied.status, 0);
  assert.equal(sent.length, 1);
  assert.equal(
    sent[0].url,
    "https://api.cloudflare.com/client/v4/accounts/acct/d1/database/uuid-1/query",
  );
  assert.deepEqual(sent[0].body, {
    batch: [{ sql: "DELETE FROM t" }, { sql: "INSERT INTO t (a) VALUES ('x;y')" }],
  });
});

await test("a refused batch fails the write with D1's own message", async () => {
  const { fetchImpl } = answering(400, {
    success: false,
    errors: [{ message: "no such table: t" }],
  });
  const applied = await applySqlFile({
    address: "uuid-1",
    target: "--remote",
    file,
    env,
    fetchImpl,
  });
  assert.equal(applied.status, 1);
  assert.match(applied.output, /400.*no such table: t/);
});

await test("a remote write without the API token refuses before any request", async () => {
  const { fetchImpl, sent } = answering(200, { success: true, result: [] });
  const applied = await applySqlFile({
    address: "uuid-1",
    target: "--remote",
    file,
    env: {},
    fetchImpl,
  });
  assert.equal(applied.status, 1);
  assert.equal(sent.length, 0);
  assert.match(applied.output, /CLOUDFLARE_API_TOKEN/);
});
