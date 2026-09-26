import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The seat session's tool lists, read from the workflow text. Kept in step with capsid's
// test/seat-session-workflow.test.ts (capsid #171), so the two workflows refuse the same things.

const TEXT = readFileSync(new URL("../.github/workflows/seat-session.yml", import.meta.url), "utf8");
// Comments stripped, so a comment naming a pattern is not the pattern.
const CODE = TEXT.split("\n")
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");

// An allowed interpreter runs any program, which reaches the network and the environment, so it
// would make the --disallowedTools list decorative.
const INTERPRETERS = [
  "node",
  "bash",
  "sh",
  "zsh",
  "dash",
  "python",
  "python3",
  "perl",
  "ruby",
  "deno",
  "bun",
  "pwsh",
  "powershell",
  "env",
  "xargs",
  "eval",
  "exec",
];

test("no allowed Bash pattern is an unbounded interpreter", () => {
  const allowed = /--allowedTools "([^"]*)"/.exec(CODE);
  assert.ok(allowed, "no --allowedTools parsed");
  const bash = allowed[1]
    .split(",")
    .map((e) => e.trim())
    .filter((e) => /^Bash(\(|$)/.test(e));
  // The scan must see the npm entries it sits beside, or it passes on nothing.
  assert.ok(
    bash.includes("Bash(npm test:*)") && bash.includes("Bash(npm run check:*)"),
    `parsed Bash entries: ${bash.join(" ")}`,
  );
  for (const entry of bash) {
    const command = /^Bash\((.*)\)$/.exec(entry)?.[1];
    assert.ok(command && command !== "*" && command !== ":*", `${entry} allows every command`);
    const [first, second] = command.replace(/:\*$/, "").split(/\s+/);
    assert.ok(!INTERPRETERS.includes(first), `${entry} allows an interpreter`);
    if (first === "npx") {
      assert.ok(second && /^[a-z@]/.test(second), `${entry} allows npx without a named tool`);
    }
  }
});
