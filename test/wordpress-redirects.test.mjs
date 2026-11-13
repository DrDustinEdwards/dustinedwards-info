import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { CONTENT_PAGE_PATHS, CONTENT_PAGE_SECTIONS } from "../app/lib/content-pages.mjs";
import { ROSTER_ANCHOR, ROSTER_PAGE_PATH } from "../app/lib/roster/compile.mjs";
import { publishedProcedurePaths } from "../scripts/lib/procedure-paths.mjs";
import {
  EXPLICIT_ROWS,
  PENDING_TARGETS,
  wordpressDisposition,
} from "../app/lib/wordpress-redirects.mjs";

const gsc = JSON.parse(
  readFileSync(new URL("../scripts/fixtures/wordpress-gsc-urls.json", import.meta.url), "utf8"),
);

/** A target's path, without the fragment a phage row carries. */
const targetPath = (location) => location.split("#")[0];

/** Paths the new site answers itself, now: the gateway passes these through and a route renders them. */
const ANSWERED_NOW = new Set([
  "/",
  "/login/",
  "/about",
  "/contact",
  "/cv",
  "/dustin-edwards-cv.pdf",
  "/research/publications",
  "/sitemap.xml",
]);

await test("every Search Console URL resolves: 200 kept, one 301, or 410, never unmapped", () => {
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
      if (
        !ANSWERED_NOW.has(url.pathname) &&
        !ANSWERED_NOW.has(kept) &&
        !PENDING_TARGETS.includes(kept)
      ) {
        problems.push(`${raw}: kept, but nothing answers it`);
      }
      continue;
    }
    if (d.status === 410) continue;
    const target = targetPath(d.location);
    // One hop: the target is not itself redirected.
    if (wordpressDisposition(target) !== null) problems.push(`${raw}: ${target} redirects again`);
    if (!ANSWERED_NOW.has(target) && !PENDING_TARGETS.includes(target)) {
      problems.push(`${raw}: ${target} is neither a page nor listed as pending`);
    }
  }
  assert.deepEqual(problems, []);
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
  [
    "/wp-content/uploads/2017/09/DNA-Extraction-Protocol-Baylor.pdf",
    "/research/protocols/phage-dna-extraction",
  ],
  // all other /wp-content/uploads/* -> 410
  ["/wp-content/uploads/2023/11/Spot-Titer.png", GONE],
  // the two lab-protocol scans that still earn clicks or impressions
  ["/wp-content/uploads/2023/11/Electrophoresis.pdf", "/research/protocols"],
  [
    "/wp-content/uploads/2023/11/DNA-Extraction-Scan.pdf",
    "/research/protocols/phage-dna-extraction",
  ],
  // /publications -> /research/publications. The doc's other new-site rename, /blog/{slug} ->
  // /writing/{slug}, went on 2026-10-20: only the old site redirects to the new one (Dustin).
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
  ["/knowledge-base/pcr-rev-pol-4777-5575/", "/research/protocols/rev-lpdv-primers"],
  ["/knowledge-base/pcr-pan-avian-gapdh/", "/research/protocols/pan-avian-gapdh"],
  ["/wolbachia-project-genetic-techniques/", "/research/protocols"],
  ["/knowledge-base/pcr-wolbachia-16s-rrna/", "/research/protocols"],
  ["/gentech-2018a/", "/research/protocols"],
  ["/sitemap_index.xml", "/sitemap.xml"],
  ["/", null],
  ["/contact/", null],
  ["/login/", null],
  ["/publications/", "/research/publications"],
  ["/manuscripts/", "/research/publications"],
  ["/knowledge-base/rev-lpdv-2018-2020-database/", "/research/publications"],
  ["/knowledge-base/rev-lpdv-2023-2025-database/", "/research/publications"],
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
  [
    "/wp-content/uploads/2019/02/Dustin-Edwards-Curriculum-Vitae-2019.pdf",
    "/dustin-edwards-cv.pdf",
  ],
  ["/knowledge-base/", "/research/protocols"],
  ["/virus-isolation-reagent-request/", "/teaching/virus-isolation"],
]);

/**
 * What a reader on the apex host gets for `path` from the WordPress map (workers/app.ts): "410", a 301
 * target, or null when the site answers it.
 * @param {string} path
 */
function apexAnswer(path) {
  const d = wordpressDisposition(path);
  if (!d) return null;
  return d.status === 410 ? GONE : d.location;
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
const rosterSource = readFileSync(
  new URL("../app/components/phage-roster.tsx", import.meta.url),
  "utf8",
);
/** The phage headings are drawn from content/phages, one file per phage, named for the heading (docs/PHAGES.md). */
const phageFiles = new Set(
  readdirSync(new URL("../content/phages/", import.meta.url)).map((name) =>
    name.replace(/\.md$/, ""),
  ),
);
/** @param {string} target */
function anchorExists(target) {
  const [path, id] = target.split("#");
  if (CONTENT_PAGE_SECTIONS.includes(target)) return true;
  if (path === ROSTER_PAGE_PATH && id === ROSTER_ANCHOR)
    return rosterSource.includes(`id="${ROSTER_ANCHOR}"`);
  if (path === "/research/phages") return phageFiles.has(id);
  return false;
}

await test("cutover.md's redirect map: every explicit row and every pattern rule answers as the doc says", () => {
  const wrong = [];
  for (const [from, expected] of [...CUTOVER_EXPLICIT_ROWS, ...CUTOVER_PATTERN_EXAMPLES]) {
    const actual = apexAnswer(new URL(from, "https://dustinedwards.info").pathname);
    if (actual !== expected) wrong.push(`${from}: expected ${expected}, got ${actual}`);
  }
  assert.deepEqual(wrong, []);
});

await test("cutover.md's redirect map: every code row is a row of the doc", () => {
  const docRows = new Set(CUTOVER_EXPLICIT_ROWS.map(([from]) => from.replace(/\/$/, "")));
  assert.deepEqual(
    Object.keys(EXPLICIT_ROWS).filter((from) => !docRows.has(from)),
    [],
  );
});

await test("cutover.md's redirect map: every target is a real page, every anchor is on it, and nothing chains", () => {
  const broken = [];
  for (const [from, target] of [...CUTOVER_EXPLICIT_ROWS, ...CUTOVER_PATTERN_EXAMPLES]) {
    if (target === null || target === GONE) continue;
    const path = targetPath(target);
    // /writing/:slug is a route; the example slug stands for any post.
    const routed = STATIC_ROUTES.has(path) || /^\/writing\/[^/]+$/.test(path);
    if (!routed) broken.push(`${from}: ${path} is not a route`);
    if (target.includes("#") && !anchorExists(target))
      broken.push(`${from}: ${target} has no such anchor`);
    if (apexAnswer(path) !== null) broken.push(`${from}: ${path} redirects again`);
  }
  assert.deepEqual(broken, []);
});
