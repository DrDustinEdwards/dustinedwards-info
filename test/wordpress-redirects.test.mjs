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
const ANSWERED_NOW = new Set(["/", "/login/", "/about", "/contact", "/playground", "/research/publications"]);

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
  assert.equal(gsc.profilePaths, 146);
  for (const path of ["/user/a-student/", "/user/a-student/?profiletab=posts", "/author/someone/"]) {
    assert.deepEqual(wordpressDisposition(new URL(path, "https://x").pathname), { status: 410 });
  }
});

test("every explicit row's target is a page or pending, and never chains", () => {
  for (const [from, location] of Object.entries(EXPLICIT_ROWS)) {
    const to = targetPath(location);
    assert.ok(ANSWERED_NOW.has(to) || PENDING_TARGETS.includes(to), `${from} -> ${location}`);
    assert.equal(wordpressDisposition(to), null, `${to} redirects again`);
  }
});

test("the 2026-09-27 map: courses and the program under Teaching, no Wolbachia page", () => {
  const to = (path) => wordpressDisposition(path)?.location;
  for (const path of ["/wolbachia-project-genetic-techniques/", "/knowledge-base/pcr-wolbachia-16s-rrna/", "/gentech-2018a/"]) {
    assert.equal(to(path), "/research/protocols", path);
  }
  assert.equal(to("/phage-discovery/"), "/teaching/phage-discovery");
  assert.equal(to("/virus-isolation/"), "/teaching/virus-isolation");
  assert.equal(to("/virus-isolation-reagent-request/"), "/teaching/virus-isolation");
  assert.equal(to("/phage-bioinformatics/"), "/teaching/phage-bioinformatics");
  assert.equal(to("/central-dogma-tutorials/"), "/teaching/central-dogma");
  assert.equal(to("/phage-genetic-studies/"), "/research/bacteriophages");
  assert.equal(to("/phage-discovery-application/"), "/teaching/phage-discovery");
  assert.equal(to("/directory-2019-phage-researchers/"), "/teaching/phage-discovery");
  // Dustin's own author page ranks for his name; every other author page is a profile and answers 410.
  assert.equal(to("/author/dustin/"), "/about");
  assert.deepEqual(wordpressDisposition("/author/someone/"), { status: 410 });
  assert.equal(to("/retroviruses/"), "/research/retroviruses");
  for (const path of ["/rev-lpdv-surveys/", "/rev-lpdv-genetic-studies/"]) {
    assert.equal(to(path), "/research/retroviruses/avian", path);
  }
});

test("the pages written after the map: study skills, Join the lab and Teaching philosophy", () => {
  const to = (path) => wordpressDisposition(path)?.location;
  assert.equal(to("/study-skills-guide/"), "/teaching/study-skills");
  assert.equal(to("/teaching-philosophy/"), "/teaching#teaching-philosophy");
  assert.equal(to("/prospective-students/"), "/teaching#join-the-lab");
  // Ahead of the /directory-*/ rule, which still sends the phage cohort directories to the program.
  assert.equal(to("/directory-research-group/"), "/teaching#join-the-lab");
  assert.equal(to("/directory-2019-phage-researchers/"), "/teaching/phage-discovery");
});

test("slashed and bare forms match; a row rebuilt in place never loops", () => {
  assert.deepEqual(wordpressDisposition("/virus-isolation/"), { status: 301, location: "/teaching/virus-isolation" });
  assert.deepEqual(wordpressDisposition("/virus-isolation"), { status: 301, location: "/teaching/virus-isolation" });
  assert.deepEqual(wordpressDisposition("/research/"), { status: 301, location: "/research" });
  assert.equal(wordpressDisposition("/research"), null);
});

test("kept pages and the new site's own paths pass through", () => {
  for (const path of ["/", "/contact/", "/login/", "/about", "/writing/a-post", "/research/publications"]) {
    assert.equal(wordpressDisposition(path), null, path);
  }
});

test("the Baylor PDF goes to its protocol page, which the switch checklist lists as pending", () => {
  assert.deepEqual(wordpressDisposition(BAYLOR_PDF), { status: 301, location: "/research/protocols/phage-dna-extraction" });
  assert.ok(PENDING_TARGETS.includes("/research/protocols/phage-dna-extraction"));
  assert.ok(PENDING_TARGETS.includes("/research/protocols/coi-primers"));
  assert.ok(PENDING_TARGETS.includes("/teaching"));
});
