// The build reads the working tree rather than HEAD, so a dirty tree deploys code no commit holds.

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

// Fails closed: no git, or a directory that is not a repository, means "I could not check", which must not deploy.
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
