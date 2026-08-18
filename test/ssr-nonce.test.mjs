/**
 * Every inline script the SERVER RENDERER emits carries the CSP nonce.
 *
 * REPLAYS THE DEFECT, per hard rule 12. `app/entry.server.tsx` passed the nonce
 * as a PROP to `<ServerRouter>` and nothing else. That prop reaches
 * react-router's components and cannot reach react-dom, which writes inline
 * scripts of its own to COMPLETE a Suspense boundary whose content resolves
 * after the shell has flushed. react-dom takes their nonce from the
 * `renderToReadableStream` OPTIONS.
 *
 * Inert under `Content-Security-Policy-Report-Only`, live under
 * `Content-Security-Policy`. Enforcement landed 2026-08-17 and the site's ONE
 * Suspense boundary, the lazily imported CodeMirror in the post editor, stopped
 * completing: the browser refused the scripts, the `null` fallback was never
 * swapped for the editor, and react reported error #419.
 *
 * ## Why the no-option case is asserted too
 *
 * A guard that has never been observed failing has not been verified. Asserting
 * only that the nonced render is clean would pass just as happily if react had
 * stopped emitting these scripts at all, or if the needle stopped matching. The
 * bare case is the control: it proves the scripts EXIST, that they are emitted
 * WITHOUT a nonce when the option is absent, and therefore that the option is
 * the mechanism rather than a decoration.
 *
 * ## OBSERVATION BOUNDARY
 *
 * This holds react-dom's contract and `entry.server.tsx`'s use of it. It does
 * NOT drive a browser, so it cannot see a script blocked by a real policy, and
 * it does not prove any particular component mounts. The general case, a
 * component that renders server-side and fails to appear in a browser, is seen
 * by NO gate in this repo: `check:admin-ui` renders with
 * `renderToStaticMarkup`, which renders a Suspense FALLBACK and moves on, so
 * the editor is invisible to it in exactly the state this defect produced.
 *
 * @see app/entry.server.tsx, workers/app.ts (contentSecurityPolicy)
 */

import test from "node:test";
import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createElement as h, Suspense, lazy } from "react";
import { renderToReadableStream } from "react-dom/server";

const NONCE = "test-nonce-value";

/**
 * A tree with one Suspense boundary that resolves LATE.
 *
 * Fresh per call, deliberately: `lazy` caches its resolved value, so a shared
 * component suspends on the first render only and every later assertion would
 * be made against a render that never needed a completion script.
 */
function freshTree() {
  const Late = lazy(
    () =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ default: () => h("div", { id: "late" }, "content") }), 50),
      ),
  );
  return h(
    "html",
    null,
    h("body", null, h("div", null, "shell"), h(Suspense, { fallback: null }, h(Late))),
  );
}

/**
 * Renders and reads the stream PROGRESSIVELY, returning every `<script>` tag.
 *
 * The progressive read is load bearing. Awaiting `stream.allReady` first lets
 * react buffer the whole document into one flush, where the boundary's content
 * is written inline and no completion script is ever needed. Asserting against
 * that render would be asserting against a document the browser never receives.
 *
 * @param {object} options passed straight to renderToReadableStream
 * @returns {Promise<{ scripts: string[], html: string }>}
 */
async function renderScripts(options) {
  const stream = await renderToReadableStream(freshTree(), options);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let html = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
  }
  return { scripts: [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]), html };
}

test("a boundary resolving after the shell DOES emit inline scripts", async () => {
  // Scope check: everything below is vacuous if this render emits none.
  const { scripts, html } = await renderScripts({});
  assert.ok(scripts.length > 0, "no inline script emitted, so the rest asserts nothing");
  assert.match(html, /id="late"/, "the boundary content never arrived");
});

test("WITHOUT the nonce option those scripts ship bare", async () => {
  // The defect itself. This is what an enforcing CSP refuses.
  const { scripts } = await renderScripts({});
  const bare = scripts.filter((s) => !/\bnonce=/.test(s));
  assert.equal(
    bare.length,
    scripts.length,
    "expected every completion script to be un-nonced without the option",
  );
});

test("WITH the nonce option every emitted script carries it", async () => {
  const { scripts } = await renderScripts({ nonce: NONCE });
  assert.ok(scripts.length > 0, "nothing was emitted, so nothing was checked");
  const bare = scripts.filter((s) => !s.includes(`nonce="${NONCE}"`));
  assert.deepEqual(bare, [], "these would be blocked by script-src 'nonce-...'");
});

test("entry.server.tsx passes the nonce as a RENDER OPTION, not only as a prop", async () => {
  const source = await readFile(
    fileURLToPath(new URL("../app/entry.server.tsx", import.meta.url)),
    "utf8",
  );

  // The prop alone was the defect, so its presence must not satisfy this.
  assert.match(source, /<ServerRouter[^>]*nonce=\{nonce\}/, "the ServerRouter prop went missing");

  // The options object is the second argument to renderToReadableStream. Match
  // the call through to its options rather than grepping the file for the word
  // `nonce`, which the prop and the comments above it already satisfy.
  const call = /renderToReadableStream\(([\s\S]*?)\n  \);/.exec(source);
  assert.ok(call, "could not locate the renderToReadableStream call");
  const optionsStart = call[1].indexOf("{");
  assert.ok(optionsStart !== -1, "renderToReadableStream has no options object");
  assert.match(
    call[1].slice(optionsStart),
    /(^|[\s{,])nonce\s*(,|:)/m,
    "react-dom's own streaming scripts will ship without a nonce",
  );
});
