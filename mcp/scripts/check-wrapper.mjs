/**
 * check:wrapper. Proves the no-policy law MECHANICALLY.
 *
 * The law is that this Worker contains no policy, no gates, and no second write
 * path, and that its only route to the publish machinery is an HTTP request to
 * the operator API. A law asserted only in a README is a law that drifts, so this
 * gate reads the actual source and the actual wrangler config and fails when they
 * disagree with it.
 *
 * It fails in BOTH directions on purpose. Adding a forbidden binding fails, and so
 * does removing a required tool or letting the binding allowlist drift out of
 * sync with the config. A gate that only catches additions cannot notice a
 * deletion, and half this repo's guarantees are about things that must stay.
 *
 * Pure: no network, no deployment, no Cloudflare API. Same principle as the app's
 * check:policy and check:search.
 *
 * Verified by planting violations. See the PLANTED VIOLATIONS block at the bottom.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
/*
 * THE SITE'S CHECKOUT, one level up since the move into dustinedwards-info.
 * The gate READS two site files (the operator API's tool list and the site's
 * origin) so that what it checks against is derived rather than restated. It
 * reads them; the Worker imports nothing from them.
 */
const SITE_ROOT = join(ROOT, "..");

let failures = 0;
let assertions = 0;

function check(label, condition, detail = "") {
  assertions += 1;
  if (!condition) {
    failures += 1;
    console.error(`FAIL  ${label}${detail ? `\n      ${detail}` : ""}`);
  }
}

// jsonc: strip line comments before parsing. Block comments are stripped first
// because this config's own comments name forbidden binding types in prose, and a
// parser that looked at comments would find the prose before the config. That
// exact trap has already been hit twice in this portfolio.
function readJsonc(path) {
  const raw = readFileSync(path, "utf8");
  const withoutBlocks = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLines = withoutBlocks.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(withoutLines);
}

function sourceFiles() {
  return readdirSync(SRC)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ name: f, text: readFileSync(join(SRC, f), "utf8") }));
}

/**
 * TWO strippers, and picking the wrong one silently disables an assertion.
 * Verified the hard way: the first version of this gate used codeOnly()
 * everywhere, and three of eleven planted violations went undetected because the
 * thing being searched for lived in a string literal that codeOnly() had already
 * removed.
 *
 * withoutComments  strips comments, KEEPS strings. Use for assertions about
 *                  string CONTENT: urls, paths, config values, option values.
 * codeOnly         strips comments AND strings. Use for assertions about
 *                  executable code: identifiers, branches, property access.
 *
 * Both strip comments, because this file's own prose and the source's module
 * headers name the very things being forbidden. A parser that reads comments
 * finds the documentation before the code, which is a trap this portfolio has now
 * hit three times.
 */
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function codeOnly(text) {
  return withoutComments(text)
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '""')
    .replace(/"(?:\\.|[^\\"])*"/g, '""')
    .replace(/'(?:\\.|[^\\'])*'/g, '""');
}

/**
 * Resolve the wrangler config.
 *
 * The real `wrangler.jsonc` is gitignored, because it carries live KV namespace
 * ids and this repo is public. So a fresh clone has only
 * `wrangler.jsonc.example`, and this gate has to work there too or it becomes a
 * gate that only its author can run.
 *
 * Every assertion here is about binding SHAPE (which keys exist, which binding
 * names, whether the DO migration is sqlite-backed), never about id VALUES, so
 * the example proves exactly as much as the real file. Preference order is real
 * first, so a developer who has both is checked against what actually deploys.
 *
 * The gap this leaves, stated rather than hidden: on a machine with ONLY the
 * example, a forbidden binding added to the real file would not be seen. That is
 * closed below by asserting the two agree whenever both are present.
 */
function resolveConfig() {
  const real = join(ROOT, "wrangler.jsonc");
  const example = join(ROOT, "wrangler.jsonc.example");
  if (existsSync(real)) return { path: real, which: "wrangler.jsonc" };
  if (existsSync(example)) return { path: example, which: "wrangler.jsonc.example" };
  // Fails CLOSED. No config means nothing can be proven, which is not a pass.
  console.error("FAIL  no wrangler config found (neither wrangler.jsonc nor wrangler.jsonc.example)");
  process.exit(1);
}

