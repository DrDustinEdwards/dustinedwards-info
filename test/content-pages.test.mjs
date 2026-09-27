import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  CONTENT_PAGE_PATHS,
  contentPageFile,
  contentPageTrail,
} from "../app/lib/content-pages.mjs";
import { PENDING_TARGETS } from "../app/lib/wordpress-redirects.mjs";

const pagesDir = new URL("../content/pages/", import.meta.url);

test("every listed page has its markdown file", () => {
  for (const path of CONTENT_PAGE_PATHS) {
    assert.ok(existsSync(new URL(contentPageFile(path), pagesDir)), `${path}: ${contentPageFile(path)}`);
  }
});

test("a page's file is its path with slashes as hyphens", () => {
  assert.equal(contentPageFile("/research/protocols/coi-primers"), "research-protocols-coi-primers.md");
  assert.equal(contentPageFile("/teaching"), "teaching.md");
});

test("every page an old WordPress address redirects to is one of these pages, or is named here", () => {
  // /contact is a kept address whose page is not one of these.
  const notHere = PENDING_TARGETS.filter((p) => !CONTENT_PAGE_PATHS.includes(p));
  assert.deepEqual(notHere, ["/contact"]);
});

test("every old phage address Google knows lands on a heading of /research/phages", () => {
  // /discovery-of-{name}/ 301s to /research/phages#{name}; rehype-slug gives a plain-name heading that id.
  const markdown = readFileSync(new URL(contentPageFile("/research/phages"), pagesDir), "utf8");
  const ids = new Set(
    [...markdown.matchAll(/^###\s+([A-Za-z0-9]+)\s*$/gm)].map((m) => m[1].toLowerCase()),
  );
  const gsc = JSON.parse(readFileSync(new URL("../scripts/fixtures/wordpress-gsc-urls.json", import.meta.url), "utf8"));
  const names = gsc.paths
    .map((p) => /^\/(?:discovery|annotation)-of-([a-z0-9-]+)\/$/.exec(p)?.[1])
    .filter((n) => n !== undefined);
  assert.ok(names.length > 30, `${names.length} phage addresses in the fixture`);
  assert.deepEqual(names.filter((n) => !ids.has(n)), []);
});

test("a page trails back to its hub, through the page it sits under; a hub stands alone", () => {
  assert.deepEqual(contentPageTrail({ path: "/research/phages", title: "Phages" }), [
    ["Research", "/research"],
    ["Phages", "/research/phages"],
  ]);
  const titles = new Map([["/teaching/virus-isolation", "Virus Isolation Course"]]);
  assert.deepEqual(
    contentPageTrail({ path: "/teaching/virus-isolation/faq", title: "Lab Calculations" }, (p) => titles.get(p)),
    [
      ["Teaching", "/teaching"],
      ["Virus Isolation Course", "/teaching/virus-isolation"],
      ["Lab Calculations", "/teaching/virus-isolation/faq"],
    ],
  );
  assert.deepEqual(contentPageTrail({ path: "/research", title: "Research" }), [["Research", "/research"]]);
  assert.deepEqual(contentPageTrail({ path: "/teaching", title: "Teaching" }), [["Teaching", "/teaching"]]);
});
