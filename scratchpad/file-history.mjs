// File the two history documents into Capsid, reading the bytes OFF DISK so a verbatim archive
// never passes through a model. That is the whole reason this is a script: both documents hold
// deleted comment blocks verbatim, and a model retyping 1.1 MB of them is not verbatim.
//
//   node scratchpad/run-with-capsid.mjs scratchpad/file-history.mjs [--dry]
//
// IT NEEDS A WRITE-SCOPED TOKEN AND THE REPO'S IS NOT ONE. CAPSID_TOKEN in the main checkout's
// .dev.vars resolves to agent:dustinedwards-guidelines-gate, whose tool scope is read and list,
// which is correct for what it was minted for (check:guidelines exports documents, it does not
// write them). Filing needs an agent with the write tool on the dustinedwards namespace, and
// minting one is admin-only by design: a minted agent that could mint has no scope. So the
// sequence is mint, put the key in the main checkout's .dev.vars as CAPSID_TOKEN, run this.
//
// The write is verified rather than assumed: the response carries the stored body's sha256 and
// this compares it to the file's own. Equal means the bytes landed exactly.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { CAPSID_MCP, NAMESPACE } from "../scripts/lib/capsid.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const DRY = process.argv.includes("--dry");

const DOCS = [
  {
    file: "scratchpad/sheet-history-2026-09.md",
    path: "sheet-history-2026-09.md",
    title: "Stylesheet comment history, September 2026",
    type: "reference",
  },
  {
    file: "scratchpad/code-history-2026-09-wave1.md",
    path: "code-history-2026-09-wave1.md",
    title: "Code comment history, September 2026, wave 1",
    type: "reference",
  },
];

/**
 * `callTool` in scripts/lib/capsid.mjs parses the tool's text as JSON, and an authorization
 * refusal arrives as a plain sentence, so it surfaces as "Unexpected token 'u'". This keeps the
 * raw text, because the sentence names the agent and its scope and that is the whole diagnosis.
 *
 * @param {string} token @param {string} name @param {Record<string, unknown>} args
 */
async function call(token, name, args) {
  const res = await fetch(CAPSID_MCP, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const text = await res.text();
  const payload = text.includes("data:")
    ? text.split("\n").filter((l) => l.startsWith("data:")).pop()?.slice(5).trim()
    : text;
  const rpc = JSON.parse(payload ?? "{}");
  if (rpc.error) return { error: rpc.error.message ?? "rpc error" };
  const content = rpc.result?.content?.[0]?.text ?? "";
  try {
    return { result: JSON.parse(content) };
  } catch {
    return { error: content };
  }
}

const token = process.env.CAPSID_TOKEN;
if (!token) {
  console.error("CAPSID_TOKEN absent; run this through scratchpad/run-with-capsid.mjs");
  process.exit(2);
}

for (const doc of DOCS) {
  const abs = join(REPO, doc.file);
  if (!existsSync(abs)) {
    console.error(`missing: ${doc.file}`);
    process.exit(2);
  }
  const body = readFileSync(abs, "utf8");
  const sha = createHash("sha256").update(body, "utf8").digest("hex");
  console.log(`${doc.file}: ${Buffer.byteLength(body)} bytes, sha256 ${sha}`);
  if (DRY) continue;

  const { result, error } = await call(token, "write", {
    namespace: NAMESPACE,
    path: doc.path,
    title: doc.title,
    type: doc.type,
    body,
    mode: "replace",
    confirm: true,
  });
  if (error) {
    console.error(`  -> REFUSED: ${error}`);
    process.exitCode = 1;
    continue;
  }
  const same = result?.sha256 === sha;
  console.log(
    `  -> ${NAMESPACE}/${doc.path}: ${result?.bytes} bytes, sha256 ${result?.sha256}` +
      ` ${same ? "MATCHES the file" : "DOES NOT MATCH the file, read it back before trusting it"}`,
  );
  if (!same) process.exitCode = 1;
}
