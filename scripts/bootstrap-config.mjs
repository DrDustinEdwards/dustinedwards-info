// Bootstrap the local wrangler configs so a fresh clone can install and typecheck.
//
// The real wrangler.jsonc is gitignored portfolio-wide (capsid/conventions.md:
// real config never in git, commit a wrangler.jsonc.example with placeholder
// ids). That leaves a fresh clone with no config at all, and `wrangler types`
// is the first thing postinstall runs, so `npm install` itself fails before the
// tree is usable. Measured 2026-07-27: exit 127, "No config file detected".
//
// This copies each committed example into place once. It NEVER overwrites: if
// the destination already exists it exits silently for that pair and prints
// nothing, so a real config carrying live values survives any number of
// reinstalls. The existsSync check and COPYFILE_EXCL both guard that, so a file
// appearing between the check and the copy still cannot be clobbered.
//
// The copied files carry placeholder values. That is enough for
// `wrangler types` to generate worker-configuration.d.ts, since typegen reads
// binding names and types and ignores the values. It is NOT enough to deploy or
// to run against real resources. Fill in the real values for that.
//
// TWO PAIRS SINCE 2026-08-29, and this is a LOOP rather than a second copy of
// the same twenty lines. The watchdog Worker has its own config for the same
// portfolio reason the site's has one: it carries a value that must not be in
// git. A missing example is fatal for EITHER pair, because a clone that
// silently ends up without one of them fails later and further from the cause.

import { constants, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every gitignored config and the tracked example it is bootstrapped from.
 *
 * The `what` string is what a reader is told to fill in, per pair, because
 * "placeholder resource ids" is wrong advice for the watchdog: its placeholder
 * is an inbox address and there are no ids in it at all.
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
    // Narrowed rather than asserted: under checkJs a catch binding is `unknown`,
    // and COPYFILE_EXCL failing with EEXIST is the expected path when the config
    // already exists.
    if (err instanceof Error && /** @type {NodeJS.ErrnoException} */ (err).code === "EEXIST") {
      continue;
    }
    throw err;
  }
}