const configSource = resolveConfig();
const config = readJsonc(configSource.path);
const files = sourceFiles();

// When both exist they must describe the same bindings, or the example is
// decoration and the fresh-clone run is checking a fiction.
if (configSource.which === "wrangler.jsonc" && existsSync(join(ROOT, "wrangler.jsonc.example"))) {
  const shape = (c) =>
    JSON.stringify({
      keys: Object.keys(c).sort(),
      kv: (c.kv_namespaces ?? []).map((n) => n.binding).sort(),
      dobj: (c.durable_objects?.bindings ?? []).map((b) => b.class_name).sort(),
      services: (c.services ?? []).map((b) => `${b.binding}:${b.service}`).sort(),
      routes: JSON.stringify(c.routes ?? []),
      migrations: (c.migrations ?? []).map((m) => m.new_sqlite_classes ?? []).flat().sort(),
      flags: (c.compatibility_flags ?? []).slice().sort(),
      main: c.main,
      vars: Object.keys(c.vars ?? {}).sort(),
    });
  check(
    "wrangler.jsonc.example describes the same bindings as wrangler.jsonc",
    shape(config) === shape(readJsonc(join(ROOT, "wrangler.jsonc.example"))),
    "The example is what a fresh clone checks, so drift there silently weakens this gate.",
  );
}

// ---------------------------------------------------------------------------
// A. Bindings are an allowlist, derived from the config rather than restated.
// ---------------------------------------------------------------------------

// Any of these would give the wrapper a second route to app data, which is the
// one thing it must not have.
const FORBIDDEN_BINDING_KEYS = [
  "d1_databases",
  "r2_buckets",
  "ai",
  "vectorize",
  "hyperdrive",
  "queues",
  "browser",
  "mtls_certificates",
  "analytics_engine_datasets",
  "dispatch_namespaces",
  "pipelines",
];

for (const key of FORBIDDEN_BINDING_KEYS) {
  check(
    `wrangler.jsonc has no "${key}" binding`,
    config[key] === undefined,
    `Found ${key}. The wrapper's only route to the app is an HTTP call to the operator API.`,
  );
}

const ALLOWED_KV = ["OAUTH_KV", "PROBE_KV"];
const actualKv = (config.kv_namespaces ?? []).map((n) => n.binding).sort();
check(
  "KV bindings are exactly the OAuth store and the probe log",
  JSON.stringify(actualKv) === JSON.stringify([...ALLOWED_KV].sort()),
  `Expected ${ALLOWED_KV.join(", ")} but found ${actualKv.join(", ") || "(none)"}.`,
);

/*
 * ONE SERVICE BINDING, to the site Worker, and it is the API leg. Since the
 * move into dustinedwards-info the operator API is reached over `SITE` instead
 * of the public URL (design section 6 step 4). It is still an HTTP request
 * carrying OPERATOR_TOKEN through the operator API's authentication and rate
 * limiter, so it is the same single door, reached without an internet hop. Any
 * other service would be a second door.
 */
const actualServices = (config.services ?? []).map((b) => `${b.binding}:${b.service}`).sort();
check(
  "the only service binding is SITE, to the dustinedwards Worker",
  JSON.stringify(actualServices) === JSON.stringify(["SITE:dustinedwards"]),
  `Found ${actualServices.join(", ") || "(none)"}. The API leg is one binding to one Worker.`,
);

const ALLOWED_DO_CLASSES = ["OperatorRateLimit", "ToolCallLog"];
const actualDo = (config.durable_objects?.bindings ?? []).map((b) => b.class_name).sort();
check(
  "Durable Objects are exactly the rate limiter and the tool-call log",
  JSON.stringify(actualDo) === JSON.stringify([...ALLOWED_DO_CLASSES].sort()),
  `Expected ${ALLOWED_DO_CLASSES.join(", ")} but found ${actualDo.join(", ") || "(none)"}.`,
);

// The limiter must be a SQLite-backed class. The async storage API was measured
// non-atomic across an await and let 8 through a ceiling of 3.
check(
  "The rate limiter is registered as a new_sqlite_classes migration",
  (config.migrations ?? []).some((m) => (m.new_sqlite_classes ?? []).includes("OperatorRateLimit")),
  "Without SQLite the counter is not atomic and the limit does not hold.",
);

