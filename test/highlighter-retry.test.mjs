/* The highlighter is built once per isolate and shared. A failed build must fail only the render
 * that saw it: cached as a rejection, one wasm hiccup would fail every render until the isolate died. */

import test from "node:test";
import assert from "node:assert/strict";

import { renderBody, setWasmLoader } from "../app/lib/content/pipeline.mjs";

const render = () =>
  renderBody({ file: "test.md", body: "```js\nconst x = 1;\n```\n", resolveImage: () => null });

test("A FAILED HIGHLIGHTER BUILD IS RETRIED by the next render, not cached", async () => {
  let calls = 0;
  setWasmLoader(() => {
    calls += 1;
    if (calls === 1) return Promise.reject(new Error("planted wasm load failure"));
    return import("shiki/wasm");
  });
  try {
    await assert.rejects(render(), /planted wasm load failure/);
    const { html } = await render();
    assert.ok(html.includes("<pre"), "the second render did not highlight");
    assert.equal(calls, 2);
  } finally {
    setWasmLoader(() => import("shiki/wasm"));
  }
});
