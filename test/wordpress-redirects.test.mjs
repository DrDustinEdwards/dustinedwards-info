import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { movedPathTarget } from "../app/lib/path-moves.mjs";
import {
  BAYLOR_PDF,
  EXPLICIT_ROWS,
  PENDING_TARGETS,
  isApexHost,
  wordpressDisposition,
} from "../app/lib/wordpress-redirects.mjs";

const gsc = JSON.parse(readFileSync(new URL("../scripts/fixtures/wordpress-gsc-urls.json", import.meta.url), "utf8"));

/** A target's path, without the fragment a phage row carries. */
const targetPath = (location) => location.split("#")[0];

/** Paths the new site answers itself, now: the gateway passes these through and a route renders them. */
const ANSWERED_NOW = new Set(["/", "/login/", "/about", "/playground", "/research/publications"]);

test("the apex host is dustinedwards.info and www, and nothing else", () => {
  assert.equal(isApexHost("dustinedwards.info"), true);
  assert.equal(isApexHost("www.dustinedwards.info"), true);
  assert.equal(isApexHost("WWW.DustinEdwards.info"), true);
  assert.equal(isApexHost("dustinedwards.dustin-edwards.workers.dev"), false);
  assert.equal(isApexHost("localhost"), false);
});

test("every Search Console URL resolves: 200 kept, one 301, or 410, never unmapped", () => {
  assert.equal(gsc.paths.length + gsc.profilePaths, gsc.total, "the fixture accounts for all 271");
  assert.equal(gsc.total, 271);

  /** @type {string[]} */
  const problems = [];
  for (const raw of gsc.paths) {
    const url = new URL(raw, "https://dustinedwards.info");
    const d = wordpressDisposition(url.pathname);
    if (d === null) {
      // Kept: the page must be one the new site answers, or listed as pending for the switch.
      const kept = url.pathname.replace(/\/$/, "") || "/";
      if (!ANSWERED_NOW.has(url.pathname) && !ANSWERED_NOW.has(kept) && !PENDING_TARGETS.includes(kept)) {
        problems.push(`${raw}: kept, but nothing answers it`);
      }
      continue;
    }
    if (d.status === 410) continue;
    const target = targetPath(d.location);
    // One hop: the target is not itself redirected by either map.
    if (wordpressDisposition(target) !== null) problems.push(`${raw}: ${target} redirects again`);
    if (movedPathTarget(target) !== null) problems.push(`${raw}: ${target} is an old new-site path`);
    if (!ANSWERED_NOW.has(target) && !PENDING_TARGETS.includes(target)) {
      problems.push(`${raw}: ${target} is neither a page nor listed as pending`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the profile paths the fixture counts are all answered by the one 410 rule", () => {
  assert.equal(gsc.profilePaths, 147);
  for (const path of ["/user/a-student/", "/user/a-student/?profiletab=posts", "/author/someone/"]) {
    assert.deepEqual(wordpressDisposition(new URL(path, "https://x").pathname), { status: 410 });
  }
});

test("every explicit row's target is a page or pending, and never chains", () => {
  for (const [from, to] of Object.entries(EXPLICIT_ROWS)) {
    assert.ok(ANSWERED_NOW.has(to) || PENDING_TARGETS.includes(to), `${from} -> ${to}`);
    assert.equal(wordpressDisposition(to), null, `${to} redirects again`);
  }
});

test("slashed and bare forms match; a row rebuilt in place never loops", () => {
  assert.deepEqual(wordpressDisposition("/virus-isolation/"), { status: 301, location: "/research/protocols/phage-isolation" });
  assert.deepEqual(wordpressDisposition("/virus-isolation"), { status: 301, location: "/research/protocols/phage-isolation" });
  assert.deepEqual(wordpressDisposition("/research/"), { status: 301, location: "/research" });
  assert.equal(wordpressDisposition("/research"), null);
});

test("kept pages and the new site's own paths pass through", () => {
  for (const path of ["/", "/contact/", "/login/", "/about", "/writing/a-post", "/research/publications", BAYLOR_PDF]) {
    assert.equal(wordpressDisposition(path), null, path);
  }
});

test("the switch checklist's pending list names the Baylor PDF and every unbuilt target", () => {
  assert.ok(PENDING_TARGETS.includes(BAYLOR_PDF));
  assert.ok(PENDING_TARGETS.includes("/research/protocols/coi-primers"));
  assert.ok(PENDING_TARGETS.includes("/teaching"));
});
