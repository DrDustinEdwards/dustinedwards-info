// Bootstrap a local wrangler.jsonc so a fresh clone can install and typecheck.
//
// The real wrangler.jsonc is gitignored portfolio-wide (capsid/conventions.md:
// real config never in git, commit a wrangler.jsonc.example with placeholder
// ids). That leaves a fresh clone with no config at all, and `wrangler types`
// is the first thing postinstall runs, so `npm install` itself fails before the
// tree is usable. Measured 2026-07-27: exit 127, "No config file detected".
//
// This copies the committed example into place once. It NEVER overwrites: if
// wrangler.jsonc already exists it exits silently and prints nothing, so a real
// config carrying live resource ids survives any number of reinstalls. The
// existsSync check and COPYFILE_EXCL both guard that, so a file appearing
// between the check and the copy still cannot be clobbered.
//
// The copied file carries placeholder ids. That is enough for `wrangler types`
// to generate worker-configuration.d.ts, since typegen reads binding names and
// types and ignores the values. It is NOT enough to deploy or to run against
// real resources. Fill in the real ids for that.

import { constants, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "wrangler.jsonc");
const src = join(root, "wrangler.jsonc.example");

if (existsSync(dest)) process.exit(0);

if (!existsSync(src)) {
  console.error(
    "bootstrap-config: wrangler.jsonc.example is missing, so wrangler.jsonc cannot be bootstrapped.",
  );
  process.exit(1);
}

try {
  copyFileSync(src, dest, constants.COPYFILE_EXCL);
  console.log(
    "bootstrap-config: created wrangler.jsonc from wrangler.jsonc.example. It carries placeholder resource ids, so fill them in before deploying or running against real resources.",
  );
} catch (err) {
  // Narrowed rather than asserted: under checkJs a catch binding is `unknown`,
  // and COPYFILE_EXCL failing with EEXIST is the expected path when the config
  // already exists.
  if (err instanceof Error && /** @type {NodeJS.ErrnoException} */ (err).code === "EEXIST") {
    process.exit(0);
  }
  throw err;
}
