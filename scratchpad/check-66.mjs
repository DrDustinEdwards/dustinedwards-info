// Which of the generator's 66 classified blocks does the merged TSV touch?
// If a CUT or POINTER lands on one of them, the 66-block assertion moves and
// the job says that is a failure. Established BEFORE any byte is removed.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets, commentBlocks, commentProse } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

// Mirror of build-guidelines.mjs's classifier inputs. Kept in step by reading
// the same source rather than by retyping: the needles live there.
const src = readFileSync(join(REPO, "scripts/build-guidelines.mjs"), "utf8");
const MIN = Number(src.match(/MINIMUM_PROSE_BYTES = (\d+)/)[1]);

const fileBlocks = src.match(/const FILES = \[([\s\S]*?)\n\];/)[1];
const needleGroups = [...fileBlocks.matchAll(/needles: \[([\s\S]*?)\]/g)].map((m) =>
  [...m[1].matchAll(/\/((?:[^/\\]|\\.)+)\/([a-z]*)/g)].map((n) => new RegExp(n[1], n[2])),
);
const buildNeedles = [...src.matchAll(/const BUILD_NEEDLES = \[([\s\S]*?)\n\];/g)][0][1];
const BUILD = [...buildNeedles.matchAll(/\/((?:[^/\\]|\\.)+)\/([a-z]*)/g)].map((n) => new RegExp(n[1], n[2]));

const hits = (prose, needles) => needles.reduce((n, rx) => n + (rx.test(prose) ? 1 : 0), 0);

const classified = [];
for (const sheet of readSheets(REPO)) {
  const css = readFileSync(join(REPO, sheet), "utf8");
  for (const { text, line } of commentBlocks(css)) {
    const prose = commentProse(text);
    if (prose.length < MIN) continue;
    let score = 0, matched = false;
    for (const group of needleGroups) {
      const n = hits(prose, group);
      if (n > 0) { score = n; matched = true; break; }
    }
    if (!matched) continue;
    if (hits(prose, BUILD) > 0 && score < 2) continue;
    classified.push(`${sheet}:${line}`);
  }
}

const merged = new Map();
for (const line of readFileSync(join(HERE, "comment-tags.merged.tsv"), "utf8").split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const [sheet, ln, , tag] = line.split("\t");
  merged.set(`${sheet}:${ln}`, tag);
}

console.log(`generator classifies: ${classified.length}`);
const touched = classified.filter((k) => merged.get(k) !== "KEEP");
console.log(`of those, tagged something other than KEEP: ${touched.length}`);
for (const k of touched) console.log(`  ${merged.get(k).padEnd(8)} ${k}`);
