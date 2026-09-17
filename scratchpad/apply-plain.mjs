// Apply scratchpad/plain-rewrites.mjs to the sheets.
//
// A rewrite is keyed "sheet#ordinal", the block's position among all comment
// blocks in that sheet. Before replacing, the block's current text must equal
// the KEEP inventory's text, so a rewrite can never land on the wrong block and
// running this twice is refused rather than compounding.
//
// Formatting follows the block being replaced:
//   trailing a declaration on the same line  -> one line, kept inline
//   was one line and the new text is one line -> one line
//   otherwise                                  -> "/* first\n<indent>   rest */"
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets } from "../scripts/lib/design-sheets.mjs";
import { REWRITES } from "./plain-rewrites.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const inventory = JSON.parse(readFileSync(join(HERE, "keep-inventory.json"), "utf8"));
const known = new Map(inventory.map((b) => [`${b.sheet}#${b.ordinal}`, b.text]));

for (const key of Object.keys(REWRITES)) {
  if (!known.has(key)) throw new Error(`rewrite ${key} names no KEEP block`);
}

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let applied = 0;
for (const sheet of readSheets(REPO)) {
  const abs = join(REPO, sheet);
  let css = readFileSync(abs, "utf8");
  const rx = /\/\*[\s\S]*?\*\//g;
  const found = [];
  let m;
  while ((m = rx.exec(css)) !== null) found.push({ start: m.index, end: m.index + m[0].length, text: m[0] });

  for (let ordinal = found.length - 1; ordinal >= 0; ordinal--) {
    const key = `${sheet}#${ordinal}`;
    const next = REWRITES[key];
    if (next === undefined) continue;
    const f = found[ordinal];
    if (f.text !== known.get(key)) throw new Error(`${key}: current text is not the inventory text; refusing`);
    const body = next.trim();
    if (body.includes(EM) || body.includes(EN)) throw new Error(`${key}: dash in rewrite`);
    if (body.includes("*/")) throw new Error(`${key}: rewrite closes the comment early`);

    const lineStart = css.lastIndexOf("\n", f.start - 1) + 1;
    const prefix = css.slice(lineStart, f.start);
    const inline = prefix.trim() !== "";
    const indent = prefix.match(/^\s*/)[0];
    // A line starting with two spaces is a TABLE ROW: kept verbatim, never
    // wrapped or trimmed, so its column alignment survives.
    const paragraphs = next.replace(/^\n+|\s+$/g, "").split("\n").map((l) => (/^  /.test(l) ? l.trimEnd() : l.trim()));

    let out;
    if (inline) {
      if (paragraphs.length !== 1) throw new Error(`${key}: inline comment must stay one line`);
      out = `/* ${paragraphs[0]} */`;
    } else {
      // Wrap to the width the sheets already use, measured from the indent.
      const width = Math.max(40, 78 - indent.length - 3);
      const lines = [];
      for (const p of paragraphs) {
        if (!p) { lines.push(""); continue; }
        if (/^  /.test(p) || /-{5,}/.test(p)) { lines.push(p); continue; }
        let cur = "";
        for (const word of p.split(/\s+/)) {
          if (cur && (cur + " " + word).length > width) { lines.push(cur); cur = word; }
          else cur = cur ? `${cur} ${word}` : word;
        }
        if (cur) lines.push(cur);
      }
      if (lines.length === 1 && !f.text.includes("\n") && lines[0].length <= width) {
        out = `/* ${lines[0]} */`;
      } else {
        out = `/* ${lines[0]}` + lines.slice(1).map((l) => `\n${indent}${l ? "   " + l : ""}`).join("") + " */";
      }
    }
    css = css.slice(0, f.start) + out + css.slice(f.end);
    applied += 1;
  }
  writeFileSync(abs, css);
}
console.log(`applied ${applied} of ${Object.keys(REWRITES).length} rewrites`);
