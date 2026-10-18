import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readSourceDates, sourceDatesModule } from "../scripts/lib/source-dates.mjs";

/* The sitemap's lastmod is each source file's last commit day (scripts/lib/source-dates.mjs). These hold the read
 * to a real repository: a commit dates only the files it touched, files outside the source trees and deleted files
 * are left out, and a shallow clone dates nothing rather than dating every file to its one commit. */

function repo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "source-dates-"));
  const git = (/** @type {string[]} */ args, /** @type {string} */ date = "2026-01-01T12:00:00Z") =>
    execFileSync("git", args, {
      cwd: dir,
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" },
      encoding: "utf8",
    });
  const write = (/** @type {string} */ rel, /** @type {string} */ text) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  };
  git(["init", "-q", "-b", "main"]);
  return { dir, git, write };
}

await test("each file is dated by the last commit that touched it, and only source files that still exist are listed", (t) => {
  const { dir, git, write } = repo();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  write("content/pages/a.md", "a");
  write("content/pages/b.md", "b");
  write("content/gone.md", "x");
  write("README.md", "r");
  git(["add", "."]);
  git(["commit", "-qm", "one"], "2026-03-01T23:30:00Z");
  write("content/pages/b.md", "b2");
  write("app/routes/home.tsx", "h");
  git(["rm", "-q", "content/gone.md"]);
  git(["add", "."]);
  git(["commit", "-qm", "two"], "2026-04-02T08:00:00Z");

  assert.deepEqual(readSourceDates(dir), {
    "app/routes/home.tsx": "2026-04-02",
    "content/pages/a.md": "2026-03-01",
    "content/pages/b.md": "2026-04-02",
  });
});

await test("a shallow clone dates nothing", (t) => {
  const { dir, git, write } = repo();
  const clone = mkdtempSync(path.join(os.tmpdir(), "source-dates-shallow-"));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(clone, { recursive: true, force: true });
  });
  write("content/a.md", "a");
  git(["add", "."]);
  git(["commit", "-qm", "one"], "2026-03-01T12:00:00Z");
  write("content/a.md", "a2");
  git(["commit", "-qam", "two"], "2026-03-02T12:00:00Z");
  execFileSync("git", ["clone", "-q", "--depth", "1", `file://${dir}`, clone]);
  assert.deepEqual(readSourceDates(clone), {});
});

await test("the module is a frozen object of the dates", () => {
  assert.match(sourceDatesModule({ "content/a.md": "2026-03-01" }), /export const SOURCE_DATES = Object\.freeze\(\{\n  "content\/a\.md": "2026-03-01"\n\}\);\n$/);
});
