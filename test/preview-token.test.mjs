import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

import {
  TOKEN_BYTES,
  TOKEN_LENGTH,
  base64url,
  expiresAt,
  isWellFormedToken,
  makeRecord,
  mintToken,
  parseRecord,
  postIndexKey,
  postIndexPrefix,
  previewUrl,
  resolvePreview,
  tokenFromIndexKey,
  tokenKey,
} from "../app/lib/preview-token.mjs";

// The KV half imports through the app's `~/` alias, which only the bundler knows.
const APP = new URL("../app/", import.meta.url);
registerHooks({
  resolve: (specifier, context, next) =>
    next(specifier.startsWith("~/") ? new URL(specifier.slice(2), APP).href : specifier, context),
});
const { createPreviewLink, listPreviewLinks } = await import("../app/lib/preview-links.server.ts");

function memoryKv() {
  const store = new Map();
  return {
    async put(key, value) {
      store.set(key, value);
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = "" } = {}) {
      return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) };
    },
  };
}

const RECORD = makeRecord({
  slug: "a-draft",
  createdAt: "2026-08-15T10:00:00.000Z",
  createdBy: "dustin",
  note: "for review",
});

const DRAFT = { slug: "a-draft", status: "draft" };

test("a token is at least 32 bytes of randomness, in unpadded base64url", () => {
  assert.ok(TOKEN_BYTES >= 32, `${TOKEN_BYTES} random bytes makes a preview link guessable`);
  const token = mintToken();
  assert.equal(token.length, TOKEN_LENGTH);
  assert.equal(Buffer.from(token, "base64url").length, TOKEN_BYTES, "the token carries every random byte");
  assert.match(token, /^[A-Za-z0-9_-]+$/, "base64url alphabet only");
  assert.ok(!token.includes("="), "padding is stripped");
});

test("tokens do not repeat", () => {
  // Not a randomness test: it catches a generator that returns a constant or is seeded once.
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) seen.add(mintToken());
  assert.equal(seen.size, 200);
});

test("base64url uses the URL alphabet, not the standard one", () => {
  // 0xFB 0xFF encodes to +/8= in standard base64. Both substitutions and the
  // padding strip are visible in one vector.
  assert.equal(base64url(new Uint8Array([0xfb, 0xff, 0xfe])), "-__-");
});

test("the well-formed check is anchored and length-exact", () => {
  const token = mintToken();
  assert.ok(isWellFormedToken(token));

  assert.ok(!isWellFormedToken(`${token}x`), "longer must be refused");
  assert.ok(!isWellFormedToken(token.slice(0, 42)), "shorter must be refused");
  assert.ok(!isWellFormedToken(`${token.slice(0, 42)}+`), "a non-URL character must be refused");
  assert.ok(!isWellFormedToken(`${token.slice(0, 42)}/`), "a slash must be refused");
  assert.ok(!isWellFormedToken(`${token.slice(0, 42)}.`), "a dot must be refused");
  assert.ok(!isWellFormedToken(""), "empty must be refused");
  assert.ok(!isWellFormedToken(null));
  assert.ok(!isWellFormedToken(undefined));
  assert.ok(!isWellFormedToken(42));
});

test("the index prefix scopes a list to exactly one slug", () => {
  const prefix = postIndexPrefix("a-draft");
  assert.ok(postIndexKey("a-draft", mintToken()).startsWith(prefix));
  // The trailing colon is what stops `a-draft` listing `a-draft-two`'s tokens,
  // which would revoke another post's links on publish.
  assert.ok(!postIndexKey("a-draft-two", mintToken()).startsWith(prefix));
});

test("a token is recovered from its index key, and a foreign key is refused", () => {
  const token = mintToken();
  assert.equal(tokenFromIndexKey(postIndexKey("a-draft", token), "a-draft"), token);
  assert.equal(
    tokenFromIndexKey(postIndexKey("other", token), "a-draft"),
    null,
    "a key for another slug names no token for this one",
  );
  assert.equal(
    tokenFromIndexKey(`${postIndexPrefix("a-draft")}not-a-token`, "a-draft"),
    null,
    "a malformed tail is not a token",
  );
  assert.equal(tokenFromIndexKey("something:else", "a-draft"), null);
});

test("a record round-trips through the store's text form", () => {
  const parsed = parseRecord(JSON.stringify(RECORD));
  assert.deepEqual(parsed, RECORD);
});

