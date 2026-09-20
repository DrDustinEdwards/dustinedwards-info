// Where the surviving bytes actually are: rewritten prose, blocks kept byte-identical by a
// two-element decision, and blocks the tooling classifies itself. Only the first is editable, so
// the other two set the floor the tail pass is aiming at.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { WAVE1 } from "./code-wave1.mjs";
import { WAVE2 } from "./code-wave2.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");

function renderer(src) {
  const leadOf = (b) => src.slice(src.lastIndexOf("\n", b.start - 1) + 1, b.start).match(/^[ \t]*/)[0];
  return (b, repl) => {
    const lead = leadOf(b);
    const lines = repl.split("\n");
    if (b.kind === "line") return lines.map((l, i) => `${i === 0 ? "" : lead}//${l ? " " + l : ""}`).join("\n");
    const open = b.text.startsWith("/**") ? "/**" : "/*";
    if (lines.length === 1) return `${open} ${lines[0]} */`;
    return [open, ...lines.map((l) => `${lead} *${l ? " " + l : ""}`), `${lead} */`].join("\n");
  };
}

async function run(label, files, decDir, beforeDir) {
  const d = {};
  for (const n of readdirSync(join(HERE, decDir)).filter((n) => n.endsWith(".mjs")).sort()) {
    Object.assign(d, (await import(pathToFileURL(join(HERE, decDir, n)).href)).default);
  }
  const t = { prose: 0, kept: 0, auto: 0, del: 0, nProse: 0, nKept: 0, nAuto: 0, nDel: 0, before: 0, blocks: 0 };
  for (const f of files) {
    const p = join(HERE, beforeDir, flat(f));
    if (!existsSync(p)) continue;
    const src = readFileSync(p, "utf8");
    const render = renderer(src);
    commentBlocks(src).forEach((b, id) => {
      const dec = d[`${f}#${id}`];
      t.blocks += 1;
      t.before += Buffer.byteLength(b.text);
      if (!dec) { t.auto += Buffer.byteLength(b.text); t.nAuto += 1; return; }
      if (dec.length === 2) { t.kept += Buffer.byteLength(b.text); t.nKept += 1; return; }
      if (dec[2] === null) { t.nDel += 1; return; }
      t.prose += Buffer.byteLength(render({ ...b, id }, dec[2]));
      t.nProse += 1;
    });
  }
  const after = t.prose + t.kept + t.auto;
  console.log(
    `${label}: ${t.blocks} blocks ${t.before}b -> ${after}b (${((100 * after) / t.before).toFixed(1)}%)\n` +
      `   prose ${t.nProse} blocks ${t.prose}b | kept ${t.nKept} blocks ${t.kept}b | auto ${t.nAuto} blocks ${t.auto}b | deleted ${t.nDel}`,
  );
}

await run("wave 1", WAVE1, "code-decisions", "code-history-before");
await run("wave 2", WAVE2, "code-decisions-wave2", "code-history-before-wave2");
