// check:postinstall: proves the install step cannot wait on input. A stub stands in for wrangler and blocks until its stdin ends,
// as wrangler does when it asks a question. wrangler-types.mjs is started with an open stdin that nobody writes to, like a
// terminal nobody is watching; it must still exit. Then every package.json script that generates the worker types must go
// through that script, because a bare `wrangler types` is the one that hangs. (Same check as Carrel's.)

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
console.log("\ncheck:postinstall\n");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const bare = Object.entries(pkg.scripts).filter(([, command]) => /(^|[\s&|;])wrangler types\b/.test(String(command)));
if (bare.length > 0) {
  for (const [name, command] of bare) console.error(`  FAIL  ${name} runs a bare \`wrangler types\` (${command}): it prompts on a terminal. Use node scripts/wrangler-types.mjs.`);
  process.exit(1);
}
if (!/node scripts\/wrangler-types\.mjs/.test(pkg.scripts.postinstall ?? "")) {
  console.error("  FAIL  postinstall does not run node scripts/wrangler-types.mjs.");
  process.exit(1);
}
console.log("  ok    no script runs a bare `wrangler types`, and postinstall uses scripts/wrangler-types.mjs");

const stub = join(mkdtempSync(join(tmpdir(), "postinstall-")), "wrangler.js");
writeFileSync(stub, 'process.stdin.on("end", () => process.exit(0));\nprocess.stdin.resume();\n');

const child = spawn(process.execPath, [join(root, "scripts", "wrangler-types.mjs")], {
  cwd: root,
  env: { ...process.env, WRANGLER_ENTRY: stub },
  stdio: ["pipe", "inherit", "inherit"],
});
const timer = setTimeout(() => {
  child.kill("SIGKILL");
  console.error("  FAIL  the types step is still running after 10 seconds. It is waiting on stdin, which a hidden wrangler prompt would do.");
  process.exit(1);
}, 10_000);
child.on("exit", (code) => {
  clearTimeout(timer);
  if (code !== 0) {
    console.error(`  FAIL  the types step exited with ${code}.`);
    process.exit(1);
  }
  console.log("  ok    the types step finished without waiting on input");
  process.exit(0);
});
