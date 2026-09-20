// Ruling 115, wave 1: rank tracked code files by comment bytes, and prove the
// span recovery in code-blocks.mjs agrees with the gates' stripComments.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { stripComments } from "../scripts/lib/strip-comments.mjs";
import { commentSpans, commentBlocks } from "./code-blocks.mjs";

const files = execFileSync("git", ["ls-files", "app", "workers", "scripts"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => /^app\/.*\.tsx?$/.test(f) || /^workers\/.*\.ts$/.test(f) || /^scripts\/.*\.mjs$/.test(f));
let mismatch = 0;
const rows = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  let rebuilt = "";
  let at = 0;
  for (const s of commentSpans(src)) { rebuilt += src.slice(at, s.start) + " "; at = s.end; }
  rebuilt += src.slice(at);
  if (rebuilt !== stripComments(src)) { mismatch += 1; console.error("span mismatch:", f); }
  const blocks = commentBlocks(src);
  const cb = blocks.reduce((a, b) => a + Buffer.byteLength(b.text), 0);
  rows.push({ f, bytes: Buffer.byteLength(src), cb, n: blocks.length });
}
rows.sort((a, b) => b.cb - a.cb);
const total = rows.reduce((a, r) => a + r.cb, 0);
console.log(`files ${rows.length}, span mismatches ${mismatch}, comment bytes ${total}`);
for (const r of rows.slice(0, Number(process.argv[2] ?? 12))) {
  console.log([r.cb, r.bytes, ((100 * r.cb) / r.bytes).toFixed(1) + "%", r.n, r.f].join("\t"));
}
