/** Before a check run: build the products the gates read, and reap what the previous run left behind. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { killTree, readProcessTable, recordedTreeLeftovers } from "./child-processes.mjs";
import { treeSince } from "./rss.mjs";
import { root, runGate } from "./gate-run.mjs";

/** Read before truncation: after an OS kill the previous run's samples are its only record. */
export const RSS_FILE = join(root, ".gate-pids", "check-all-rss.csv");

/**
 * The runner that owned the recorded tree, from the marker line written at truncation.
 * @returns {number | null}
 */
function recordedRunner() {
  try {
    const m = /^# runner (\d+)$/m.exec(readFileSync(RSS_FILE, "utf8"));
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * The build products the gates read, in order. A failed one is refused here, before any gate reads
 * it: a broken build is not a red gate.
 * @type {Array<{ name: string, what: string, missing: string }>}
 */
const PREREQS = [
  /* Built first: `build:content` reads stack.json. */
  {
    name: "build:stack",
    what: "the colophon artifact build:content reads",
    missing:
      "build:stack failed, so content/generated/stack.json does not exist on disk. " +
      "Nothing below ran; fix the stack build first.",
  },
  {
    name: "build:content",
    what: "the local build product the tier reads",
    missing:
      "build:content failed, so the tier's subject does not exist on disk. " +
      "Nothing below ran; fix the build first.",
  },
];

export function buildPrereqs() {
  for (const prereq of PREREQS) {
    process.stdout.write(`  ${prereq.name} (${prereq.what}) ... `);
    const built = runGate(prereq.name, []);
    if (!built.ok) {
      console.log("FAILED");
      console.log(built.output.trimEnd());
      throw new Error(prereq.missing);
    }
    console.log(`ok (${(built.ms / 1000).toFixed(1)}s)`);
  }
}

/*
 * By pid and parentage, never by name: a name match for `node` or `chrome` reaches Dustin's own
 * editor and browser, and a pid alone may have been reused since it was recorded.
 */
export function reapOrphans() {
  const recorded = treeSince(RSS_FILE).filter((pid) => pid !== process.pid);
  if (recorded.length > 0) {
    /* One process table read: a `taskkill` per dead pid makes later gates fail to start. */
    const table = readProcessTable();
    const runner = recordedRunner();
    const runnerLive = runner === null ? undefined : table.get(runner);
    if (table.size === 0) {
      console.log(
        `  preflight: ${recorded.length} process(es) recorded by the previous run, but the process ` +
          "table could not be read, so none was killed on its pid alone\n",
      );
    } else if (runnerLive && runnerLive.command.includes("check-all.mjs")) {
      console.log(
        `  preflight: the run that recorded these (pid ${runner}) is still running, so its tree ` +
          "was left alone\n",
      );
    } else {
      const leftovers = recordedTreeLeftovers(recorded, table, runner);
      let reaped = 0;
      for (const pid of leftovers) if (killTree(pid)) reaped += 1;
      console.log(
        `  preflight: ${recorded.length} process(es) recorded by the previous run, ` +
          `${leftovers.length} still alive under that run's tree, ${reaped} reaped\n`,
      );
    }
  }
}
