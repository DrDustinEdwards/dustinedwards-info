import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CONTENT_PAGE_PATHS, CONTENT_PAGE_SECTIONS, contentPageFile } from "../app/lib/content-pages.mjs";
import { movedPathTarget } from "../app/lib/path-moves.mjs";
import { publishedProcedurePaths } from "../scripts/lib/procedure-paths.mjs";
import {
  BAYLOR_PDF,
  EXPLICIT_ROWS,
  PENDING_TARGETS,
  PROFILE_TARGET,
  isApexHost,
  wordpressDisposition,
} from "../app/lib/wordpress-redirects.mjs";

const gsc = JSON.parse(readFileSync(new URL("../scripts/fixtures/wordpress-gsc-urls.json", import.meta.url), "utf8"));

/** A target's path, without the fragment a phage row carries. */
const targetPath = (location) => location.split("#")[0];

/** Paths the new site answers itself, now: the gateway passes these through and a route renders them. */
const ANSWERED_NOW = new Set(["/", "/login/", "/about", "/contact", "/cv", "/research/publications"]);

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

test("the profile paths the fixture counts all 301 to the roster in one hop", () => {
  // 146 counted here plus Dustin's own /author/dustin/, listed in the fixture: the 147 profile URLs.
  assert.equal(gsc.profilePaths, 146);
  assert.ok(gsc.paths.includes("/author/dustin/"));
  assert.equal(PROFILE_TARGET, "/teaching/phage-discovery#roster");
  for (const path of ["/user/a-student/", "/user/a-student/?profiletab=posts", "/author/someone/", "/author/someone"]) {
    assert.deepEqual(wordpressDisposition(new URL(path, "https://x").pathname), { status: 301, location: PROFILE_TARGET }, path);
  }
  const to = targetPath(PROFILE_TARGET);
  assert.equal(wordpressDisposition(to), null, "the roster page is not redirected again");
  assert.equal(movedPathTarget(to), null, "the roster page is not an old new-site path");
  // The bare /user/ was the membership directory, not a profile, and is gone with the membership pages.
  assert.deepEqual(wordpressDisposition("/user/"), { status: 410 });
});

test("every explicit row's target is a page or pending, and never chains", () => {
  for (const [from, location] of Object.entries(EXPLICIT_ROWS)) {
    const to = targetPath(location);
    assert.ok(ANSWERED_NOW.has(to) || PENDING_TARGETS.includes(to), `${from} -> ${location}`);
    assert.equal(wordpressDisposition(to), null, `${to} redirects again`);
  }
});

test("every explicit row lands in one hop: no target is a moved or retired new-site path", () => {
  for (const [from, location] of Object.entries(EXPLICIT_ROWS)) {
    const to = targetPath(location);
    assert.equal(movedPathTarget(to), null, `${from} -> ${to} is redirected again by path-moves`);
  }
});

