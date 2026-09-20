// Every counting gate's own numbers, captured rather than inferred.
//
// `check:floors` answers "is any floor breached", which is not the question a comment rewrite
// has to answer. That question is "did any gate's EXECUTED COUNT move", and the only honest way
// to answer it is to run the same gates against both trees and compare what they printed.
// check:floors itself cannot stand in: run standalone it insists on the whole offline tier,
// which here includes gates that need the network.
//
//   node scratchpad/gate-counts.mjs > before.txt
//
// Prints one sorted line per floor line and per "N checks" line, with nothing timing-dependent
// in it, so two runs diff to nothing when the counts are unchanged.
import { spawnSync } from "node:child_process";

const ONLY = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
const GATES = [
  "check:admin-ui", "check:charts", "check:content", "check:contrast", "check:d1-address",
  "check:design-sheets", "check:destructive", "check:diagrams", "check:features", "check:fonts",
  "check:headers", "check:hook-matchers", "check:hook-scope", "check:hook-syntax",
  "check:invariants", "check:llms", "check:logo", "check:media-axes", "check:microformats",
  "check:migrations", "check:policy", "check:publications", "check:search", "check:secrets",
  "check:slop", "check:stack", "check:tests", "check:urls",
];

const lines = [];
for (const gate of GATES.filter((g) => !ONLY || ONLY.has(g))) {
  const run = spawnSync(`npm run ${gate} --silent`, { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const text = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (/^floor \S+ executed=\d+ minimum=\d+$/.test(t)) lines.push(`${gate}\t${t}`);
    else if (/^\d+ checks?, \d+ failures?$/.test(t)) lines.push(`${gate}\t${t}`);
    else if (/^\d+ assertions?, \d+ failures?$/.test(t)) lines.push(`${gate}\t${t}`);
  }
  if (run.status !== 0) lines.push(`${gate}\tEXIT ${run.status}`);
}
for (const line of lines.sort()) console.log(line);
