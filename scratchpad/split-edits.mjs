// A chunk spans several files and retighten.mjs takes one file key, so the edit tables are
// written as one object keyed by a short tag and split here. Keeps one JSON per chunk instead
// of one per file, which is what made the earlier batches easy to lose track of.
//
//   node scratchpad/split-edits.mjs <edits.json> <tag>   prints the file for that tag
import { readFileSync, writeFileSync } from "node:fs";

const [path, tag] = process.argv.slice(2);
const all = JSON.parse(readFileSync(path, "utf8"));
if (!(tag in all)) {
  console.error(`no "${tag}" in ${path}; have ${Object.keys(all).join(", ")}`);
  process.exit(1);
}
const out = path.replace(/\.json$/, `.${tag}.json`);
writeFileSync(out, JSON.stringify(all[tag]), "utf8");
console.log(out);