// The tool-call log is append-only by construction, and that needs the
// synchronous SQLite class, as the limiter does.
check(
  "The tool-call log is registered as a new_sqlite_classes migration",
  (config.migrations ?? []).some((m) => (m.new_sqlite_classes ?? []).includes("ToolCallLog")),
  "Rule 12.4: every tool call is logged, append-only.",
);

// ONE PUBLIC ADDRESS. Tokens are bound to PUBLIC_ORIGIN + /mcp, so a second
// host would be a second resource nobody configured.
check(
  "workers.dev is off and the one route is the admin-mcp custom domain",
  config.workers_dev === false &&
    JSON.stringify(config.routes ?? []) ===
      JSON.stringify([{ pattern: "admin-mcp.dustinedwards.info", custom_domain: true }]),
  "The server answers at https://admin-mcp.dustinedwards.info only.",
);
check(
  "PUBLIC_ORIGIN names that custom domain",
  config.vars?.PUBLIC_ORIGIN === "https://admin-mcp.dustinedwards.info",
  `Found ${config.vars?.PUBLIC_ORIGIN}. The OAuth resource is PUBLIC_ORIGIN + /mcp.`,
);

// SITE_ORIGIN is a checked copy of the site's own constant, never a second
// source: read from app/lib/seo.ts here, compared, and a drift fails.
{
  const seo = readFileSync(join(SITE_ROOT, "app/lib/seo.ts"), "utf8");
  const siteOrigin = (seo.match(/export const SITE_ORIGIN = "([^"]+)"/) ?? [])[1];
  check(
    "SITE_ORIGIN equals SITE_ORIGIN in app/lib/seo.ts",
    Boolean(siteOrigin) && config.vars?.SITE_ORIGIN === siteOrigin,
    `wrangler config says ${config.vars?.SITE_ORIGIN}, app/lib/seo.ts says ${siteOrigin}.`,
  );
}

check(
  "the old public operator URL var is gone",
  config.vars?.OPERATOR_API_URL === undefined,
  "The API leg is the SITE binding now; a URL var would be a second route.",
);

// The deploy target must never be the conformance test entry, which mounts the
// handler with the client leg and the limiter removed.
check(
  "main is the production entry, not the conformance test entry",
  config.main === "src/index.ts",
  `Found main=${config.main}. test/conformance-entry.ts is a gate harness and must never deploy.`,
);

// CIMD needs this flag, and it is what the measured client actually uses.
check(
  "global_fetch_strictly_public is enabled for CIMD",
  (config.compatibility_flags ?? []).includes("global_fetch_strictly_public"),
);

// ---------------------------------------------------------------------------
// B. Credentials and vars the wrapper must never hold.
// ---------------------------------------------------------------------------

// GITHUB_TOKEN is the app's repository WRITE credential. If the wrapper held it,
// it could commit directly and bypass every gate, which is precisely the second
// write path the law forbids. The wrapper holds no GitHub credential at all.
const FORBIDDEN_NAMES = [
  "GITHUB_TOKEN",
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "AI_SEARCH",
  "ASK_BUDGET",
  "APP_KV",
];

const configText = readFileSync(configSource.path, "utf8");
for (const name of FORBIDDEN_NAMES) {
  check(
    `wrangler.jsonc does not reference ${name}`,
    !configText.includes(name),
    `${name} belongs to the app, not to the wrapper.`,
  );
  for (const f of files) {
    check(
      `src/${f.name} does not reference ${name}`,
      !withoutComments(f.text).includes(name),
      `${name} belongs to the app, not to the wrapper.`,
    );
  }
}

// ---------------------------------------------------------------------------
// C. No shared code with the app, with ONE named exception.
// ---------------------------------------------------------------------------

/*
 * THE ONE APP MODULE THE WORKER IMPORTS: the watchdog's repair plan. Since the
 * move the two live in one repository, and the site's first principle is that
 * a fact is stored once. Which failing health check is converged by which
 * operator repair, and in what order, is that kind of fact: dei_repair_drift
 * restating it would be a second copy that drifts from the watchdog's. The
 * module is pure (no binding, no fetch, no import but its pure sibling), it
 * carries no policy about what is ALLOWED, only which repair converges which
 * store, and every repair it names still goes through the operator API.
 */
