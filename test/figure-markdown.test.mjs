import assert from "node:assert/strict";
import test from "node:test";
import { figureMarkdown } from "../app/components/admin/md-editor-commands.ts";

await test("a plain upload URL and alt come through unchanged", () => {
  assert.equal(
    figureMarkdown("https://example.com/media/a.png", " A chart "),
    ':::figure{src="https://example.com/media/a.png" alt="A chart"}\n:::',
  );
});

await test("a quote, space, parenthesis or angle bracket in the URL cannot end the attribute", () => {
  const out = figureMarkdown('https://example.com/a" onerror="x (1)<b>.png', "x");
  assert.equal(out, ':::figure{src="https://example.com/a%22%20onerror=%22x%20%281%29%3Cb%3E.png" alt="x"}\n:::');
  assert.equal(out.split('"').length - 1, 4);
});

await test("a quote in the alt becomes an entity", () => {
  assert.equal(figureMarkdown("https://example.com/a.png", 'the "best" one'), ':::figure{src="https://example.com/a.png" alt="the &quot;best&quot; one"}\n:::');
});
