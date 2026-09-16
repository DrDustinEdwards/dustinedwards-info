// Part C, measured rather than proposed: does conventions.md's token table
// still match what the built stylesheet DEFINES?
//
// Two sides:
//   claimed  -- every `--token` named in .design-sync/conventions.md
//   defined  -- every `--token:` declaration in the built ds-styles.css
//
// A claimed token with no definition is the failure NOTES.md warns about: the
// design agent is handed vocabulary that resolves to nothing. A defined token
// absent from the table is quieter: real vocabulary the canvas was never told
// about.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO = "C:/Users/email/dev/worktrees/slop-audit";

const conventions = readFileSync(join(REPO, ".design-sync/conventions.md"), "utf8");
const constraintsPath = join(REPO, ".design-sync/canvas-constraints.md");
const constraints = existsSync(constraintsPath) ? readFileSync(constraintsPath, "utf8") : "";

const bundlePath = join(REPO, ".design-sync/ds-styles.css");
if (!existsSync(bundlePath)) {
  console.error("FATAL: ds-styles.css absent. Run build-inputs.mjs first; an empty");
  console.error("scope would report a clean sweep.");
  process.exit(2);
}
const bundle = readFileSync(bundlePath, "utf8");

const names = (text) => new Set([...text.matchAll(/--[a-z0-9-]+/gi)].map((m) => m[0]));

// DEFINED means it appears on the left of a colon as a declaration, not merely
// read inside a var().
const defined = new Set(
  [...bundle.matchAll(/(^|[;{\s])(--[a-z0-9-]+)\s*:/gi)].map((m) => m[2]),
);
const readBack = new Set([...bundle.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]));

const claimedConventions = names(conventions);
const claimedConstraints = names(constraints);

if (defined.size === 0 || claimedConventions.size === 0) {
  console.error("FATAL: one side parsed empty; refusing to report a clean sweep.");
  process.exit(2);
}

const missing = [...claimedConventions].filter((t) => !defined.has(t)).sort();
const untold = [...defined].filter((t) => !claimedConventions.has(t)).sort();
const constraintsMissing = [...claimedConstraints].filter((t) => !defined.has(t)).sort();

console.log(`conventions.md names        ${claimedConventions.size} token(s)`);
console.log(`canvas-constraints.md names ${claimedConstraints.size} token(s)`);
console.log(`ds-styles.css DEFINES       ${defined.size} token(s)`);
console.log(`ds-styles.css READS         ${readBack.size} token(s)`);
console.log("");

console.log(`NAMED IN conventions.md BUT NOT DEFINED: ${missing.length}`);
for (const t of missing) {
  console.log(`  ${t}${readBack.has(t) ? "   (read by the sheets, never defined in the bundle)" : ""}`);
}
console.log("");
console.log(`NAMED IN canvas-constraints.md BUT NOT DEFINED: ${constraintsMissing.length}`);
for (const t of constraintsMissing) console.log(`  ${t}`);
console.log("");
console.log(`DEFINED BUT NOT IN conventions.md's table: ${untold.length}`);
console.log(`  ${untold.slice(0, 40).join(", ")}${untold.length > 40 ? ", ..." : ""}`);
