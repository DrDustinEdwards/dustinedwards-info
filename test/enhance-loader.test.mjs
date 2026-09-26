/* A security test: the loader turns markers into trusted scripts, so what it refuses is the policy.
 * The loader text and the palette trigger in app/enhance/theme.ts state one rule twice (the loader
 * must be self-contained), so both are run over the same cases here. */

import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

import { ENHANCE_LOADER } from "../app/lib/enhance-loader.mjs";
import { ENHANCE_URL_PREFIX } from "../app/lib/enhance-url.mjs";

const PAGE = "https://dustinedwards.info/blog/a-post";

/** [marker value, the src it may load, or null for refused] */
const CASES = [
  ["/assets/header-AbCdEfGh.js", "https://dustinedwards.info/assets/header-AbCdEfGh.js"],
  ["https://dustinedwards.info/assets/blog-AbCdEfGh.js", "https://dustinedwards.info/assets/blog-AbCdEfGh.js"],
  ["/assets/../api/operator", null],
  ["/assets/%2e%2e/api/operator", null],
  ["/assets/%2E%2E/x.js", null],
  ["https://evil.test/assets/x.js", null],
  ["//evil.test/assets/x.js", null],
  ["/api/x.js", null],
  ["assets/x.js", null],
  ["javascript:alert(1)", null],
  ["http://[bad", null],
  ["", null],
];

/**
 * The palette trigger's rule as theme.ts writes it: a script element's `src` is the resolved,
 * normalized URL (the raw value when it does not parse), held to `origin + ENHANCE_URL_PREFIX`.
 *
 * @param {string} raw
 */
function paletteAllows(raw) {
  let src = raw;
  try {
    src = new URL(raw, PAGE).href;
  } catch {
    // An element keeps the unparsed value as its src, which the prefix check then refuses.
  }
  return src.startsWith(new URL(PAGE).origin + ENHANCE_URL_PREFIX) ? src : null;
}

test("the palette trigger's rule allows only same-origin, normalized /assets/ URLs", () => {
  for (const [raw, expected] of CASES) {
    assert.equal(paletteAllows(raw), expected, `palette rule on ${JSON.stringify(raw)}`);
  }
});

/**
 * Runs the loader text against a stand-in DOM whose `document` has its methods clobbered, as named
 * elements would, so only calls through `Document.prototype` reach the markers.
 *
 * @param {string[]} markers the data-enhance values, in document order
 */
function runLoader(markers) {
  /** @type {{ type: string, async: boolean, src: string }[]} */
  const inserted = [];
  const head = { appendChild: (/** @type {any} */ s) => inserted.push(s) };
  const templates = markers.map((value) => ({ getAttribute: (/** @type {string} */ n) => (n === "data-enhance" ? value : null) }));
  class Document {
    /** @param {string} selector */
    querySelector(selector) {
      return selector === "head" ? head : null;
    }
    /** @param {string} selector */
    querySelectorAll(selector) {
      return selector === "template[data-enhance]" ? templates : [];
    }
    createElement() {
      return { type: "", async: true, src: "" };
    }
  }
  const document = new Document();
  for (const name of ["querySelector", "querySelectorAll", "createElement", "head"]) {
    Object.defineProperty(document, name, { value: { clobbered: true } });
  }
  const url = new URL(PAGE);
  /** @type {unknown} */
  let error = null;
  try {
    runInNewContext(ENHANCE_LOADER, { document, Document, location: { href: url.href, origin: url.origin }, URL, Set, Error });
  } catch (caught) {
    error = caught;
  }
  return { inserted, error };
}

test("the loader text applies the same rule, in order, deduplicated, and past a clobbered document", () => {
  const markers = CASES.map(([raw]) => raw);
  markers.push("/assets/header-AbCdEfGh.js");
  const { inserted, error } = runLoader(markers);

  const allowed = [...new Set(CASES.map(([, src]) => src).filter(Boolean))];
  assert.deepEqual(inserted.map((s) => s.src), allowed);
  for (const script of inserted) {
    assert.equal(script.type, "module");
    assert.equal(script.async, false, "async=false keeps document order");
  }

  /* Every refusal is named in the one error thrown after the loop, not the first alone. */
  assert.ok(error instanceof Error, "no error for refused markers");
  const message = error.message;
  for (const [raw, src] of CASES) {
    if (src === null && raw !== "") assert.ok(message.includes(raw), `${raw} is not named in: ${message}`);
  }
});

test("the loader throws nothing when every marker is good", () => {
  const { inserted, error } = runLoader(["/assets/a-AbCdEfGh.js", "/assets/b-AbCdEfGh.js"]);
  assert.equal(error, null);
  assert.equal(inserted.length, 2);
});
