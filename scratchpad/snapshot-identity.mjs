// IS THE PRISTINE SNAPSHOT THE BASE IT CLAIMS TO BE?
//
// Every mode of `code-history-apply.mjs` reads the snapshot rather than the working tree, so a
// committed proof only reproduces if those bytes are the base commit's. Nothing else checks it:
// `prove` compares the working tree TO the snapshot, which agrees with itself whatever the
// snapshot holds. The control flips one byte, because a comparison that cannot discriminate
// agrees with everything (hard rule 12).
//
//   WAVE=4 node scratchpad/snapshot-identity.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BEFORE, FILES, flat } from "./wave.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE_REF ?? "origin/main";
const show = (f) => execFileSync("git", ["-C", REPO, "show", `${BASE}:${f}`], { maxBuffer: 32e6 });

let bad = 0;
for (const file of FILES) {
  const fromGit = show(file);
  const onDisk = readFileSync(join(BEFORE, flat(file)));
  if (fromGit.equals(onDisk)) continue;
  bad += 1;
  console.log(`MISMATCH ${file}  ${BASE} ${fromGit.length}b  snapshot ${onDisk.length}b`);
}
console.log(`snapshot vs ${BASE}: ${FILES.length} files, ${bad} mismatch(es)`);

const probe = Buffer.from(readFileSync(join(BEFORE, flat(FILES[0]))));
const at = probe.indexOf(0x61);
probe[at] = 0x62;
console.log(`control (byte ${at} flipped) differs: ${!probe.equals(show(FILES[0]))}`);
process.exit(bad ? 1 : 0);