test("FAILS CLOSED: an unreadable record is indistinguishable from no record", () => {
  assert.equal(parseRecord("not json"), null);
  assert.equal(parseRecord(""), null);
  assert.equal(parseRecord(null), null);
  assert.equal(parseRecord(undefined), null);
  assert.equal(parseRecord("null"), null);
  assert.equal(parseRecord("[]"), null, "an array carries no slug");
  assert.equal(parseRecord(JSON.stringify({ createdBy: "dustin" })), null, "no slug, no record");
  assert.equal(parseRecord(JSON.stringify({ slug: "   " })), null, "a blank slug is no slug");
});

test("the missing fields of a partial record become empty strings, never undefined", () => {
  const parsed = parseRecord(JSON.stringify({ slug: "a-draft" }));
  assert.deepEqual(parsed, { slug: "a-draft", createdAt: "", createdBy: "", note: "" });
});

test("expiry is seven days after minting, and unreadable dates say so", () => {
  assert.equal(expiresAt("2026-08-15T10:00:00.000Z"), "2026-08-22T10:00:00.000Z");
  assert.equal(expiresAt("not a date"), "", "an unreadable date must not become a plausible one");
  assert.equal(expiresAt(""), "");
});

test("the URL is absolute and carries the whole token", () => {
  const token = mintToken();
  assert.equal(previewUrl("https://example.com", token), `https://example.com/preview/${token}`);
  assert.equal(
    previewUrl("https://example.com/", token),
    `https://example.com/preview/${token}`,
    "a trailing slash must not produce a double slash",
  );
});

test("the whole story: a live token on a draft resolves", () => {
  const verdict = resolvePreview({ token: mintToken(), record: RECORD, post: DRAFT });
  assert.deepEqual(verdict, { ok: true, reason: "ok" });
});

test("PLANT (b): an ORPHANED INDEX ENTRY resolves to nothing", () => {
  const verdict = resolvePreview({ token: mintToken(), record: null, post: DRAFT });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "unknown");
});

test("PLANT (b), the other half: a listing SKIPS an orphaned entry", async () => {
  const env = { APP_KV: memoryKv() };
  const live = await createPreviewLink(env, { slug: "a-draft", createdBy: "dustin" });
  const orphan = await createPreviewLink(env, { slug: "a-draft", createdBy: "dustin" });
  // A revoke that failed between its two deletes: the authority is gone, the index entry is not.
  await env.APP_KV.delete(tokenKey(orphan.token));

  const listed = await listPreviewLinks(env, "a-draft");
  assert.deepEqual(
    listed.map((link) => link.token),
    [live.token],
    "the orphan must not be listed",
  );
});

test("PLANT (c): a token on a post that LEFT DRAFT stops working", () => {
  // The revoke-on-publish path is a write and writes fail. This is the reason
  // the read path re-asks the database rather than trusting the revocation.
  for (const status of ["published", "scheduled", "archived", ""]) {
    const verdict = resolvePreview({
      token: mintToken(),
      record: RECORD,
      post: { slug: "a-draft", status },
    });
    assert.equal(verdict.ok, false, `status ${JSON.stringify(status)} must not preview`);
    assert.equal(verdict.reason, "not-draft");
  }
});

test("a malformed token is refused before anything is looked up", () => {
  const verdict = resolvePreview({ token: "short", record: RECORD, post: DRAFT });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "malformed");
});

test("a token whose post is gone is refused", () => {
  const verdict = resolvePreview({ token: mintToken(), record: RECORD, post: null });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "missing-post");
});

test("a record naming a different slug than the row is refused", () => {
  const verdict = resolvePreview({
    token: mintToken(),
    record: RECORD,
    post: { slug: "some-other-draft", status: "draft" },
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "mismatch");
});

test("EVERY failure is a failure: no reason is accidentally permissive", () => {
  // The route collapses all of these into one identical 404. This asserts the
  // collapse is safe, by proving nothing but "ok" carries ok: true.
  const cases = [
    { token: "nope", record: RECORD, post: DRAFT },
    { token: mintToken(), record: null, post: DRAFT },
    { token: mintToken(), record: RECORD, post: null },
    { token: mintToken(), record: RECORD, post: { slug: "elsewhere", status: "draft" } },
    { token: mintToken(), record: RECORD, post: { slug: "a-draft", status: "published" } },
  ];
  for (const input of cases) {
    const verdict = resolvePreview(input);
    assert.equal(verdict.ok, false);
    assert.notEqual(verdict.reason, "ok");
  }
});
