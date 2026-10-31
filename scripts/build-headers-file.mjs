// Writes public/_headers from the Worker's own set (workers/security-headers.mjs). `npm run build` and `npm run dev`
// run it first, so a deploy always ships the current set; the committed copy is what it last wrote.
import { writeFileSync } from "node:fs";

import { STATIC_HEADERS_FILE } from "../workers/security-headers.mjs";

writeFileSync(new URL("../public/_headers", import.meta.url), STATIC_HEADERS_FILE);
