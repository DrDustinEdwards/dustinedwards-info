import test from "node:test";
import assert from "node:assert/strict";

import { interfaceMembers, parseSource, propertyReads } from "../scripts/lib/syntax.mjs";

const NAMES = new Set(["OPERATOR_TOKEN"]);

test("a secret read off any receiver, bracketed or destructured, is a read", () => {
  for (const src of [
    "env.OPERATOR_TOKEN;",
    "getEnv(context).OPERATOR_TOKEN;",
    'env["OPERATOR_TOKEN"];',
    "const { OPERATOR_TOKEN } = env;",
    "const { OPERATOR_TOKEN: token } = env;",
  ]) {
    assert.equal(propertyReads(parseSource("x.tsx", src), NAMES).length, 1, src);
  }
});

test("a comment, a string and an object-literal key are not reads", () => {
  const src = [
    "// env.OPERATOR_TOKEN is read on the server",
    'const label = "env.OPERATOR_TOKEN";',
    "const status = { OPERATOR_TOKEN: true };",
    "const p = <p>Don't read env.OPERATOR_TOKEN here</p>;",
  ].join("\n");
  assert.equal(propertyReads(parseSource("x.tsx", src), NAMES).length, 0);
});

test("interface members survive a nested type and merge across declarations", () => {
  const src = `declare global {
    interface Env { A: string; NESTED: { inner: string }; B?: string }
    interface Env { C: string }
  }`;
  const { found, members } = interfaceMembers(parseSource("env.d.ts", src), "Env");
  assert.equal(found, true);
  assert.deepEqual([...members].sort(), ["A", "B", "C", "NESTED"]);
});
