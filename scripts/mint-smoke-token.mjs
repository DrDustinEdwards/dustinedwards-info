// Only the token goes to stdout: any banner would land in the secret alongside it.

import { randomBytes } from "node:crypto";

process.stdout.write(`${randomBytes(48).toString("base64url")}\n`);
