// Bootstrap the local wrangler configs so a fresh clone can install and typecheck, the real ones
// being gitignored and typegen being the first thing postinstall runs.
//
//   node scripts/bootstrap-config.mjs
//
// BOUNDARY: it copies each committed example into place once and NEVER overwrites, so a real
// config carrying live values survives any number of reinstalls. The copies carry placeholders,
// which is enough for typegen and is NOT enough to deploy or to run against real resources.

import { constants, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every gitignored config and the tracked example it is bootstrapped from. The `what` string is
 * what a reader is told to fill in, per pair, because "placeholder resource ids" is wrong advice
 * for a config whose placeholder is an inbox address.
 *
 * @type {ReadonlyArray<{ dest: string, src: string, what: string }>}
 */
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
    // Narrowed rather than asserted: under checkJs a catch binding is `unknown`, and the exclusive
    // copy failing this way is the expected path when the config already exists.
    if (err instanceof Error && /** @type {NodeJS.ErrnoException} */ (err).code === "EEXIST") {
      continue;
    }
    throw err;
  }
}
