// The research and teaching page twins are static assets: the Worker never runs for them, so their canonical Link
// comes from public/_headers, and test/worker/agent-discovery.test.ts cannot see it. This resolves the rule the way
// Workers Assets does (one splat, greedy, `:splat` substituted into the value) for every page twin, and checks it
// names that page. The paper twins are a Worker route since publications moved to D1 (their headers are code, and
// test/worker/agent-discovery.test.ts holds them), so this file asserts they have no rule here to shadow it.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { CONTENT_PAGES_FROM_DATA, contentPageMarkdownPath } from "../app/lib/content-pages.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @returns {Array<{ path: string, headers: Array<[string, string]> }>} */
function headerRules() {
  const rules = [];
  for (const line of readFileSync(join(root, "public", "_headers"), "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\s/.test(line)) {
      const at = line.indexOf(":");
      rules.at(-1)?.headers.push([line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim()]);
    } else {
      rules.push({ path: line.trim(), headers: [] });
    }
  }
  return rules;
}

/**
 * The headers a request path receives, with `:splat` substituted.
 *
 * @param {string} path
 */
function headersFor(path) {
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const rule of headerRules()) {
    const [before, after = null] = rule.path.split("*");
    let splat = "";
    if (after === null) {
      if (path !== before) continue;
    } else {
      if (!path.startsWith(before) || !path.endsWith(after) || path.length < before.length + after.length) continue;
      splat = path.slice(before.length, path.length - after.length);
    }
    for (const [name, value] of rule.headers) out.set(name, value.replaceAll(":splat", splat));
  }
  return out;
}

test("no header rule names the paper twins, which are a route now and set their own headers", () => {
  const rules = headerRules().filter((rule) => rule.path.startsWith("/research/publications"));
  assert.deepEqual(
    rules.map((rule) => rule.path),
    [],
    "a rule for /research/publications/*.md is a stale copy of what app/routes/publications.$slug[.md].ts sets",
  );
  assert.equal(headersFor("/research/publications/10-1128-mra-00888-24.md").size, 0);
});

// The other page twins are a route, drawn from D1 (docs/PAGES.md); test/worker/pages.test.ts asserts their headers.
test("every static page twin (the pages generated from data) names its HTML page", () => {
  assert.ok(CONTENT_PAGES_FROM_DATA.length > 0);
  for (const pagePath of CONTENT_PAGES_FROM_DATA) {
    const headers = headersFor(contentPageMarkdownPath(pagePath));
    assert.equal(headers.get("link"), `<${pagePath}>; rel="canonical"`, pagePath);
    assert.equal(headers.get("x-robots-tag"), "noindex", pagePath);
    const file = join(root, "public", contentPageMarkdownPath(pagePath).slice(1));
    assert.equal(existsSync(file), true, `${file} is missing. Run build:content.`);
    assert.ok(readFileSync(file, "utf8").startsWith("# "), pagePath);
  }
});

test("the canonical rule reaches no path it was not written for", () => {
  for (const path of ["/research/publications/", "/research/publications.json", "/writing/a-post.md", "/llms.txt"]) {
    assert.equal(headersFor(path).get("link"), undefined, path);
  }
});
