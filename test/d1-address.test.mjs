/**
 * sync:content writes production through the UUID this resolves, so every way it can fail must
 * refuse, and say which way it failed.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { resolveD1Address } from "../scripts/lib/d1-address.mjs";

test("a local target keeps the name", () => {
  assert.equal(resolveD1Address("db-local-only", "--local", () => assert.fail("no lookup")), "db-local-only");
});

test("a remote target resolves the UUID past a banner", () => {
  const run = () => ({ status: 0, stdout: 'banner\n[{"name":"db-a","uuid":"u-1"}]' });
  assert.equal(resolveD1Address("db-a", "--remote", run), "u-1");
});

test("REPLAY: unparseable d1 list output refuses and names the parse failure", () => {
  const run = () => ({ status: 0, stdout: "[not json" });
  assert.throws(() => resolveD1Address("db-b", "--remote", run), /did not parse/);
});

test("a failed d1 list refuses with its exit status", () => {
  const run = () => ({ status: 1, stdout: "auth error" });
  assert.throws(() => resolveD1Address("db-c", "--remote", run), /exited 1/);
});
