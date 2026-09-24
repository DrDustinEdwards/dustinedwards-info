/**
 * The markdown pipeline emits no raw HTML and no executable URL.
 *
 * ## Why this is a security test and not a formatting one
 *
 * The CSP is ENFORCED with a per-response nonce, and seven HTML routes are
 * shared-cached for up to ten minutes, so cookieless readers served from one
 * cache entry share a nonce. Ruled 2026-08-17 (option A): that trade is
 * acceptable, and the reason it is acceptable is written here rather than only
 * in prose, because it is an ASSUMPTION and assumptions rot.
 *
 * **The assumption: nothing user-writable can put script into these pages.**
 *
 * It has two halves and both are now gated. The upload half is
 * `test/worker/media.test.ts`, which serves every script-capable type as a
 * nosniff attachment. THIS is the markdown half: post bodies are the only other
 * authored content that reaches a shared-cached page, so if the pipeline ever
 * started passing raw HTML through, a shared nonce would stop being a
 * theoretical exposure and become a usable one.
 *
 * ## What the pipeline actually does, measured 2026-08-17
 *
 * `remarkRehype` and `rehypeStringify` are both constructed with NO options, so
 * `allowDangerousHtml` is false at both stages and an `html` mdast node has no
 * hast equivalent to become. Raw HTML is therefore DROPPED, not escaped: a
 * document that is only a `<script>` renders as the empty string. Dangerous URL
 * protocols are refused separately by `rehypeUrlProtocols`, which
 * emits the original text and records the refusal in `blockedUrls`.
 *
 * These are DEFAULTS, which is exactly why they are asserted. Adding
 * `allowDangerousHtml: true` to either call is a one-word change that no other
 * gate would notice.
 *
 * @see app/lib/content/pipeline.mjs
 * @see workers/app.ts, contentSecurityPolicy
 */

import test from "node:test";
import assert from "node:assert/strict";

import { renderBody } from "../app/lib/content/pipeline.mjs";

/** @param {string} body */
const render = (body) =>
  renderBody({ file: "test.md", body, resolveImage: () => null });

/** Markup that would execute, or carry something that executes. */
const EXECUTABLE = /<script|<iframe|<object|<embed|\son\w+\s*=/i;

test("raw HTML in a post body never reaches the output", async () => {
  const cases = [
    ["a bare script tag", "<script>alert(1)</script>"],
    ["an inline event handler", '<img src=x onerror="alert(1)">'],
    ["an iframe", '<iframe src="https://evil.test"></iframe>'],
    ["an object", '<object data="evil.swf"></object>'],
    ["a raw div", '<div class="raw">hello</div>'],
    ["svg carrying a script", "<svg><script>alert(1)</script></svg>"],
  ];
  for (const [label, body] of cases) {
    const { html } = await render(body);
    assert.ok(
      !EXECUTABLE.test(html),
      `${label}: executable markup survived the pipeline: ${html.slice(0, 120)}`,
    );
  }
});

test("an inline tag mid-paragraph is stripped and its text kept", async () => {
  // The prose survives; the element does not. Asserted separately because
  // "output contains no script" would also pass if the whole paragraph vanished.
  const { html } = await render('text with <span onclick="alert(1)">a span</span> inside');
  assert.equal(html.trim(), "<p>text with a span inside</p>");
});

test("CONTROL: ordinary links still become anchors", async () => {
  // Without this, every refusal assertion below would also pass on a pipeline
  // that had simply stopped emitting links at all.
  const absolute = await render("[click](https://example.com)");
  assert.match(absolute.html, /<a href="https:\/\/example\.com">click<\/a>/);
  const relative = await render("[click](/blog/a-post)");
  assert.match(relative.html, /<a href="\/blog\/a-post">click<\/a>/);
});

test("an executable URL protocol produces no anchor and is recorded", async () => {
  for (const protocol of ["javascript:alert(1)", "vbscript:msgbox", "data:text/html;base64,PHNjcmlwdD4="]) {
    const { html, blockedUrls } = await render(`[click](${protocol})`);
    assert.equal(
      (html.match(/<a /g) ?? []).length,
      0,
      `${protocol} produced an anchor`,
    );
    assert.ok(
      blockedUrls.some((entry) => entry.url === protocol),
      `${protocol} was not recorded in blockedUrls`,
    );
  }
});
