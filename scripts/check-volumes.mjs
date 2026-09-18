/**
 * Gate: the ACTIVE decisions volume has not passed its own stated freeze point.
 *
 * THE DEFECT: every volume's header states its own limit, and one ran well past it for days,
 * because the limit was a sentence inside the artifact it limited, enforced by whoever happened to
 * read it. Third of that shape in two days, and the repair each time is an instrument.
 *
 * NETWORK TIER, AND IT CANNOT BE OTHERWISE: a decisions volume is a Capsid document, so there is
 * no disk to read and a clean checkout cannot run this. A real limitation rather than a formality,
 * since a volume can pass its freeze point between runs.
 *
 * THE CREDENTIAL FAILS CLOSED rather than skipping: a gate that silently does not run is the thing
 * the runner exists to prevent, and an unread volume is not a volume under its limit.
 *
 * NOTHING RESTATES A LIMIT, hard rule 17: the number lives in the volume that owns it. The ACTIVE
 * volume is the highest-numbered one, never the title, and frozen volumes PASS, because two froze
 * far over before the rule existed and a gate that cannot go green is one somebody deletes.
 */

import { assertFloor } from "./lib/floor.mjs";
import { readDevVar } from "./lib/dev-vars.mjs";
import { classifyVolumes } from "./lib/decisions-volumes.mjs";

const NAMESPACE = "dustinedwards";
const CAPSID_MCP = "https://capsid.dustin-edwards.workers.dev/ops/mcp";

/** Below this the listing has stopped reading; see the scope assertion. */
const MINIMUM_VOLUMES = 10;

let checks = 0;
/** @type {string[]} */
const failures = [];

/** @param {string} label @param {boolean} pass @param {string} detail */
function ok(label, pass, detail) {
  checks += 1;
  if (pass) {
    console.log(`  ok    ${label}`);
    return;
  }
  console.log(`  FAIL  ${label}`);
  failures.push(`${label}: ${detail}`);
}

/**
 * One JSON-RPC call against Capsid's MCP endpoint.
 *
 * @param {string} token @param {string} name @param {Record<string, unknown>} args
 */
async function callTool(token, name, args) {
  const res = await fetch(CAPSID_MCP, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  if (!res.ok) throw new Error(`${name} returned HTTP ${res.status}`);
  const text = await res.text();
  /*
   * The endpoint may answer as SSE, and the LAST `data:` line is the one taken: a stream can carry
   * progress frames ahead of the result, and reading the first would parse a notification as the
   * answer.
   */
  const payload = text.includes("data:")
    ? text.split("\n").filter((l) => l.startsWith("data:")).pop()?.slice(5).trim()
    : text;
  const rpc = JSON.parse(payload ?? "{}");
  if (rpc.error) throw new Error(`${name}: ${rpc.error.message ?? "rpc error"}`);
  const content = rpc.result?.content?.[0]?.text;
  return JSON.parse(content ?? "{}");
}

async function main() {
  console.log("check:volumes\n");

  /*
   * ENV FIRST, then `.dev.vars`: the env path is what lets this run somewhere that keeps the
   * credential in a secret store. Either way it FAILS CLOSED when neither has it.
   */
  const token = process.env.CAPSID_TOKEN || readDevVar("CAPSID_TOKEN");
  ok(
    "CAPSID_TOKEN is readable from .dev.vars",
    Boolean(token),
    "Absent, so the volumes cannot be read and this gate proves nothing. It is an " +
      "operator credential for this machine, not a wrangler secret. Add it to .dev.vars.",
  );
  if (!token) return;

  const listed = await callTool(token, "list", { namespace: NAMESPACE, type: "note" });
  /** @type {Array<{path: string}>} */
  const listedRows = listed.documents ?? [];
  const rows = listedRows.filter((d) => /^decisions-vol-\d+\.md$/.test(d.path));

  /** @type {Array<{path: string, title: string, body: string}>} */
  const docs = [];
  for (const row of rows) {
    const doc = await callTool(token, "read", { namespace: NAMESPACE, path: row.path });
    docs.push({ path: doc.path, title: doc.title, body: doc.body ?? "" });
  }

  const { volumes, active, staleTitles } = classifyVolumes(docs);

  /*
   * SCOPE FIRST: a listing that returned nothing classifies to no active volume, and every
   * assertion below would pass by examining it.
   */
  const floorBreach = assertFloor(
    "check:volumes",
    "volumes",
    volumes.length,
    MINIMUM_VOLUMES,
    "The listing returned fewer volumes than exist, so the highest number read here " +
      "is not the highest number there is, and the wrong document was called active.",
  );
  ok("the volume listing is non-empty", floorBreach === null, floorBreach ?? "");
  if (floorBreach) return;

  ok(
    "exactly one volume is active, and it is the highest numbered",
    active !== null,
    "No volume matched decisions-vol-<n>.md, so there is nothing to check.",
  );
  if (!active) return;

  console.log(`\n  ${volumes.length} volume(s); active is ${active.path} at ${active.bytes} bytes`);
  if (staleTitles.length) {
    console.log(
      `  ${staleTitles.length} frozen volume(s) still titled "(active)", which is why the\n` +
        `  title is not the signal: ${staleTitles.join(", ")}`,
    );
  }
  console.log("");

  /*
   * A VOLUME THAT STATES NO LIMIT FAILS: comparing against a missing number would be a condition
   * that cannot be false, which is the class this gate was written in response to.
   */
  ok(
    `${active.path} states its own freeze point`,
    active.limit !== null,
    "No 'Freeze at <n>KB' in the header. This gate reads the limit from the volume " +
      "rather than carrying one, so a volume that states none cannot be checked.",
  );
  if (active.limit === null) return;

  ok(
    `${active.path} is inside its own freeze point`,
    active.bytes <= active.limit,
    `${active.bytes} bytes against the ${active.limit} it states. Freeze it, open the ` +
      `next volume, and carry forward only what a session needs cold: the standing ` +
      `rulings, the open items and the deadlines. Raising the number in the header is ` +
      `a ruling, not a repair.`,
  );

  const breach = assertFloor("check:volumes", "checks", checks, 4);
  if (breach) failures.push(`this gate executed its assertions: ${breach}`);
}

main()
  .then(() => {
    if (failures.length > 0) {
      console.error(`\n${failures.length} FAILED of ${checks} checks:\n`);
      for (const f of failures) console.error(`  ${f}`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n${checks} checks, 0 failures`);
  })
  .catch((error) => {
    console.error(`\ncheck:volumes could not run: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
