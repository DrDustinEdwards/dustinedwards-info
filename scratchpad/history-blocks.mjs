// Ruling 115, commit 1: extract every comment block in the 32 tracked sheets
// for classification. katex.generated.css is derived from katex-overrides.css
// and scripts/build-katex.mjs, so it is measured but never tagged; its
// override half is tagged at its source.
// Usage: node scratchpad/history-blocks.mjs  -> scratchpad/history-blocks.json, .txt
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks, commentProse } from "../scripts/lib/design-sheets.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GENERATED = "app/styles/katex.generated.css";

export function trackedSheets() {
  const out = execFileSync("git", ["ls-files", "*.css"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (out.length !== 32) throw new Error(`expected 32 tracked sheets, found ${out.length}`);
  return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("history-blocks.mjs")) {
  const rows = [];
  for (const sheet of trackedSheets()) {
    if (sheet === GENERATED) continue;
    const css = readFileSync(join(REPO, sheet), "utf8");
    commentBlocks(css).forEach(({ text, line }, pos) => {
      rows.push({ id: rows.length, sheet, pos, line, bytes: Buffer.byteLength(text), lines: text.split("\n").length, prose: commentProse(text) });
    });
  }
  writeFileSync(join(REPO, "scratchpad/history-blocks.json"), JSON.stringify(rows, null, 1));
  writeFileSync(
    join(REPO, "scratchpad/history-blocks.txt"),
    rows.map((r) => `### ${r.id}\t${r.sheet}:${r.line}\t${r.bytes}b ${r.lines}L\n${r.prose}\n`).join("\n"),
  );
  const big = rows.filter((r) => r.lines > 3).length;
  console.log(`blocks: ${rows.length}, over 3 lines: ${big}, bytes: ${rows.reduce((a, r) => a + r.bytes, 0)}`);
}
