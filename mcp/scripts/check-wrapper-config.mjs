/** check:wrapper, parts A and B: the wrangler config's bindings are an allowlist, and no app credential is named. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SITE_ROOT,
  check,
  config,
  configSource,
  files,
  withoutComments,
} from "./check-wrapper-gate.mjs";

// one thing it must not have.
const FORBIDDEN_BINDING_KEYS = [
  "d1_databases",
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

// The one R2 bucket is the tool-call log's own copies (checklist L6-L7), never one of the site's.
const actualR2 = (config.r2_buckets ?? []).map((b) => `${b.binding}:${b.bucket_name}`).sort();
check(
  "the only R2 bucket is AUDIT_BUCKET, the tool-call log's copies",
  JSON.stringify(actualR2) === JSON.stringify(["AUDIT_BUCKET:dustinedwards-admin-mcp-tool-calls"]),
  `Found ${actualR2.join(", ") || "(none)"}. A bucket of the site's would be a second route to its data.`,
);

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

// The limiter must be a SQLite-backed class. The async storage API is
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
// source: read from app/lib/site-origin.mjs here, compared, and a drift fails.
{
  const source = readFileSync(join(SITE_ROOT, "app/lib/site-origin.mjs"), "utf8");
  const siteOrigin = (source.match(/export const SITE_ORIGIN = "([^"]+)"/) ?? [])[1];
  check(
    "SITE_ORIGIN equals SITE_ORIGIN in app/lib/site-origin.mjs",
    Boolean(siteOrigin) && config.vars?.SITE_ORIGIN === siteOrigin,
    `wrangler config says ${config.vars?.SITE_ORIGIN}, app/lib/site-origin.mjs says ${siteOrigin}.`,
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

// CIMD needs this flag, and it is what the client actually uses.
check(
  "global_fetch_strictly_public is enabled for CIMD",
  (config.compatibility_flags ?? []).includes("global_fetch_strictly_public"),
);

// B. Credentials and vars the wrapper must never hold.

// GITHUB_TOKEN would be a repository WRITE credential. The site holds none
// (its content source is D1), and the wrapper must never hold one either: it could
// commit directly and bypass every gate, the second write path the law forbids.
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
