// Runs `wrangler types` where no prompt can wait on a person. Since wrangler 4.135.0 it asks, on a terminal, whether to update
// Cloudflare skills; npm hides a lifecycle script's output, so during `npm install` the question is invisible and the install
// waits forever (found and fixed in Carrel, PR 18). Wrangler has no switch for that prompt: it is skipped only in CI or when
// stdin or stdout is not a terminal. So wrangler is started by node directly, with stdin detached, which behaves the same under
// cmd.exe, PowerShell and Linux CI. The postinstall, `typecheck` and `cf-typegen` all go through here.
//
// WRANGLER_ENTRY is only for scripts/check-postinstall.mjs, which stands a stub in for wrangler.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = process.env.WRANGLER_ENTRY ?? join(root, "node_modules", "wrangler", "bin", "wrangler.js");

const result = spawnSync(process.execPath, [wrangler, "types", ...process.argv.slice(2)], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
