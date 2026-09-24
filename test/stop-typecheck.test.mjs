/* Each case drives the REAL hook in a scratch repo whose `typecheck` script counts its runs, so
 * a skip is proven by the count, not by the message. */

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveBash } from "../scripts/lib/bash.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", ".claude", "hooks", "stop-typecheck.sh");
const BASH = resolveBash();

/** @param {string} cwd @param {string[]} args */
function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
}

function scratchRepo() {
  const dir = mkdtempSync(join(tmpdir(), "stop-typecheck-"));
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "test@example.invalid");
  git(dir, "config", "user.name", "test");
  git(dir, "config", "core.autocrlf", "false");
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ private: true, scripts: { typecheck: "node tc.cjs" } }),
  );
  // The fake typecheck: counts its runs in a file outside the source paths, exits with the
  // code in tc-exit so a case can turn it red.
  writeFileSync(
    join(dir, "tc.cjs"),
    [
      'const fs = require("node:fs");',
      'const n = Number(fs.existsSync("count") ? fs.readFileSync("count", "utf8") : 0) + 1;',
      'fs.writeFileSync("count", String(n));',
      'const code = Number(fs.existsSync("tc-exit") ? fs.readFileSync("tc-exit", "utf8") : 0);',
      'if (code) console.log("app/a.ts(1,1): error TS0000: planted");',
      "process.exit(code);",
    ].join("\n"),
  );
  writeFileSync(join(dir, ".gitignore"), "count\ntc-exit\n");
  mkdirSync(join(dir, "app"));
  writeFileSync(join(dir, "app", "a.ts"), "export const a = 1;\n");
  writeFileSync(join(dir, "README.md"), "readme\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "init");
  return dir;
}

/** @param {string} dir @param {object} [payload] */
function stop(dir, payload = { stop_hook_active: false }) {
  assert.ok(BASH, "no bash to run the hook with");
  const r = spawnSync(BASH.path, [HOOK], { cwd: dir, input: JSON.stringify(payload), encoding: "utf8" });
  const count = (() => {
    try {
      return Number(readFileSync(join(dir, "count"), "utf8"));
    } catch {
      return 0;
    }
  })();
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, runs: count };
}

test("runs on a first stop, skips an unchanged one, runs again on a source change", () => {
  const dir = scratchRepo();
  let r = stop(dir);
  assert.equal(r.code, 0);
  assert.equal(r.runs, 1, "no pass is stored yet, so the first stop runs");

  r = stop(dir);
  assert.equal(r.code, 0);
  assert.equal(r.runs, 1, "nothing changed, so the typecheck must not run");
  assert.match(r.stdout, /typecheck: no source change since last pass/);

  writeFileSync(join(dir, "README.md"), "edited\n");
  r = stop(dir);
  assert.equal(r.runs, 1, "a non-source edit is outside the key");

  writeFileSync(join(dir, "app", "a.ts"), "export const a = 2;\n");
  r = stop(dir);
  assert.equal(r.runs, 2, "a tracked source edit re-runs");

  r = stop(dir);
  assert.equal(r.runs, 2, "and that pass is remembered");

  mkdirSync(join(dir, "scripts"));
  writeFileSync(join(dir, "scripts", "new.mjs"), "export {};\n");
  r = stop(dir);
  assert.equal(r.runs, 3, "an untracked source file re-runs");

  writeFileSync(join(dir, "scripts", "new.mjs"), "export const b = 1;\n");
  r = stop(dir);
  assert.equal(r.runs, 4, "an edit to an untracked source file re-runs");

  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "second");
  r = stop(dir);
  assert.equal(r.runs, 5, "a new HEAD re-runs even with a clean diff");
});

test("a red typecheck blocks, and blocks again on the next unchanged stop", () => {
  const dir = scratchRepo();
  writeFileSync(join(dir, "tc-exit"), "1");
  let r = stop(dir);
  assert.equal(r.code, 2, "a failing typecheck must block the stop");
  assert.match(r.stderr, /error TS0000: planted/, "the diagnostics reach stderr");
  assert.equal(r.runs, 1);

  r = stop(dir);
  assert.equal(r.code, 2, "a failure is never stored as a pass");
  assert.equal(r.runs, 2);

  writeFileSync(join(dir, "tc-exit"), "0");
  r = stop(dir);
  assert.equal(r.code, 0);
  assert.equal(r.runs, 3);
  r = stop(dir);
  assert.equal(r.runs, 3, "the pass after the fix is stored");
});

test("a stop caused by a stop hook never runs the typecheck", () => {
  const dir = scratchRepo();
  const r = stop(dir, { stop_hook_active: true });
  assert.equal(r.code, 0);
  assert.equal(r.runs, 0);
});
