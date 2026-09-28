// The entry point and the one gate. It builds the context every section reads and runs the sections
// in scripts/lib/features/ in order; each section owns its own assertions and floors.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readArtifact } from "./lib/artifact.mjs";
import {
  checkAnchors,
  declaredGates,
  declaredRouteModules,
  reportAnchors,
} from "./lib/features/anchors.mjs";
import { checkColophon } from "./lib/features/colophon.mjs";
import { checkEnhancements } from "./lib/features/enhancements.mjs";
import { checkProjects } from "./lib/features/projects.mjs";
import { checkFeatureProse } from "./lib/features/prose-numbers.mjs";
import { root } from "./lib/features/shared.mjs";
import { createTally } from "./lib/tally.mjs";

const FEATURES_PATH = join(root, "content", "features.json");

const tally = createTally({ separator: ": " });
const { ok } = tally;

console.log("\ncheck:features\n");

if (!existsSync(FEATURES_PATH)) {
  console.log("  FAIL  content/features.json is missing.\n");
  process.exit(1);
}

const features = JSON.parse(readFileSync(FEATURES_PATH, "utf8")).features ?? [];

const artifact = readArtifact();
const artifactRecords = artifact.records ?? [];
const routeModules = await declaredRouteModules();

/** @type {import("./lib/features/shared.mjs").FeaturesContext} */
const ctx = {
  tally,
  ok,
  features,
  routeModules,
  routes: new Set(routeModules.keys()),
  gates: declaredGates(),
  artifactRecords,
  /** PUBLISHED only: a draft citation would link the live site to a 404. */
  publishedTitles: new Map(
    (artifact.posts ?? [])
      .filter((/** @type {any} */ p) => p.draft !== true)
      .map((/** @type {any} */ p) => [p.slug, p.title]),
  ),
  stack: JSON.parse(readFileSync(join(root, "content", "generated", "stack.json"), "utf8")),
};

const anchors = checkAnchors(ctx);
checkFeatureProse(ctx);
checkColophon(ctx);
await checkEnhancements(ctx);
reportAnchors(ctx, anchors);
checkProjects(ctx);

/* Whole-gate floor: section floors cannot see another section stopping. */
/* Re-measure by running the gate. */
/*
 * 848 on 2026-09-28, when the playground section went with /playground: measured 1219 before and 893
 * after (the section's 319 plus 7 elsewhere), and the floor sits max(3, ceil(893 * 0.05)) = 45 under
 * the measured run, as check:browser's floors do.
 */
const MINIMUM_CHECKS = 848;
tally.floor("check:features", "checks", MINIMUM_CHECKS, "A SECTION was skipped rather than failing.");

console.log(`\n${tally.checks} checks, ${tally.failures} failures\n`);
process.exit(tally.failures > 0 ? 1 : 0);
