/**
 * check:wrapper. Proves the no-policy law mechanically: this Worker holds no policy, no gates and no second write
 * path, and reaches the publish machinery only through the operator API. It reads the source and the wrangler
 * config and fails in both directions (a forbidden addition, or a required tool or allowlist entry gone).
 * Pure: no network. Verified by `npm run check:wrapper:plant` (scripts/plant-violations.sh).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SITE_ROOT,
  SRC,
  assertions,
  check,
  codeOnly,
  config,
  failures,
  files,
  withoutComments,
} from "./check-wrapper-gate.mjs";
import "./check-wrapper-config.mjs";

// C. No shared code with the app.

/*
 * NO APP MODULE AT ALL. The wrapper once imported the site's repair plan for
 * dei_repair_drift; drift repair now runs from Capsid's watcher and Capsid
 * Admin's site repair, so nothing here is shared with the app.
 */
const APP_IMPORTS = {};

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g;
for (const f of files) {
  const stripped = f.text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  for (const m of stripped.matchAll(IMPORT_RE)) {
    const spec = m[1];
    const local = spec.startsWith(".");
    const named = (APP_IMPORTS[f.name] ?? []).includes(spec);
    check(
      `src/${f.name} import "${spec}" does not escape this folder`,
      !local || !spec.includes("..") || named,
      "A relative import climbing out of src/ would be shared code with the app. The one allowed is APP_IMPORTS.",
    );
    check(
      `src/${f.name} import "${spec}" is not an app path alias`,
      !spec.startsWith("~/") && !spec.includes("dustinedwards-info"),
      "The wrapper imports nothing from the app.",
    );
  }
}

// D. Outbound reach. Every network destination is deliberate.

// The Access sign-in host is built from the ACCESS_TEAM_DOMAIN var, so no
// login host appears as a literal. The operator API is reached through the
// OPERATOR_API_URL var rather than a literal, so a hardcoded app URL fails here.
const ALLOWED_HOSTS = ["tool-call-log.invalid"];
// Addresses this Worker names and never fetches, matched as whole literals so the
// host stays unallowed anywhere else: the Origin it admits, and the serverInfo
// website and icon, which a client fetches.
const NAMED_NOT_FETCHED = [
  '"https://claude.ai"',
  '"https://dustinedwards.info"',
  '"https://dustinedwards.info/icon.svg"',
];
const unnamed = (text) =>
  NAMED_NOT_FETCHED.reduce((t, literal) => t.replaceAll(literal, '""'), text);
const URL_RE = /https?:\/\/([a-z0-9.-]+)/gi;
for (const f of files) {
  for (const m of unnamed(readFileSync(join(SRC, f.name), "utf8")).matchAll(URL_RE)) {
    const host = m[1].toLowerCase();
    // Documentation links in comments are fine, so comments are stripped, but
    // the host lives in a STRING literal and codeOnly() would delete it. That
    // mistake let a planted exfiltration host through undetected.
    if (!unnamed(withoutComments(f.text)).includes(host)) continue;
    check(
      `src/${f.name} outbound host ${host} is allowlisted`,
      ALLOWED_HOSTS.includes(host),
      "Add it to ALLOWED_HOSTS here only if it is genuinely required, and say why.",
    );
  }
}

