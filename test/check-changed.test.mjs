// check:changed is what every session runs, so "nothing changed" must only ever mean that.

import test from "node:test";
import assert from "node:assert/strict";

import { RELATED, changedFiles, gatesFor } from "../scripts/check-changed.mjs";

/**
 * A fake git answering by the joined argument list.
 * @param {Record<string, { status: number | null, stdout?: string, stderr?: string, error?: Error }>} answers
 */
const fakeGit = (answers) => (/** @type {string[]} */ args) => {
  const key = args.join(" ");
  const answer = answers[key];
  if (!answer) throw new Error(`unexpected git call: ${key}`);
  return answer;
};

const CLEAN = {
  "rev-parse --verify --quiet origin/main": { status: 0, stdout: "abc\n" },
  "diff --name-only origin/main...HEAD": { status: 0, stdout: "" },
  "diff --name-only": { status: 0, stdout: "" },
  "diff --name-only --cached": { status: 0, stdout: "" },
  "ls-files --others --exclude-standard": { status: 0, stdout: "" },
};

test("THE PLANT: a failed git diff throws instead of reading as nothing changed", () => {
  const git = fakeGit({ ...CLEAN, "diff --name-only": { status: 128, stderr: "fatal: index file corrupt" } });
  assert.throws(() => changedFiles("origin/main", git), /git diff --name-only failed.*index file corrupt/);
});

test("a git that cannot be spawned throws, even on the base probe", () => {
  const git = fakeGit({
    ...CLEAN,
    "rev-parse --verify --quiet origin/main": { status: null, error: new Error("spawn git ENOENT") },
  });
  assert.throws(() => changedFiles("origin/main", git), /ENOENT/);
});

test("an unknown base is reported as unknown, not as an error and not as a base", () => {
  const git = fakeGit({ ...CLEAN, "rev-parse --verify --quiet origin/main": { status: 1 } });
  assert.deepEqual(changedFiles("origin/main", git), { files: [], baseUsed: null });
});

test("untracked, staged, unstaged and committed paths are all listed, once each", () => {
  const git = fakeGit({
    ...CLEAN,
    "diff --name-only origin/main...HEAD": { status: 0, stdout: "app/a.ts\nshared.md\n" },
    "diff --name-only": { status: 0, stdout: "shared.md\n" },
    "diff --name-only --cached": { status: 0, stdout: "content/x.md\n" },
    "ls-files --others --exclude-standard": { status: 0, stdout: "scripts/new-thing.mjs\n" },
  });
  assert.deepEqual(changedFiles("origin/main", git).files, [
    "app/a.ts",
    "content/x.md",
    "scripts/new-thing.mjs",
    "shared.md",
  ]);
});

const DECLARED = new Set([
  "check:policy",
  "check:headers",
  "check:page-payload",
  "check:features",
  "check:machine-readable",
  "check:urls",
]);

test("THE PLANT: a route edit reaches the three gates that parse routes", () => {
  const { gates } = gatesFor("app/routes/search.ask.ts", DECLARED);
  for (const gate of ["check:policy", "check:headers", "check:page-payload"]) {
    assert.ok(gates.includes(gate), `${gate} reads route modules and must run on a route edit`);
  }
  assert.ok(gates.includes(RELATED));
});

test("root.tsx reaches page-payload and entry.server.tsx reaches headers", () => {
  assert.ok(gatesFor("app/root.tsx", DECLARED).gates.includes("check:page-payload"));
  assert.ok(gatesFor("app/entry.server.tsx", DECLARED).gates.includes("check:headers"));
});

test("a component edit does not pull in the route-only gates", () => {
  const { gates } = gatesFor("app/components/site-footer.tsx", DECLARED);
  assert.ok(!gates.includes("check:policy"));
});

test("a hook edit maps to no gate, because no gate or test runs a hook", () => {
  const { rules, gates } = gatesFor(".claude/hooks/no-em-dash.sh", DECLARED);
  assert.deepEqual(gates, []);
  assert.ok(rules.length > 0, "argued safe by a row, not unmapped");
});
