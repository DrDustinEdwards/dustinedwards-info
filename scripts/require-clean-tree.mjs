/**
 * Refuses a deploy from a working tree that is not clean.
 *
 * Wired as `predeploy`, so npm runs it before `deploy` whoever invokes it.
 *
 * OBSERVATION BOUNDARY: this reads `git status --porcelain` and nothing else.
 * It proves the tree matches HEAD; it does NOT prove HEAD is pushed, that the
 * build about to run reads only tracked files, or that the deployed Worker
 * corresponds to the commit it names. A clean tree at a commit nobody else has
 * still deploys fine and still cannot be reproduced by anyone but this machine,
 * which is why `ship` also checks push state and `check:head` reads the ref.
 *
 * ## Why this exists
 *
 * `npm run deploy` is `npm run build && wrangler deploy`, and `react-router
 * build` reads the WORKING TREE. So an uncommitted edit ships, and the deployed
 * Worker corresponds to no commit anywhere. `ship` refused that from its first
 * version, but `ship` is a wrapper: the primitive it wraps refused nothing, so
 * a bare `npm run deploy` was the same loaded gun with the safety removed.
 * Audit item 2.2, CONFIRMED.
 *
 * ## Why a refusal here rather than deploying from `git archive`
 *
 * Building an extraction of HEAD is the more thorough fix and it was rejected
 * on a MEASURED hazard rather than on effort. `wrangler.jsonc` is gitignored,
 * so an extraction contains only `wrangler.jsonc.example`, whose `database_id`
 * and KV id are placeholder zeros. `check:head` already documents this: it
 * excludes `check:config` because bootstrap copies the example, making real
 * equal example by construction. Deploying from a pure archive would therefore
 * deploy the EXAMPLE bindings, or require copying the real config back in,
 * which reintroduces a working-tree dependency for the one file where it is
 * most dangerous. Trading an unreproducible deploy for a deploy pointed at the
 * wrong database is a worse gun, not a safer one.
 *
 * So the smaller fix wins: the tree must equal HEAD, and then building the tree
 * IS building HEAD. Same guarantee, no config hazard, and it fails closed.
 *
 * ## No override flag, deliberately
 *
 * An `ALLOW_DIRTY=1` escape hatch is a bypass people learn to type, and the
 * whole finding is that a bypass existed. Anyone who genuinely means to deploy
 * an uncommitted tree can still run `npx wrangler deploy` directly, which is an
 * explicit act outside the wrapper rather than a flag on the safe path. The
 * message below says so rather than hiding it.
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
 * FAILS CLOSED on an unreadable answer. A `git` that is missing or a directory
 * that is not a repository both mean the tree cannot be compared to anything,
 * and "I could not check" must not deploy. This is the same rule the migration
 * guard follows for an unreadable schema.
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
