// Restore the sheets from scratchpad/before/, apply the rewrites, regenerate
// the guidelines, run the proofs. Safe to run repeatedly: every run starts from
// the pristine sheets, so rewrites never compound.
import { copyFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { readSheets } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
for (const s of readSheets(REPO)) copyFileSync(join(HERE, "before", basename(s)), join(REPO, s));

const run = (args) => execFileSync(process.execPath, args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
process.stdout.write(run(["scratchpad/apply-plain.mjs"]));
run([".design-sync/build-inputs.mjs"]);
run(["scripts/build-guidelines.mjs"]);
try {
  process.stdout.write(run(["scratchpad/plain-proofs.mjs"]));
} catch (e) {
  process.stdout.write(e.stdout ?? "");
  process.exitCode = 1;
}