const APP_IMPORTS = { "tools.ts": ["../../app/lib/health/repair.mjs"] };
for (const [file, specs] of Object.entries({ "repair.mjs": "app/lib/health/repair.mjs", "ask-converge.mjs": "app/lib/health/ask-converge.mjs" })) {
  const text = readFileSync(join(SITE_ROOT, specs), "utf8");
  const imports = [...withoutComments(text).matchAll(/^\s*import[\s\S]*?from\s*["']([^"']+)["']/gm)].map((m) => m[1]);
  check(
    `the imported app module ${file} imports nothing but its pure sibling`,
    imports.every((spec) => spec === "./ask-converge.mjs"),
    `Found imports: ${imports.join(", ")}. The one shared module must stay pure.`,
  );
  check(
    `the imported app module ${file} touches no binding and fetches nothing`,
    !/\benv\.|fetch\(/.test(codeOnly(text)),
    "A binding or a fetch in shared code would be a second route to the app.",
  );
}

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

// ---------------------------------------------------------------------------
// D. Outbound reach. Every network destination is deliberate.
// ---------------------------------------------------------------------------

// The Access sign-in host is built from the ACCESS_TEAM_DOMAIN var, so no
// login host appears as a literal. The operator API is reached through the
// OPERATOR_API_URL var rather than a literal, so a hardcoded app URL fails here.
const ALLOWED_HOSTS = ["rate-limit.invalid", "tool-call-log.invalid"];
const URL_RE = /https?:\/\/([a-z0-9.-]+)/gi;
for (const f of files) {
  for (const m of readFileSync(join(SRC, f.name), "utf8").matchAll(URL_RE)) {
    const host = m[1].toLowerCase();
    // Documentation links in comments are fine, so comments are stripped, but
    // the host lives in a STRING literal and codeOnly() would delete it. That
    // mistake let a planted exfiltration host through undetected.
    if (!withoutComments(f.text).includes(host)) continue;
    check(
      `src/${f.name} outbound host ${host} is allowlisted`,
      ALLOWED_HOSTS.includes(host),
      "Add it to ALLOWED_HOSTS here only if it is genuinely required, and say why.",
    );
  }
}

check(
  "The operator API is addressed only as SITE_ORIGIN + /api/operator, over SITE, in api-client.ts",
  files.every((f) => f.name === "api-client.ts" || !withoutComments(f.text).includes("/api/operator")) &&
    /env\.SITE\.fetch\(`\$\{env\.SITE_ORIGIN\}\/api\/operator`/.test(
      withoutComments(files.find((f) => f.name === "api-client.ts")?.text ?? ""),
    ),
  "A literal host would survive a config change and reach the wrong environment.",
);

// ---------------------------------------------------------------------------
// E. The tool surface mirrors the API and nothing more.
// ---------------------------------------------------------------------------

const toolsText = readFileSync(join(SRC, "tools.ts"), "utf8");
/*
 * THE NINE TOOLS, ruling mcp-2026-10-10 and capsid/research/design-mcp-servers.md
 * section 6. Whole jobs, each prefixed dei_, regrouped from the eleven one-call
 * tools of the separate repo, with the four post tools removed (Carrel owns
 * writing, rule 11).
 */
const EXPECTED_TOOLS = [
  "dei_check_site",
  "dei_repair_drift",
  "dei_review_mentions",
  "dei_decide_mention",
  "dei_upload_media",
  "dei_backup_media",
  "dei_read_registry",
  "dei_refresh_citations",
  "dei_check_publications",
  "dei_manage_procedure",
];
const declared = [...toolsText.matchAll(/^\s{4}name:\s*"([a-z_]+)",$/gm)].map((m) => m[1]);

check(
  "The declared tools are exactly the ten dei_ tools",
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
const apiList = descriptors.slice(descriptors.indexOf("const TOOLS = ["), descriptors.indexOf("] as const;"));
const API_TOOLS = [...apiList.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
check("the operator API's tool list was read", API_TOOLS.length > 10, `Read ${API_TOOLS.length} names.`);

const toolStrings = withoutComments(toolsText);
const named = new Set([
  ...[...toolStrings.matchAll(/\b(?:run|runPaged|callOperator)\(env,\s*"([a-z_]+)"/g)].map((m) => m[1]),
  ...[...toolStrings.matchAll(/\b(?:list|get):\s*"([a-z_]+)"/g)].map((m) => m[1]),
]);
const repairText = readFileSync(join(SITE_ROOT, "app/lib/health/repair.mjs"), "utf8");
const repairBlock = repairText.slice(repairText.indexOf("REPAIRABLE"), repairText.indexOf("});"));
for (const m of withoutComments(repairBlock).matchAll(/:\s*"([a-z_]+)"/g)) named.add(m[1]);

for (const name of named) {
  check(`operator tool ${name} is one the API offers`, API_TOOLS.includes(name), "A tool the API does not offer would be a policy decision made here.");
}

// NO POST WRITING, and no zero-result purge: neither is this server's job.
for (const name of ["list_posts", "get_post", "save_post", "delete_post", "purge_zero_results"]) {
  check(`the wrapper never calls ${name}`, !named.has(name) && !toolStrings.includes(`"${name}"`), "Carrel owns writing (rule 11).");
}

// Every declared tool reaches the API through the one transport.
for (const name of EXPECTED_TOOLS) {
  const start = toolsText.indexOf(`name: "${name}",`);
  const next = toolsText.indexOf('\n    name: "', start + 1);
  const block = codeOnly(toolsText.slice(start, next === -1 ? undefined : next));
  check(
    `Tool ${name} reaches the API only through run, runPaged or callOperator`,
    /\b(run|runPaged|callOperator)\(env,/.test(block) && !/fetch\(/.test(block),
  );
}

/*
 * RULE 12, THE ONE DOOR. The MCP server registers every tool through
 * invokeTool, and invokeTool checks ownership and scope before it writes the
 * log or runs a handler. A registration that called tool.handler directly would
 * skip all three.
 */
{
  const handlerCode = codeOnly(readFileSync(join(SRC, "mcp-handler.ts"), "utf8"));
  check(
    "every tool is registered through invokeTool",
    /invokeTool\(env, caller, tool, args/.test(handlerCode) && !/tool\.handler\(/.test(handlerCode),
    "Rule 12: ownership, scope and the log are in invokeTool; a direct handler call skips them.",
  );
  const invoke = codeOnly(toolsText.slice(toolsText.indexOf("export async function invokeTool(")));
  const at = (re) => invoke.search(re);
  check(
    "invokeTool authorizes, then logs started, then runs the handler, then logs finished",
    at(/authorizeCall\(/) >= 0 &&
      at(/authorizeCall\(/) < at(/phase: "", caller: who/) &&
      at(/tool\.handler\(env, args\)/) > at(/authorizeCall\(/) &&
      (invoke.match(/appendAudit\(/g) ?? []).length === 3,
    "Rule 12.1 and 12.4: refuse first, log every call, never run unlogged.",
  );
  const authCodeOnly = codeOnly(readFileSync(join(SRC, "auth.ts"), "utf8"));
  check(
    "authorizeCall re-runs the administrator check on every call",
    /caller\.kind === "" && !isAdminUser\(env, caller\.props\)/.test(authCodeOnly),
    "Rule 12.1: the per-call ownership proof. test/tools.test.ts plants its removal.",
  );
}

// The API leg's credential is confined to the module that owns it.
const tokenHolders = files.filter((f) => withoutComments(f.text).includes("OPERATOR_TOKEN")).map((f) => f.name);
check(
  "OPERATOR_TOKEN appears only in api-client.ts",
  JSON.stringify(tokenHolders) === JSON.stringify(["api-client.ts"]),
  `Found in: ${tokenHolders.join(", ") || "(nowhere)"}. The API leg has one owner.`,
);

// The API leg has one definition and one consumer. api-client.ts defines
// callOperator; tools.ts is the only module allowed to invoke it. Spreading the
// call across modules would mean several places knew how to reach the app, which
// is how a second write path starts.
const callers = files
  .filter((f) => f.name !== "api-client.ts" && /callOperator\s*\(/.test(codeOnly(f.text)))
  .map((f) => f.name);
check(
  "callOperator has exactly one consumer, tools.ts",
  JSON.stringify(callers) === JSON.stringify(["tools.ts"]),
  `Called from: ${callers.join(", ") || "(nowhere)"}. The API leg is one seam with one consumer.`,
);

check(
  "Only api-client.ts fetches over the SITE binding",
  files.every((f) => f.name === "api-client.ts" || !/SITE\.fetch\(/.test(codeOnly(f.text))),
);

// ---------------------------------------------------------------------------
// F. No policy DECISIONS. Describing a policy is required; enforcing one is not.
// ---------------------------------------------------------------------------

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
  "dei_manage_procedure's description states the first-publish policy",
  /first-publish-requires-admin/.test(toolBlock("dei_manage_procedure")),
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
const FORBIDDEN_GATE_MARKERS = ["frontmatterSchema", "wideDash", "publiclyVisible", "renderPost", "savePost("];
for (const f of files) {
  for (const marker of FORBIDDEN_GATE_MARKERS) {
    check(
      `src/${f.name} does not re-implement the app's ${marker} gate`,
      !withoutComments(f.text).includes(marker),
      "The gates run server side in the app. There is exactly one copy of each.",
    );
  }
}

// ---------------------------------------------------------------------------
// G. The legacy shim stays isolated and keeps its removal condition.
// ---------------------------------------------------------------------------

const legacyPath = join(SRC, "legacy-era.ts");
let legacyText = "";
try {
  legacyText = readFileSync(legacyPath, "utf8");
} catch {
  legacyText = "";
}

if (legacyText) {
  check(
    "The legacy shim documents its removal condition",
    /REMOVAL CONDITION/.test(legacyText) && /probe-report/.test(legacyText),
    "A shim without a stated removal condition becomes permanent by default.",
  );
  // Counting FILES was wrong: two calls inside one file kept the count at 1 and a
  // planted second call site went undetected. Count the calls themselves.
  const callSites = files
    .filter((f) => f.name !== "legacy-era.ts")
    .flatMap((f) =>
      [...codeOnly(f.text).matchAll(/createLegacyEraHandler\s*\(/g)].map(() => f.name),
    );
  check(
    "The legacy shim has exactly one call site",
    callSites.length === 1,
    `Call sites: ${callSites.join(", ") || "(none)"}. More than one and it is no longer a seam.`,
  );
  // These are STRING option values, so comments are stripped but literals are
  // kept. Reading the raw file instead would let the module header's prose
  // satisfy the assertion, which is exactly how a planted era switch survived.
  const legacyCode = withoutComments(readFileSync(legacyPath, "utf8"));
  const handlerCode = withoutComments(readFileSync(join(SRC, "mcp-handler.ts"), "utf8"));

  check(
    'Only the shim serves prior-era traffic (legacy: "stateless" appears once, in the shim)',
    (legacyCode.match(/legacy:\s*"stateless"/g) ?? []).length === 1 &&
      files
        .filter((f) => f.name !== "legacy-era.ts")
        .every((f) => !/legacy:\s*"stateless"/.test(withoutComments(f.text))),
    'The primary handler must be legacy: "reject" so deleting the shim leaves a modern-only server.',
  );
  check(
    'The primary handler is modern-only (legacy: "reject")',
    /legacy:\s*"reject"/.test(handlerCode) && !/legacy:\s*"stateless"/.test(handlerCode),
  );
}

// ---------------------------------------------------------------------------
// H. The client leg serves BOTH measured identity paths.
// ---------------------------------------------------------------------------

// Each of these is a measured requirement of a real client, not a preference.
// Removing either would lock out a client that was watched needing it, so both
// are asserted to STAY. The dates are the captures to argue with.
const indexText = files.find((f) => f.name === "index.ts")?.text ?? "";

// The option and its boolean are executable code, so codeOnly() applies; this
// file's own comments discuss the option by name and must not satisfy it.
check(
  "CIMD stays enabled (claude.ai, measured 2026-07-30, never calls /register)",
  /clientIdMetadataDocumentEnabled:\s*true/.test(codeOnly(indexText)),
  "claude.ai identifies itself by a client metadata URL. Without CIMD it cannot connect.",
);

// "/register" is a STRING option value, so withoutComments() keeps it while
// still refusing to let the comment block above the option satisfy the check.
check(
  'DCR stays configured at "/register" (Grok Build 1.0.13 rmcp, measured 2026-09-07)',
  /clientRegistrationEndpoint:\s*"\/register"/.test(withoutComments(indexText)),
  "Grok's rmcp client cannot do CIMD; without RFC 7591 registration it cannot " +
    "mint a client identity and stops before opening a browser.",
);

// RULE 13, TIGHTENED. The registration endpoint stays, and every registration
// passes the exact redirect allowlist and a per-address rate limit first.
check(
  "every registration passes the exact redirect allowlist",
  /clientRegistrationCallback:[\s\S]*registrationRefusal\(env\.DCR_REDIRECT_URIS, clientMetadata\)/.test(codeOnly(indexText)),
  "Rule 13: redirect URIs allowlisted exactly; an unchecked registration is the deprecated DCR.",
);
check(
  "registration is rate limited per address before the provider sees it",
  /url\.pathname === "\/register"/.test(withoutComments(indexText)) &&
    /checkRateLimit\(env, `register:\$\{ip\}`, REGISTRATIONS_PER_MINUTE\)/.test(withoutComments(indexText)),
  "Rule 13: registration rate limited.",
);
check(
  "registrationRefusal matches exactly (includes), never by prefix",
  /!allowed\.includes\(uri\)/.test(codeOnly(readFileSync(join(SRC, "registration.ts"), "utf8"))) &&
    !/startsWith|endsWith|indexOf/.test(codeOnly(readFileSync(join(SRC, "registration.ts"), "utf8"))),
  "A prefix match on a redirect URI is how authorization codes are stolen.",
);

// RULE 12.2, AUDIENCE. The provider names this server's resource, which pins
// every grant and token to it (RFC 8707) and refuses a token issued for any other.
check(
  "access tokens are bound to PUBLIC_ORIGIN + /mcp",
  /resourceMetadata: \{\s*resource: `\$\{origin\}\$\{MCP_ROUTE\}`/.test(withoutComments(indexText)),
  "Rule 12.2: reject any token not issued for this server.",
);

// --- the agent key path, ruling 37 -----------------------------------------

/*
 * A SECOND DOOR IS THE MOST DANGEROUS THING IN THIS REPO, so it is asserted
 * harder than the first. The law does not forbid it: an agent key is client-leg
 * IDENTITY, the same category as an OAuth grant, and it changes who may ASK
 * rather than what the answer is. What the law does forbid is a second door
 * that reaches the publish machinery by a different route, or that carries any
 * right the first one does not.
 */
/*
 * TWO VIEWS OF THE SAME SOURCE, and the choice per assertion is deliberate.
 *
 * `codeOnly` blanks every string and template literal, which is right for
 * STRUCTURE (is the admin check called, is there a second handleMcp) and wrong
 * for anything whose subject IS a string: the audit key, the rate-limit
 * identity, `rights: "operator"`. Those need `withoutComments`, which keeps
 * string values and still refuses to let this file's own prose satisfy a check.
 * That is the same split the `/register` assertion above makes, for the same
 * reason, and getting it backwards cost five failing assertions on the first
 * run of this block.
 */
const authText = files.find((f) => f.name === "auth.ts")?.text ?? "";
const authCode = codeOnly(authText);
const indexCode = codeOnly(indexText);
const authStrings = withoutComments(authText);
const indexStrings = withoutComments(indexText);

check(
  "the agent key path is scoped to the MCP route",
  /url\.pathname === MCP_ROUTE/.test(indexCode),
  "An agent key is an alternative to HOLDING a grant, not to the protocol " +
    "around one. Widened past /mcp it would sit in front of the consent flow " +
    "and the token endpoint, which are the provider's.",
);

check(
  "the agent path reaches the tool surface through the SAME handleMcp",
  (indexCode.match(/handleMcp\(request, env, ctx, \{ kind:/g) ?? []).length === 2,
  "Two handlers would be two places the tool surface is defined, and the first " +
    "time they disagreed one door would offer something the other did not. " +
    "Expected exactly two call sites: the OAuth one and the agent one.",
);

check(
  "the agent path is rate limited under its own identity",
  /checkRateLimit\(env, `agent:\$\{principal\}`\)/.test(indexStrings),
  "Sharing the operator's bucket would let one agent rate limit Dustin out of " +
    "his own server. Both doors have locks, and they are different locks.",
);

check(
  "the principal comes from the matched SECRET NAME, never from the request",
  /*
   * THE CHAIN, not the absence of a word. The first version asserted that
   * "principal" appeared nowhere before the `agentPrincipal(` call, which is
   * false for an innocent reason: `agentHandler` declares a `principal`
   * parameter above the call site, so the assertion failed on correct code.
   *
   * What matters is where the value COMES FROM. `agentPrincipal` derives it
   * from the matched secret's NAME, and index.ts passes that return value
   * straight through to the handler. Nothing reads it off the request.
   */
  /name\.slice\(AGENT_KEY_PREFIX\.length\)/.test(authCode) &&
    /const principal = await agentPrincipal\(/.test(indexCode) &&
    /agentHandler\(request, env, ctx, principal\)/.test(indexCode),
  "If a caller could name itself, the audit line would record whatever it " +
    "typed. The principal must be a property of WHICH configured secret the " +
    "presented key matched.",
);

check(
  "an empty or blank agent secret cannot match",
  /typeof value !== "string" \|\| !value\.trim\(\)/.test(authStrings),
  "A secret accidentally set to the empty string would otherwise become a key " +
    "that any bearer satisfies. Fail closed.",
);

check(
  "the agent comparison goes through secretsMatch, never a string compare",
  /await secretsMatch\(presented, value\)/.test(authCode),
  "A raw compare leaks the secret's length through the loop bound. " +
    "secretsMatch hashes both sides to a fixed 32 bytes first.",
);

/*
 * THE AUDIT LINE, AND WHAT IT MUST NOT CARRY. The principal is the point of the
 * line; the negative half matters more, because a log carrying the key would
 * move a secret into a sink nobody treats as one.
 */
check(
  "the audit line records the principal",
  /audit: "agent-key-accepted"/.test(indexStrings) && /principal,/.test(indexStrings),
  "Ruling 37: the call is logged as its own principal. Without it the second " +
    "door is indistinguishable from the first in the logs.",
);

check(
  "the audit line carries no key material",
  !/authorization/i.test(
    indexStrings.slice(
      indexStrings.indexOf('audit: "agent-key-accepted"'),
      indexStrings.indexOf("checkRateLimit(env, `agent:"),
    ),
  ),
  "The Authorization header, the key, or any slice or length of it must never " +
    "reach a log line.",
);

/*
 * THE REFUSAL THE RULING NAMES, asserted where this Worker can carry it: it
 * does not implement first-publish policy and must not start.
 *
 * "First publish stays Dustin's" is enforced by the operator API, which grants
 * OPERATOR_TOKEN `{ kind: "operator" }` and refuses first publication on that
 * actor kind. The wrapper's job is to have no opinion, so what is asserted here
 * is that the agent door introduces no second credential and no claim to admin.
 */
check(
  "the agent path mints no credential of its own",
  !/OPERATOR_TOKEN/.test(indexCode),
  "index.ts must never touch the API credential. If the agent door chose a " +
    "token, the API's actor kind would become this Worker's decision and " +
    "first-publish policy would move here with it.",
);

check(
  "no admin right is named on the agent path, and operator is",
  !/isAdminUser\([^)]*principal/.test(indexCode) && /rights: "operator"/.test(indexStrings),
  "Ruling 37: operator rights only, never admin. The agent path must not " +
    "consult the admin check at all, because passing it would be the bug.",
);

// ---------------------------------------------------------------------------

console.log(`\ncheck:wrapper: ${assertions - failures}/${assertions} assertions passed`);
if (failures) {
  console.error(`\n${failures} failed. The wrapper's no-policy law is not currently provable.`);
  process.exit(1);
}
console.log(
  `The no-policy law holds: one pure app import, no app bindings, ${EXPECTED_TOOLS.length} tools, one API seam.`,
);

/*
 * PLANTED VIOLATIONS. See scripts/plant-violations.sh, which is the harness that
 * proves this gate actually fails. Run it with `npm run check:wrapper:plant`.
 *
 * A gate never observed failing has not been verified, and that applies to the
 * HARNESS too. The first attempt at this reverted with `git checkout -- .`, which
 * does not touch untracked files, so each plant's residue survived into the next
 * one and every result after the first was contaminated: they failed, but not
 * necessarily for the reason under test. The harness now snapshots and restores
 * the exact files it edits, so each plant is independent, and it verifies the
 * baseline is green again afterwards.
 *
 * That mistake also destroyed uncommitted work, which is the hazard
 * dustinedwards/workflow-mainline.md records as one of this project's recurring
 * failures. Commit before running a harness that reverts anything.
 */
