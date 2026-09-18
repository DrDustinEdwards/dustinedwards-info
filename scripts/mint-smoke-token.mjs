/**
 * Mints a SMOKE_TOKEN. Prints it once, on stdout, and outputs nothing else.
 *
 *   node scripts/mint-smoke-token.mjs
 *
 * BOUNDARY: one line on stdout makes the output a VALUE rather than a transcript, so a banner
 * would land in the file or the secret alongside the token. **IT NEVER TOUCHES A COMMAND LINE AND
 * NEVER TOUCHES A LOG**, so it cannot appear in a process listing or a shell history.
 */

import { randomBytes } from "node:crypto";

process.stdout.write(`${randomBytes(48).toString("base64url")}\n`);
