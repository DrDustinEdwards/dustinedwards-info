// Bootstrap the local wrangler configs so a fresh clone can install and typecheck.
//
// The real configs are gitignored portfolio-wide, which leaves a fresh clone with no config at
// all, and typegen is the first thing postinstall runs, so `npm install` itself fails before the
// tree is usable.
//
// This copies each committed example into place once. It NEVER overwrites: the existence check and
// the exclusive copy flag both guard that, so a file appearing between the two still cannot be
// clobbered and a real config carrying live values survives any number of reinstalls.
//
// The copied files carry placeholder values, which is enough for typegen, since that reads binding
// names and types and ignores the values. It is NOT enough to deploy or to run against real
// resources.
//
// TWO PAIRS, AND THIS IS A LOOP rather than a second copy of the same twenty lines. A missing
// example is fatal for EITHER pair, because a clone that silently ends up without one fails later
// and further from the cause.

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
