// The counter and the repo root every check:headers module shares.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createTally } from "../tally.mjs";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const tally = createTally({ separator: ": " });
export const { ok, eq } = tally;
