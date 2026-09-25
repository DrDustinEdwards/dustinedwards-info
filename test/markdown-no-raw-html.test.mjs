/* A security test, not a formatting one: shared-cached readers share a CSP nonce, which is safe
 * only while nothing user-writable can put script into those pages. Raw HTML is dropped only by
 * DEFAULT, and `allowDangerousHtml: true` is a one-word change no other gate would notice. */

import test from "node:test";
import assert from "node:assert/strict";

import { render } from "./lib/render.mjs";

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
  // Asserted separately: "no script" would also pass if the whole paragraph vanished.
  const { html } = await render('text with <span onclick="alert(1)">a span</span> inside');
  assert.equal(html.trim(), "<p>text with a span inside</p>");
});

test("CONTROL: ordinary links still become anchors", async () => {
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
