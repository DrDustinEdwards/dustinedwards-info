// Copies each example into place once and never overwrites, so a real config carrying live values
// survives any number of reinstalls.

import { constants, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {ReadonlyArray<{ dest: string, src: string, what: string }>} */
const PAIRS = [
  {
    dest: "wrangler.jsonc",
    src: "wrangler.jsonc.example",
    what: "placeholder resource ids",
  },
  {
    dest: "wrangler.watchdog.jsonc",
    src: "wrangler.watchdog.jsonc.example",
    what: "a placeholder ALERT_EMAIL on the reserved example.com domain",
  },
];

for (const { dest, src, what } of PAIRS) {
  const destPath = join(root, dest);
  const srcPath = join(root, src);

  if (existsSync(destPath)) continue;

  if (!existsSync(srcPath)) {
    console.error(`bootstrap-config: ${src} is missing, so ${dest} cannot be bootstrapped.`);
    process.exit(1);
  }

  try {
    copyFileSync(srcPath, destPath, constants.COPYFILE_EXCL);
    console.log(
      `bootstrap-config: created ${dest} from ${src}. It carries ${what}, so fill that in before deploying or running against real resources.`,
    );
  } catch (err) {
    if (err instanceof Error && /** @type {NodeJS.ErrnoException} */ (err).code === "EEXIST") {
      continue;
    }
    throw err;
  }
}