test("the molarity and metric prefix calculators answer 410: nothing on the new site replaces them", () => {
  for (const path of ["/molarity-calculator/", "/molarity-calculator", "/knowledge-base/metric-prefix/"]) {
    assert.deepEqual(wordpressDisposition(path), { status: 410 }, path);
  }
  assert.equal(Object.hasOwn(EXPLICIT_ROWS, "/molarity-calculator"), false);
  assert.equal(Object.hasOwn(EXPLICIT_ROWS, "/knowledge-base/metric-prefix"), false);
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
  // Dustin's own author page ranks for his name; every other author page is a profile and goes to the roster.
  assert.equal(to("/author/dustin/"), "/about");
  assert.equal(to("/author/someone/"), "/teaching/phage-discovery#roster");
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

/*
 * cutover.md's "Redirect map" (Capsid, dustinedwards, as of 2026-09-28), copied here as data so the code
 * is graded against the decision, not against itself. Every explicit row, and at least one concrete
 * address for every pattern rule, in the doc's words. When the doc changes, this table changes with it.
 * `null` is a kept page: the new site answers it and nothing redirects.
 */
const GONE = "410";
const CUTOVER_PATTERN_EXAMPLES = /** @type {Array<[string, string | null]>} */ ([
  // /discovery-of-{name}/ and /annotation-of-{name}/ -> 301 /research/phages#{name}
  ["/discovery-of-lucinda/", "/research/phages#lucinda"],
  ["/annotation-of-arlo/", "/research/phages#arlo"],
  // /phylogenetics-lysm/, /arlo-gene-67/, /arlo-gene-67-cloning/, /raspberry-pi-plaque-counter/ -> 301 /research/phages
  ["/phylogenetics-lysm/", "/research/phages"],
  ["/arlo-gene-67/", "/research/phages"],
  ["/arlo-gene-67-cloning/", "/research/phages"],
  ["/raspberry-pi-plaque-counter/", "/research/phages"],
  // /directory-*/ -> 301 /teaching/phage-discovery
  ["/directory-2019-phage-researchers/", "/teaching/phage-discovery"],
  // /author/dustin/ -> 301 /about, before the /author/* rule
  ["/author/dustin/", "/about"],
  // /user/*, other /author/* -> 301 /teaching/phage-discovery#roster
  ["/user/example-student/", "/teaching/phage-discovery#roster"],
  ["/author/example/", "/teaching/phage-discovery#roster"],
  // /register/, /members/, /logout/, /account/, /password-reset/, /user/ -> 410
  ["/register/", GONE],
  ["/members/", GONE],
  ["/logout/", GONE],
  ["/account/", GONE],
  ["/password-reset/", GONE],
  ["/user/", GONE],
  // /category/phage-isolation-notes/*, /microbiomes/page/*, /phages/page/* -> 301 /research/phages
  ["/category/phage-isolation-notes/page/5/", "/research/phages"],
  ["/microbiomes/page/5/", "/research/phages"],
  ["/phages/page/2/", "/research/phages"],
  // /knowledge-base/category/* -> 301 /research/protocols
  ["/knowledge-base/category/protocols/pcr/", "/research/protocols"],
  // other /category/*, /tag/* -> 410
  ["/category/uncategorized/", GONE],
  ["/tag/fall-2025/", GONE],
  // the Baylor PDF -> 301 /research/protocols/phage-dna-extraction
  ["/wp-content/uploads/2017/09/DNA-Extraction-Protocol-Baylor.pdf", "/research/protocols/phage-dna-extraction"],
  // all other /wp-content/uploads/* -> 410
  ["/wp-content/uploads/2023/11/Electrophoresis.pdf", GONE],
  // New-site renames: /blog/{slug} -> /writing/{slug}, /publications -> /research/publications
  ["/blog/a-post", "/writing/a-post"],
  ["/publications", "/research/publications"],
]);

const CUTOVER_EXPLICIT_ROWS = /** @type {Array<[string, string | null]>} */ ([
  ["/knowledge-base/pcr-coi-lco1490-hco2198/", "/research/protocols/coi-primers"],
  ["/virus-isolation/", "/teaching/virus-isolation"],
  ["/phage-discovery/", "/teaching/phage-discovery"],
  ["/phage-bioinformatics/", "/teaching/phage-bioinformatics"],
  ["/central-dogma-tutorials/", "/teaching/central-dogma"],
  ["/research/", "/research"],
  ["/knowledge-base/pcr-rev-3-ltr-8000-8297/", "/research/protocols/rev-lpdv-primers"],
  ["/knowledge-base/pcr-rev-pol-2500-3750/", "/research/protocols/rev-lpdv-primers"],
  ["/knowledge-base/pcr-pan-avian-gapdh/", "/research/protocols/pan-avian-gapdh"],
  ["/wolbachia-project-genetic-techniques/", "/research/protocols"],
  ["/knowledge-base/pcr-wolbachia-16s-rrna/", "/research/protocols"],
  ["/gentech-2018a/", "/research/protocols"],
  ["/", null],
  ["/contact/", null],
  ["/login/", null],
  ["/publications/", "/research/publications"],
  ["/manuscripts/", "/research/publications"],
  ["/knowledge-base/rev-lpdv-2018-2020-database/", "/research/publications"],
  ["/virology-course/", "/teaching"],
  ["/genetics-course/", "/teaching"],
  ["/vaccines-course/", "/teaching"],
  ["/cell-biology-course/", "/teaching"],
  ["/lecture-courses/", "/teaching"],
  ["/courses/", "/teaching"],
  ["/related-courses/", "/teaching"],
  ["/research-lab-courses/", "/teaching"],
  ["/biomedical-sciences-academic-advising/", "/teaching"],
  ["/tarleton-biological-sciences-biomedical-sciences-and-biology/", "/teaching"],
  ["/study-skills-guide/", "/teaching/study-skills"],
  ["/teaching-philosophy/", "/teaching#teaching-philosophy"],
  // Before the /directory-*/ rule.
  ["/prospective-students/", "/teaching#join-the-lab"],
  ["/directory-research-group/", "/teaching#join-the-lab"],
  ["/phage-discovery-application/", "/teaching/phage-discovery"],
  ["/phages/", "/research/phages"],
  ["/phage-archives/", "/research/phages"],
  ["/microbiomes/", "/research"],
  ["/laboratory/", "/research"],
  ["/phage-genetic-studies/", "/research/bacteriophages"],
  ["/retroviruses/", "/research/retroviruses"],
  ["/rev-lpdv-surveys/", "/research/retroviruses/avian"],
  ["/rev-lpdv-genetic-studies/", "/research/retroviruses/avian"],
  ["/molarity-calculator/", GONE],
  ["/knowledge-base/metric-prefix/", GONE],
  ["/wp-content/uploads/2019/02/Dustin-Edwards-Curriculum-Vitae-2019.pdf", "/cv"],
  ["/knowledge-base/", "/research/protocols"],
  ["/virus-isolation-reagent-request/", "/teaching/virus-isolation"],
]);

/**
 * What a reader on the apex host gets for `path`, in the gateway's order (workers/app.ts): the WordPress
 * map first, then the new site's own moved sections. "410", a 301 target, or null when the site answers it.
 * @param {string} path
 */
function apexAnswer(path) {
  const d = wordpressDisposition(path);
  if (d) return d.status === 410 ? GONE : d.location;
  return movedPathTarget(path);
}

/** The site's static routes, read off app/routes.ts, plus the markdown pages its splat routes serve. */
const routesSource = readFileSync(new URL("../app/routes.ts", import.meta.url), "utf8");
const STATIC_ROUTES = new Set([
  "/",
  ...[...routesSource.matchAll(/\broute\("([^"*:]+)"/g)].map((m) => `/${m[1]}`),
  ...CONTENT_PAGE_PATHS,
  // The protocols, which are procedures drawn from D1 (docs/PROCEDURES.md).
  ...publishedProcedurePaths(),
]);

/** Anchors a target may carry: the headings the build proves exist, and the roster the program page renders. */
const rosterSource = readFileSync(new URL("../app/components/phage-roster.tsx", import.meta.url), "utf8");
const phagesMarkdown = readFileSync(
  new URL(`../content/pages/${contentPageFile("/research/phages")}`, import.meta.url),
  "utf8",
);
/** @param {string} target */
function anchorExists(target) {
  const [path, id] = target.split("#");
  if (CONTENT_PAGE_SECTIONS.includes(target)) return true;
  if (path === "/teaching/phage-discovery" && id === "roster") return /\bid="roster"/.test(rosterSource);
  if (path === "/research/phages") return new RegExp(`^###\\s+${id}\\s*$`, "im").test(phagesMarkdown);
  return false;
}

test("cutover.md's redirect map: every explicit row and every pattern rule answers as the doc says", () => {
  const wrong = [];
  for (const [from, expected] of [...CUTOVER_EXPLICIT_ROWS, ...CUTOVER_PATTERN_EXAMPLES]) {
    const actual = apexAnswer(new URL(from, "https://dustinedwards.info").pathname);
    if (actual !== expected) wrong.push(`${from}: expected ${expected}, got ${actual}`);
  }
  assert.deepEqual(wrong, []);
});

test("cutover.md's redirect map: every code row is a row of the doc", () => {
  const docRows = new Set(CUTOVER_EXPLICIT_ROWS.map(([from]) => from.replace(/\/$/, "")));
  assert.deepEqual(Object.keys(EXPLICIT_ROWS).filter((from) => !docRows.has(from)), []);
});

test("cutover.md's redirect map: every target is a real page, every anchor is on it, and nothing chains", () => {
  const broken = [];
  for (const [from, target] of [...CUTOVER_EXPLICIT_ROWS, ...CUTOVER_PATTERN_EXAMPLES]) {
    if (target === null || target === GONE) continue;
    const path = targetPath(target);
    // /writing/:slug is a route; the example slug stands for any post.
    const routed = STATIC_ROUTES.has(path) || /^\/writing\/[^/]+$/.test(path);
    if (!routed) broken.push(`${from}: ${path} is not a route`);
    if (target.includes("#") && !anchorExists(target)) broken.push(`${from}: ${target} has no such anchor`);
    if (apexAnswer(path) !== null) broken.push(`${from}: ${path} redirects again`);
  }
  assert.deepEqual(broken, []);
});

test("the Baylor PDF goes to its protocol page, which the switch checklist lists as pending", () => {
  assert.deepEqual(wordpressDisposition(BAYLOR_PDF), { status: 301, location: "/research/protocols/phage-dna-extraction" });
  assert.ok(PENDING_TARGETS.includes("/research/protocols/phage-dna-extraction"));
  assert.ok(PENDING_TARGETS.includes("/research/protocols/coi-primers"));
  assert.ok(PENDING_TARGETS.includes("/teaching"));
});
