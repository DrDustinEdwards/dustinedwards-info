// Extract every comment block in the 22 synced sheets, for tagging.
// Emits a TSV skeleton plus a readable dump, so the tagging is done against
// the prose rather than against a summary of it.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets, commentBlocks, commentProse } from "../scripts/lib/design-sheets.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const sheets = readSheets(REPO);

const rows = [];
for (const sheet of sheets) {
  const css = readFileSync(join(REPO, sheet), "utf8");
  for (const { text, line } of commentBlocks(css)) {
    rows.push({
      sheet,
      line,
      bytes: text.length,
      prose: commentProse(text),
      first: commentProse(text).split("\n").find((l) => l.trim()) ?? "",
    });
  }
}

console.log(`blocks: ${rows.length} across ${sheets.length} sheets`);

// Size bands, to see how much is decorative versus substantial.
const bands = { "<80": 0, "80-200": 0, "200-600": 0, "600-2000": 0, ">2000": 0 };
for (const r of rows) {
  if (r.bytes < 80) bands["<80"]++;
  else if (r.bytes < 200) bands["80-200"]++;
  else if (r.bytes < 600) bands["200-600"]++;
  else if (r.bytes < 2000) bands["600-2000"]++;
  else bands[">2000"]++;
}
console.log("size bands:", JSON.stringify(bands));

writeFileSync(
  join(REPO, "scratchpad/blocks.json"),
  JSON.stringify(rows, null, 1),
);

// Readable dump, one block per record, for the actual reading pass.
const dump = rows
  .map((r, i) => `### ${i}\t${r.sheet}:${r.line}\t${r.bytes}b\n${r.prose}\n`)
  .join("\n");
writeFileSync(join(REPO, "scratchpad/blocks.txt"), dump);
console.log(`wrote scratchpad/blocks.json and blocks.txt (${(dump.length / 1024).toFixed(1)} KB)`);
