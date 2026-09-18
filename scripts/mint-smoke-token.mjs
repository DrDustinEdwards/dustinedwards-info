/**
 * Mints a SMOKE_TOKEN. Prints it once, on stdout, and outputs nothing else.
 *
 *   node scripts/mint-smoke-token.mjs
 *
 * WHY IT IS SILENT: one line on stdout makes the output a VALUE rather than a transcript, so every
 * safe way of handling it is a one-liner into a file or a secret store. A banner or a label would
 * land in the file alongside the token and produce a credential that is silently wrong; the
 * instructions live in the documents, where they can be read without being executed.
 *
 * **IT NEVER TOUCHES A COMMAND LINE AND NEVER TOUCHES A LOG.** The token is not an argument to
 * anything, so it cannot appear in a process listing or a shell history.
 *
 * THE SIZE is deliberately well clear of the Worker's floor, which exists to catch a
 * misconfiguration rather than to describe a sensible secret. `randomBytes` is the CSPRNG, and
 * that distinction is the whole value of this file.
 */

import { randomBytes } from "node:crypto";

process.stdout.write(`${randomBytes(48).toString("base64url")}\n`);
