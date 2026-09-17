// Run a command with CAPSID_TOKEN taken from the MAIN checkout's .dev.vars.
//
// This worktree has no .dev.vars of its own, and a secret file is not something
// to copy around. The value is read in-process, handed to one child, and never
// printed, logged or written anywhere.
//
// Usage: node scratchpad/run-with-capsid.mjs <script> [args...]
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const MAIN = "C:/Users/email/dev/dustinedwards-info/.dev.vars";
if (!existsSync(MAIN)) {
  console.error("no .dev.vars in the main checkout; cannot source CAPSID_TOKEN");
  process.exit(2);
}

let token = null;
for (const line of readFileSync(MAIN, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (t.slice(0, eq).trim() !== "CAPSID_TOKEN") continue;
  token = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}
if (!token) {
  console.error("CAPSID_TOKEN not defined in the main checkout's .dev.vars");
  process.exit(2);
}

const [, , script, ...rest] = process.argv;
const r = spawnSync(process.execPath, [script, ...rest], {
  stdio: "inherit",
  env: { ...process.env, CAPSID_TOKEN: token },
});
process.exit(r.status ?? 1);
