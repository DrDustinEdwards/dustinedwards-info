/**
 * Mints a SMOKE_TOKEN. Prints it once, on stdout, and outputs nothing else.
 *
 *   node scripts/mint-smoke-token.mjs
 *
 * ## WHY IT IS SILENT
 *
 * One line on stdout and nothing else, so the output is a VALUE rather than a
 * transcript. That makes every safe way of handling it a one-liner and every
 * unsafe one harder:
 *
 *   node scripts/mint-smoke-token.mjs > .smoke-token
 *   node scripts/mint-smoke-token.mjs | npx wrangler secret put SMOKE_TOKEN
 *   node scripts/mint-smoke-token.mjs | gh secret set SMOKE_TOKEN
 *
 * A banner, a label, or a "copy this into wrangler" instruction would land in
 * the file or the secret alongside the token and produce a credential that is
 * silently wrong. The instructions live in README.md and RECOVERY.md, where
 * they can be read without being executed.
 *
 * **IT NEVER TOUCHES A COMMAND LINE AND NEVER TOUCHES A LOG.** The token is not
 * an argument to anything, so it cannot appear in a process listing or a shell
 * history; `wrangler secret put` and `gh secret set` both read stdin.
 *
 * ## THE SIZE
 *
 * 48 random bytes, base64url, which is 64 characters. The Worker's floor is 32
 * and this is deliberately well clear of it: the floor exists to catch a
 * misconfiguration, not to describe a sensible secret.
 *
 * `randomBytes` is the CSPRNG. `Math.random` is not one, and the distinction is
 * the whole value of this file.
 */

import { randomBytes } from "node:crypto";

process.stdout.write(`${randomBytes(48).toString("base64url")}\n`);
