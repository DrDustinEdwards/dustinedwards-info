// Wave 1's own header and body split, so wave 2's overshoot can be attributed rather than
// asserted. The comparison only means something if both are measured the same way.
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
for (const dir of ["code-decisions", "code-decisions-wave2"]) {
  const d = {};
  for (const n of readdirSync(join(HERE, dir)).filter((x) => x.endsWith(".mjs")).sort()) {
    Object.assign(d, (await import(pathToFileURL(join(HERE, dir, n)).href)).default);
  }
  let hn = 0, hb = 0, bn = 0, bb = 0;
  for (const [k, v] of Object.entries(d)) {
    if (v.length !== 3 || typeof v[2] !== "string") continue;
    const n = Buffer.byteLength(v[2]);
    if (k.endsWith("#0")) { hn += 1; hb += n; } else { bn += 1; bb += n; }
  }
  console.log(`${dir}: headers ${hn} ${hb}b (${Math.round(hb / hn)} each) | bodies ${bn} ${bb}b (${Math.round(bb / bn)} each)`);
}
