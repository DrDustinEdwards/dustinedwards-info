// Points the chunk tools at wave.mjs instead of at wave 2's literals. One-shot, kept because it
// records WHICH literals each tool carried, which is the list a seventh tool would have to match.
import { readFileSync, writeFileSync } from "node:fs";

const FLAT_DECL = 'const flat = (s) => s.replace(/\\//g, "__");\n';

const edits = {
  "dump-compact.mjs": [
    ['import { CHUNKS } from "./code-wave2.mjs";', 'import { CHUNKS, BEFORE, flat } from "./wave.mjs";'],
    ['join(HERE, "code-history-before-wave2", flat(file))', "join(BEFORE, flat(file))"],
  ],
  "worklist.mjs": [
    ['import { CHUNKS } from "./code-wave2.mjs";', 'import { CHUNKS, BEFORE, DECISIONS, flat } from "./wave.mjs";'],
    ['join(HERE, "code-decisions-wave2", `${chunk}.mjs`)', "join(DECISIONS, `${chunk}.mjs`)"],
    ['join(HERE, "code-history-before-wave2", flat(file))', "join(BEFORE, flat(file))"],
  ],
  "recut-all.mjs": [
    ['import { WAVE2 } from "./code-wave2.mjs";', 'import { FILES, BEFORE, DECISIONS, flat } from "./wave.mjs";'],
    ['const DIR = join(HERE, "code-decisions-wave2");', "const DIR = DECISIONS;"],
    ["for (const file of WAVE2) {", "for (const file of FILES) {"],
    ['join(HERE, "code-history-before-wave2", flat(file))', "join(BEFORE, flat(file))"],
  ],
  "raw-strip.mjs": [
    ['import { WAVE2 } from "./code-wave2.mjs";', 'import { FILES } from "./wave.mjs";'],
    ["for (const file of WAVE2) {", "for (const file of FILES) {"],
    ["${only ? 1 : WAVE2.length}", "${only ? 1 : FILES.length}"],
  ],
  "headers.mjs": [
    ['import { WAVE2 } from "./code-wave2.mjs";', 'import { FILES, BEFORE, DECISIONS, flat } from "./wave.mjs";'],
    ['readdirSync(join(HERE, "code-decisions-wave2"))', "readdirSync(DECISIONS)"],
    ['join(HERE, "code-decisions-wave2", n)', "join(DECISIONS, n)"],
    ["const keys = WAVE2.map(", "const keys = FILES.map("],
    ['join(HERE, "code-history-before-wave2", flat(file))', "join(BEFORE, flat(file))"],
  ],
};

for (const [file, pairs] of Object.entries(edits)) {
  let s = readFileSync(file, "utf8");
  const missed = [];
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      missed.push(from.slice(0, 50));
      continue;
    }
    s = s.split(from).join(to);
  }
  if (s.includes(FLAT_DECL)) s = s.split(FLAT_DECL).join("");
  writeFileSync(file, s, "utf8");
  console.log(missed.length ? `${file}: MISSED ${missed.join(" | ")}` : `${file}: patched`);
}
