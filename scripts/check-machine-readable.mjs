console.log("\ncheck:machine-readable");

const PARTS = ["llms", "microformats", "publications"];

let checks = 0;
/** @type {string[]} */
const failed = [];

for (const part of PARTS) {
  try {
    const { outcome } = await import(`./machine-readable/${part}.mjs`);
    // Counts, or the part did not report: an undefined count made the total NaN and the part a pass.
    if (!Number.isInteger(outcome?.checks) || !Number.isInteger(outcome?.failures)) {
      failed.push(`${part}: reported no outcome counts (${JSON.stringify(outcome)})`);
      continue;
    }
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