check(
  "The operator API is addressed only as SITE_ORIGIN + /api/operator, over SITE, in api-client.ts",
  files.every(
    (f) => f.name === "api-client.ts" || !withoutComments(f.text).includes("/api/operator"),
  ) &&
    /binding: "SITE"/.test(
      withoutComments(files.find((f) => f.name === "api-client.ts")?.text ?? ""),
    ) &&
    /callApi\(env, LEG, "\/api\/operator"/.test(
      withoutComments(files.find((f) => f.name === "api-client.ts")?.text ?? ""),
    ),
  "A literal host would survive a config change and reach the wrong environment.",
);

// E. The tool surface mirrors the API and nothing more.

const toolsText = readFileSync(join(SRC, "tools.ts"), "utf8");
/*
 * THE SIX TOOLS (capsid/research/design-mcp-servers.md section 6). Whole jobs,
 * each prefixed dei_, with no post tools (Carrel owns
 * writing, rule 11) and the mention tools too (Carrel moderates every site's
 * webmentions: carrel_review_mentions, carrel_decide_mention).
 */
const EXPECTED_TOOLS = [
  "dei_read_registry",
  "dei_refresh_citations",
  "dei_check_publications",
  "dei_read_procedure",
  "dei_save_procedure",
];
const declared = [...toolsText.matchAll(/^\s{4}name:\s*"([a-z_]+)",$/gm)].map((m) => m[1]);

check(
  "The declared tools are exactly the five dei_ tools",
  JSON.stringify(declared) === JSON.stringify(EXPECTED_TOOLS),
  `Expected [${EXPECTED_TOOLS.join(", ")}] but found [${declared.join(", ")}].`,
);

/*
 * EVERY OPERATOR TOOL THE WRAPPER NAMES IS ONE THE API OFFERS, read from the
 * API's own list in app/lib/operator/descriptors.ts. The separate repo kept a
 * hand mirror of that list because it could not read the site; here it can,
 * so the mirror is gone and a tool the API does not offer fails on the next run.
 */
const descriptors = readFileSync(join(SITE_ROOT, "app/lib/operator/descriptors.ts"), "utf8");
const apiList = descriptors.slice(
  descriptors.indexOf("const TOOLS = ["),
  descriptors.indexOf("] as const;"),
);
const API_TOOLS = [...apiList.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
check(
  "the operator API's tool list was read",
  API_TOOLS.length > 10,
  `Read ${API_TOOLS.length} names.`,
);

const toolStrings = withoutComments(toolsText);
const named = new Set([
  ...[...toolStrings.matchAll(/\b(?:run|runPaged|callSiteOperator)\(env,\s*"([a-z_]+)"/g)].map(
    (m) => m[1],
  ),
  ...[...toolStrings.matchAll(/\b(?:list|get):\s*"([a-z_]+)"/g)].map((m) => m[1]),
]);

for (const name of named) {
  check(
    `operator tool ${name} is one the API offers`,
    API_TOOLS.includes(name),
    "A tool the API does not offer would be a policy decision made here.",
  );
}

// Post and page tools cannot come back: the operator API does not offer them, which the check above enforces. The
// site's jobs run now through Capsid Admin and the operator API's run_job, never through a tool here.
check(
  "the wrapper never calls run_job",
  !named.has("run_job") && !toolStrings.includes('"run_job"'),
  "Running the site's jobs is Capsid Admin's, for every site.",
);

// Every declared tool reaches the API through the one transport.
for (const name of EXPECTED_TOOLS) {
  const start = toolsText.indexOf(`name: "${name}",`);
  const next = toolsText.indexOf('\n    name: "', start + 1);
  const block = codeOnly(toolsText.slice(start, next === -1 ? undefined : next));
  check(
    `Tool ${name} reaches the API only through run, runPaged or callSiteOperator`,
    /\b(run|runPaged|callSiteOperator)\(env,/.test(block) && !/fetch\(/.test(block),
  );
}

/*
 * RULE 12, THE ONE DOOR. The MCP server registers every tool through
 * invokeTool, and invokeTool checks ownership and scope before it writes the
 * log or runs a handler. A registration that called tool.handler directly would
 * skip all three.
 */
{
  const handlerText = readFileSync(join(SRC, "mcp-handler.ts"), "utf8");
  const handlerCode = codeOnly(handlerText);
  // site-runtime's invokeTool is the door: it refuses first, logs started (or refuses), runs
  // `run`, logs finished, and is tested there. What is provable here is that every handler is
  // reached only as its `run`, with this server's scopes.
  // site-runtime's registerTools registers each tool the grant can call with invokeTool around its handler (tested
  // there). Provable here: it is the one registration, given TOOLS and this server, and nothing calls a handler or
  // registers a tool around it.
  check(
    "every tool is registered through site-runtime's registerTools, which wraps each in invokeTool",
    /import \{[^}]*\bregisterTools\b[^}]*\} from "@dustinedwards\/site-runtime\/mcp-server"/.test(
      withoutComments(handlerText),
    ) &&
      /registerTools\([^,]+, TOOLS, \{\s*env,\s*server: SERVER,\s*caller,/.test(handlerCode) &&
      !/\.handler\(|\.registerTool\(/.test(handlerCode) &&
      !/function invokeTool|appendAudit/.test(codeOnly(toolsText)),
    "Rule 12: ownership, scope and the log are in invokeTool; a direct handler call skips them.",
  );
  check(
    "invokeTool names this server's scopes, so a tool's declared scope is checked against dei.read and dei.write",
    /const SERVER: McpServerInfo = \{\s*site: "",\s*scopes: SCOPES,/.test(handlerCode),
    "Rule 12.1 and 12.3: the per-call ownership proof and the scope check.",
  );
}

// The API leg's credential is confined to the module that owns it.
// The log's bucket has one reader: the scheduled export of site-runtime's adminMcpWorker (index.ts's default export),
// which hands it to exportAuditLog. Nothing here may reach it: a tool doing so would turn the log's copies into a store
// the server writes at will.
const bucketHolders = files
  .filter((f) => withoutComments(f.text).includes("AUDIT_BUCKET"))
  .map((f) => f.name);
check(
  "AUDIT_BUCKET appears in no source file: only site-runtime's adminMcpWorker exports the log to it",
  bucketHolders.length === 0,
  `Found in: ${bucketHolders.join(", ")}. The bucket holds the log's copies and nothing else.`,
);

const tokenHolders = files
  .filter((f) => withoutComments(f.text).includes("OPERATOR_TOKEN"))
  .map((f) => f.name);
check(
  "OPERATOR_TOKEN appears only in api-client.ts",
  JSON.stringify(tokenHolders) === JSON.stringify(["api-client.ts"]),
  `Found in: ${tokenHolders.join(", ") || "(nowhere)"}. The API leg has one owner.`,
);

// The API leg has one definition and one consumer. api-client.ts defines
// callSiteOperator; tools.ts is the only module allowed to invoke it. Spreading the
// call across modules would mean several places knew how to reach the app, which
// is how a second write path starts.
const callers = files
  .filter((f) => f.name !== "api-client.ts" && /callSiteOperator\s*\(/.test(codeOnly(f.text)))
  .map((f) => f.name);
check(
  "callSiteOperator has exactly one consumer, tools.ts",
  JSON.stringify(callers) === JSON.stringify(["tools.ts"]),
  `Called from: ${callers.join(", ") || "(nowhere)"}. The API leg is one seam with one consumer.`,
);

check(
  "Only api-client.ts fetches over the SITE binding",
  files.every((f) => f.name === "api-client.ts" || !/SITE\.fetch\(/.test(codeOnly(f.text))),
);

// F. No policy DECISIONS. Describing a policy is required; enforcing one is not.

// The tool descriptions must MENTION the first-publish rule so an agent reads a
// refusal as policy. But no code may BRANCH on it: that would be a second,
// drifting copy of a rule the API owns. So the assertion is asymmetric on purpose,
// and it is the subtlest thing this gate does.
// The rule governs a procedure's first publication, and it must be stated in
// the procedure tool's OWN description: an agent reads one tool at a time.
const toolBlock = (name) => {
  const start = toolsText.indexOf(`name: "${name}",`);
  if (start === -1) return "";
  const next = toolsText.indexOf('\n    name: "', start + 1);
  return toolsText.slice(start, next === -1 ? undefined : next);
};
check(
  "dei_save_procedure's description states the first-publish policy",
  /first-publish-requires-admin/.test(toolBlock("dei_save_procedure")),
  "An agent that has not been told the rule reads a 403 as a malfunction and retries.",
);

// A validator refusal carries its messages as detail.errors. They must reach
// the agent as text, or a 422 arrives as a bare status and the agent cannot
// fix the file. Relaying is required; rewording them is not this Worker's job.
check(
  "run() relays the API's detail.errors messages into the tool text",
  /\.errors;/.test(codeOnly(toolsText)) && /parts\.push\(message\)/.test(codeOnly(toolsText)),
  "Without it, a procedure save's 422 reaches the agent with no validator message.",
);

const POLICY_BRANCHES = [
  /if\s*\([^)]*firstPublished/,
  /if\s*\([^)]*operatorMayPublish/,
  /firstPublished\s*[=!]==/,
  /operatorMayPublish\s*[=!]==/,
  /if\s*\([^)]*\bdraft\b[^)]*\)\s*\{[^}]*throw/,
];
for (const f of files) {
  const code = codeOnly(f.text);
  for (const re of POLICY_BRANCHES) {
    check(
      `src/${f.name} does not branch on publish state (${re.source})`,
      !re.test(code),
      "Deciding this here would duplicate a rule the operator API owns.",
    );
  }
}

// The gates belong to the app. If any of these appeared here it would mean the
// wrapper had started validating content, and two validators drift.
const FORBIDDEN_GATE_MARKERS = [
  "frontmatterSchema",
  "wideDash",
  "publiclyVisible",
  "renderPost",
  "savePost(",
];
for (const f of files) {
  for (const marker of FORBIDDEN_GATE_MARKERS) {
    check(
      `src/${f.name} does not re-implement the app's ${marker} gate`,
      !withoutComments(f.text).includes(marker),
      "The gates run server side in the app. There is exactly one copy of each.",
    );
  }
}

// G. The prior-era shim stays behind one seam and keeps its removal condition.
// The shim is site-runtime's routeMcpEra; this Worker's part is the one call
// that hands it the SDK's isLegacyRequest.

{
  const handlerText = readFileSync(join(SRC, "mcp-handler.ts"), "utf8");
  check(
    "The era seam documents its removal condition",
    /REMOVAL CONDITION/.test(handlerText) && /probe-report/.test(handlerText),
    "A shim without a stated removal condition becomes permanent by default.",
  );
  // Count the calls themselves, not the files: two calls in one file is two seams.
  const eraCalls = files.flatMap((f) =>
    [...codeOnly(f.text).matchAll(/routeMcpEra\s*\(/g)].map(() => f.name),
  );
  check(
    "The era router has exactly one call site, in mcp-handler.ts",
    JSON.stringify(eraCalls) === JSON.stringify(["mcp-handler.ts"]),
    `Call sites: ${eraCalls.join(", ") || "(none)"}. More than one and it is no longer a seam.`,
  );
  // STRING option values: comments stripped, literals kept, so header prose cannot satisfy it.
  check(
    'No handler is built here, and none in compatibility mode (no createMcpHandler call, no legacy: "stateless")',
    files.every(
      (f) =>
        !/legacy:\s*"stateless"/.test(withoutComments(f.text)) &&
        !/createMcpHandler\s*\(/.test(codeOnly(f.text)),
    ),
    "Only routeMcpEra builds the handlers, so dropping isLegacyRequest leaves a modern-only server.",
  );
}

// H. The door is site-runtime's adminMcpWorker, and only that.

/*
 * The door's guarantees (CIMD for claude.ai; DCR at /register for Grok's rmcp client, with the exact redirect allowlist and the per-address limit; tokens bound to PUBLIC_ORIGIN + /mcp and the
 * audience re-checked; the administrator re-checked; agent keys matched by ./agent-keys from the SECRET NAME, limited
 * under `agent:<name>`, logged by principal with no key material) are site-runtime's adminMcpWorker, each with its
 * PLANT test in site-runtime's test/admin-mcp.test.mjs. What this server could still get wrong is a door of its own
 * beside it, or switching off what it needs.
 */
const indexText = files.find((f) => f.name === "index.ts")?.text ?? "";
const indexCode = codeOnly(indexText);

check(
  "index.ts's default export is site-runtime's adminMcpWorker",
  /export default adminMcpWorker</.test(indexCode) &&
    /import \{[^}]*\badminMcpWorker\b[^}]*\} from "@dustinedwards\/site-runtime\/admin-mcp"/.test(
      withoutComments(indexText),
    ),
  "The door is the shared one, tested once where it lives.",
);

check(
  "no local door: no provider, registration, audience or agent-key code here",
  files.every(
    (f) =>
      !/new OAuthProvider\(|registrationRefusal\(|registrationLimited\(|audienceRefusal\(|agentPrincipal\(|probeDoor\(|mcpOriginRefusal\(/.test(
        codeOnly(f.text),
      ),
  ),
  "A second door beside the shared one is a second place for a guard to be missing.",
);

check(
  "agent keys stay on (Grok cannot complete OAuth, measured 2026-09-07)",
  /agentKeys:\s*true/.test(indexCode),
  "Without them Grok has no door; its key is read only unless AGENT_WRITE names it.",
);

check(
  "both doors reach the tool surface through the ONE handleMcp",
  (indexCode.match(/handleMcp\(/g) ?? []).length === 1 &&
    /serve: \(request, env, ctx, caller\) => handleMcp\(request, env, ctx, caller\)/.test(
      indexCode,
    ),
  "Two handlers would be two places the tool surface is defined, and the first time they disagreed one door would " +
    "offer something the other did not.",
);

check(
  "no local agent-key code: the matching is site-runtime's ./agent-keys",
  !files.some(
    (f) =>
      /AGENT_KEY_|safeEqual\(/.test(codeOnly(f.text)) ||
      /"AGENT_KEY_/.test(withoutComments(f.text)),
  ),
  "A second copy of the key comparison is a second place for it to be wrong (checklist S6).",
);

/*
 * "First publish stays Dustin's" is enforced by the operator API, which grants OPERATOR_TOKEN `{ kind: "operator" }`
 * and refuses first publication on that actor kind. The door introduces no second credential and no claim to admin.
 */
check(
  "the door mints no credential of its own",
  !/OPERATOR_TOKEN/.test(indexCode) && !/isAdminUser\(/.test(indexCode),
  "index.ts must never touch the API credential or the admin check. If the agent door chose a token, the API's actor " +
    "kind would become this Worker's decision and first-publish policy would move here with it.",
);

console.log(`\ncheck:wrapper: ${assertions - failures}/${assertions} assertions passed`);
if (failures) {
  console.error(`\n${failures} failed. The wrapper's no-policy law is not currently provable.`);
  process.exit(1);
}
console.log(
  `The no-policy law holds: no app import, no app bindings, ${EXPECTED_TOOLS.length} tools, one API seam.`,
);

/*
 * PLANTED VIOLATIONS. scripts/plant-violations.sh is the harness that proves this gate fails
 * (`npm run check:wrapper:plant`); a gate never observed failing has not been verified. The harness snapshots and
 * restores the exact files it edits: `git checkout -- .` leaves untracked files, so residue contaminated later
 * plants and destroyed uncommitted work. Commit before running a harness that reverts anything
 * (dustinedwards/workflow-mainline.md).
 */
