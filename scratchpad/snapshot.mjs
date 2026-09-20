// Snapshot the sheets and their byte counts, before or after the cut.
// Usage: node scratchpad/snapshot.mjs before|after
import { copyFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const which = process.argv[2];
if (which !== "before" && which !== "after") {
  console.error("usage: snapshot.mjs before|after");
  process.exit(2);
}

const dir = join(HERE, which);
mkdirSync(dir, { recursive: true });

const sheets = readSheets(REPO);
const bytes = {};
let total = 0;
for (const s of sheets) {
  const n = statSync(join(REPO, s)).size;
  bytes[s] = n;
  total += n;
  copyFileSync(join(REPO, s), join(dir, basename(s)));
}
writeFileSync(join(dir, "bytes.json"), JSON.stringify(bytes, null, 1));
console.log(`${which}: ${sheets.length} sheets, ${total} bytes (${(total / 1024).toFixed(1)} KB)`);
