/**
 * Refuses a deploy from a working tree that is not clean. Wired as `predeploy`.
 *
 * BOUNDARY: it reads `git status --porcelain` and nothing else. It proves the tree matches HEAD;
 * it does NOT prove HEAD is pushed, or that the deployed Worker corresponds to the commit it names.
 *
 * WHY IT EXISTS: the build reads the WORKING TREE, so an uncommitted edit ships and the deployed
 * Worker corresponds to no commit anywhere. Ship refused that from its first version, but ship is
 * a wrapper and the primitive it wraps refused nothing.
 *
 * WHY NOT BUILD FROM AN EXTRACTION OF HEAD: the wrangler config is gitignored, so an extraction
 * carries only the example, whose ids are placeholders. Deploying from a pure archive would
 * deploy the EXAMPLE bindings, or require copying the real config back in, which reintroduces a
 * working-tree dependency for the one file where it is most dangerous. So the smaller fix wins:
 * the tree must equal HEAD, and then building the tree IS building HEAD.
 *
 * NO OVERRIDE FLAG: an escape hatch is a bypass people learn to type, and the whole finding is
 * that a bypass existed. Anyone who means it can invoke wrangler directly, which is an explicit
 * act outside the wrapper.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} why @param {string} fix */
function refuse(why, fix) {
  console.error(`\npredeploy REFUSED: ${why}\n`);
  console.error(`  ${fix}\n`);
  process.exit(1);
}

const porcelain = spawnSync("git", ["status", "--porcelain"], {
  cwd: root,
  encoding: "utf8",
});

/*
 * FAILS CLOSED on an unreadable answer: a missing git and a directory that is not a repository
 * both mean the tree cannot be compared to anything, and "I could not check" must not deploy.
 */
if (porcelain.status !== 0) {
  refuse(
    "git status could not be read, so the tree cannot be compared to HEAD",
    `Is this a git repository? git said: ${(porcelain.stderr ?? "").trim() || "(nothing)"}`,
  );
}

const dirty = (porcelain.stdout ?? "").trim();
if (dirty.length > 0) {
  console.error(dirty);
  refuse(
    `the working tree has ${dirty.split("\n").length} uncommitted change(s)`,
    "`npm run deploy` runs `react-router build`, which reads the WORKING TREE, not " +
      "HEAD. Deploying now ships code that exists on no commit and that nobody can " +
      "reproduce. Commit or stash first.\n\n" +
      "  If you genuinely mean to deploy an uncommitted tree, run `npx wrangler deploy`\n" +
      "  directly. There is no flag for it here on purpose.",
  );
}

console.log(`predeploy ok. tree is clean at ${headSha()}.`);

function headSha() {
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  return (head.stdout ?? "").trim() || "(unknown)";
}
