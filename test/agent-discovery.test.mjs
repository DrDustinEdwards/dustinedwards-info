// The paper twins are static assets: the Worker never runs for them, so their canonical Link comes
// from public/_headers, and test/worker/agent-discovery.test.ts cannot see it. This resolves the rule
// the way Workers Assets does (one splat, greedy, `:splat` substituted into the value) for every paper,
// and checks it names that paper's own page.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLICATIONS } from "../app/data/publications.ts";
import { CONTENT_PAGE_PATHS, contentPageMarkdownPath } from "../app/lib/content-pages.mjs";
import { doiSlug, paperMarkdownPath, paperPath } from "../app/lib/publications/paths.mjs";

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

test("every paper twin names its own paper page with Link rel=canonical", () => {
  assert.ok(PUBLICATIONS.length > 0, "no papers read, so nothing below asserts anything");
  for (const paper of PUBLICATIONS) {
    const slug = doiSlug(paper.doi);
    const headers = headersFor(paperMarkdownPath(slug));
    assert.equal(headers.get("link"), `<${paperPath(slug)}>; rel="canonical"`, slug);
    assert.equal(headers.get("x-robots-tag"), "noindex", slug);
  }
});

test("every research and teaching page twin names its HTML page", () => {
  assert.ok(CONTENT_PAGE_PATHS.length > 0);
  for (const pagePath of CONTENT_PAGE_PATHS) {
    const headers = headersFor(contentPageMarkdownPath(pagePath));
    assert.equal(headers.get("link"), `<${pagePath}>; rel="canonical"`, pagePath);
    assert.equal(headers.get("x-robots-tag"), "noindex", pagePath);
    const file = join(root, "public", contentPageMarkdownPath(pagePath).slice(1));
    assert.equal(existsSync(file), true, `${file} is missing. Run build:content.`);
    assert.ok(readFileSync(file, "utf8").startsWith("# "), pagePath);
  }
});

test("the canonical rule reaches no path outside the paper twins", () => {
  for (const path of ["/research/publications/", "/research/publications.json", "/writing/a-post.md", "/llms.txt"]) {
    assert.equal(headersFor(path).get("link"), undefined, path);
  }
});
