#!/usr/bin/env node
/**
 * THE ONE WAY A SESSION MERGES ITS OWN PR (ruling 148): `node scripts/merge-pr.mjs <number>`.
 *
 * It merges only when CI concluded success on the PR's exact head sha and the PR is not labelled
 * "visual" (scripts/lib/merge-decision.mjs holds the rules), and it merges with --match-head-commit, so a
 * push that lands between the check and the merge is refused by GitHub rather than merged unchecked.
 * .claude/settings.json allows this script and nothing else that merges; a bare `gh pr merge` stays
 * behind the permission prompt. A merge to main then deploys through the Deploy workflow after CI
 * passes on main, unless the AUTO_DEPLOY repository variable is "off".
 *
 * Exits 0 on a merge, 1 on a refusal (the reason is printed), 2 on a usage or GitHub error.
 */

import { execFileSync } from "node:child_process";

import { mergeDecision } from "./lib/merge-decision.mjs";

const number = Number(process.argv[2]);
if (!Number.isInteger(number) || number <= 0) {
  console.error("usage: node scripts/merge-pr.mjs <pr-number>");
  process.exit(2);
}

/** @param {string[]} args */
const gh = (args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

let pr;
let runs;
try {
  const raw = JSON.parse(gh(["pr", "view", String(number), "--json", "number,state,isDraft,baseRefName,headRefOid,labels"]));
  pr = { ...raw, labels: raw.labels.map((/** @type {{ name: string }} */ label) => label.name) };
  runs = JSON.parse(
    gh(["run", "list", "--workflow", "CI", "--commit", pr.headRefOid, "--limit", "20", "--json", "headSha,event,status,conclusion"]),
  );
} catch (error) {
  console.error(`merge-pr: could not read #${number} from GitHub: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const decision = mergeDecision(pr, runs);
if (!decision.merge) {
  console.error(`merge-pr: refused. ${decision.reason}.`);
  process.exit(1);
}

try {
  gh(["pr", "merge", String(number), "--squash", "--match-head-commit", pr.headRefOid]);
} catch (error) {
  console.error(`merge-pr: GitHub refused the merge: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
console.log(`merge-pr: merged #${number} at ${pr.headRefOid.slice(0, 8)} (CI green on that head, not labelled visual).`);
