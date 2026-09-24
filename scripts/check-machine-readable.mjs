/**
 * Gate: what machines read is complete and consistent. One check over three parts (ruling 150):
 *
 *   llms.txt       content/llms.txt is the source of the settings row and the route serves it
 *   microformats   the public pages parse to one h-entry, h-feed and h-card each
 *   publications   the paper corpus, its generated module, its twins and its exports agree
 *
 *   npm run check:machine-readable
 *   npm run check:machine-readable -- --local    also compare the llms.txt row in local D1
 *   npm run check:machine-readable -- --remote   the same against the deployed database
 *
 * Each part is a module whose top level runs on import and exports `outcome`. A part that cannot
 * reach its subject throws, which counts as a failure here, and the later parts still run.
 */

console.log("\ncheck:machine-readable");

const PARTS = ["llms", "microformats", "publications"];

let checks = 0;
/** @type {string[]} */
const failed = [];

for (const part of PARTS) {
  try {
    const { outcome } = await import(`./machine-readable/${part}.mjs`);
    checks += outcome.checks;
    if (outcome.checks === 0) failed.push(`${part}: asserted nothing`);
    else if (outcome.failures > 0) failed.push(`${part}: ${outcome.failures} failure(s)`);
  } catch (error) {
    failed.push(`${part}: stopped early, ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${checks} checks across ${PARTS.length} parts, ${failed.length} part(s) failed`);
for (const line of failed) console.log(`  FAIL  ${line}`);
console.log("");
process.exit(failed.length > 0 ? 1 : 0);
