// The guards in front of what costs money or writes from outside, asserted on source: the Ask route
// refuses a GET, gates on origin, and refuses cheapest first; the origin predicate, the operator
// bearer and the JSON-LD helper are the ones every caller uses; and a draft can never reach the AI
// index. Moved out of check:policy, which keeps the publish policy itself.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments.mjs";
import { functionBody } from "./lib/source-body.mjs";

import { originVerdict } from "@dustinedwards/site-runtime/origin";
import { assertFloor } from "@dustinedwards/devkit/node";
import { createTally } from "@dustinedwards/devkit/node";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const tally = createTally({ print: false });
const { eq } = tally;

/* ASK IS BILLED, so no GET: a crawler, prefetch, unfurler or img src issues one unasked. */
{
  const askRoute = readFileSync(join(root, "app/routes/search.ask.ts"), "utf8");
  /* Stripped for every assertion: a comment naming request.formData() would satisfy one. */
  const askCode = stripComments(askRoute);

  eq(
    "ask: the route exports an action",
    /export\s+async\s+function\s+action\b/.test(askCode),
    true,
  );

  const loaderAt = askCode.search(/export\s+function\s+loader\s*\(/);
  eq("ask: the route exports a loader", loaderAt !== -1, true);
  /* The loader's own body, not a 400-character window that a longer loader outgrows. */
  const loaderBody = functionBody(askCode, /export\s+function\s+loader\s*\(/);
  eq("ask: the loader refuses with 405", /status:\s*405/.test(loaderBody), true);
  eq("ask: the refusal names the allowed method", /allow:\s*"POST"/.test(loaderBody), true);

  /* And the question is read from the BODY, or a restored loader bills on a hand-made GET. */
  eq(
    "ask: the question is read from the request body, to a ceiling",
    /readForm\(\s*request\s*,/.test(askCode),
    true,
  );
  eq(
    "ask: the question is not read from the query string",
    /searchParams\.get\("q"\)/.test(askCode),
    false,
  );

  /* THE ORIGIN GATE, AND ITS POSITION IS THE ASSERTION: a hostile page spends the shared budget. */
  const actionAt = askCode.search(/export\s+async\s+function\s+action\s*\(/);
  eq("ask: the action was located for the order check", actionAt !== -1, true);
  const actionBody = actionAt === -1 ? "" : askCode.slice(actionAt);
  eq("ask: the action body is non-empty", actionBody.length > 200, true);

  const originAt = actionBody.indexOf("refuseCrossSite(");
  const rateAt = actionBody.indexOf("checkAskRate(");
  eq("ask: the action takes an origin verdict", originAt !== -1, true);
  eq("ask: the action still rate limits", rateAt !== -1, true);
  eq(
    "ask: THE ORIGIN CHECK RUNS BEFORE THE RATE LIMITER",
    originAt !== -1 && rateAt !== -1 && originAt < rateAt,
    true,
  );
  /* Rate, then cache, then budget, then model: presence passes on any arrangement, and the ORDER is
     the property, cheapest refusing first. */
  const cacheAt = actionBody.indexOf("readCachedAnswer(");
  const budgetAt = actionBody.indexOf("reserveAskBudget(");
  const modelAt = actionBody.indexOf("askStream(");

  eq("ask: the action reads the answer cache", cacheAt !== -1, true);
  eq("ask: the action reserves daily budget", budgetAt !== -1, true);
  eq("ask: the action reaches a model", modelAt !== -1, true);

  eq(
    "ask: THE RATE LIMITER RUNS BEFORE THE CACHE READ",
    rateAt !== -1 && cacheAt !== -1 && rateAt < cacheAt,
    true,
  );
  eq(
    "ask: THE CACHE READ RUNS BEFORE THE BUDGET RESERVATION",
    cacheAt !== -1 && budgetAt !== -1 && cacheAt < budgetAt,
    true,
  );
  eq(
    "ask: THE BUDGET RESERVATION RUNS BEFORE THE MODEL CALL",
    budgetAt !== -1 && modelAt !== -1 && budgetAt < modelAt,
    true,
  );

  for (const [label, routePath] of [
    ["ask", "app/routes/search.ask.ts"],
    ["theme", "app/routes/theme.ts"],
    ["the admin plane", "app/routes/admin.tsx"],
    ["the lab plane", "app/routes/workspace.tsx"],
  ]) {
    const code = stripComments(readFileSync(join(root, routePath), "utf8"));
    eq(
      `origin: ${label} refuses a cross-site request with the shared check`,
      /from\s+"@dustinedwards\/site-runtime\/origin"/.test(code) &&
        /refuseCrossSite\(\s*request\b/.test(code),
      true,
    );
  }

  /* AND THE ABSENT-ORIGIN EXEMPTION SURVIVES: a scriptless form post carries none, the progressive-enhancement rule.
     The predicate is site-runtime's, so it is checked by calling it rather than by reading its source. */
  for (const absent of [null, undefined, ""]) {
    eq(
      `origin: an absent Origin (${JSON.stringify(absent) ?? "undefined"}) is allowed by the predicate`,
      originVerdict(absent, "https://dustinedwards.info/ask").ok,
      true,
    );
  }

  {
    const auth = stripComments(readFileSync(join(root, "app/lib/operator/auth.server.ts"), "utf8"));
    const body = auth.slice(auth.indexOf("export async function authenticateOperator"));
    const lengthGate = body.indexOf("presented.length > configured.length");
    const hash = body.indexOf("safeEqual(");
    eq("operator: an over-long bearer is refused on length", lengthGate !== -1, true);
    eq("operator: the token is still compared in constant time", hash !== -1, true);
    eq(
      "operator: the length refusal comes BEFORE the hash",
      lengthGate !== -1 && hash !== -1 && lengthGate < hash,
      true,
    );

    const route = stripComments(readFileSync(join(root, "app/routes/api.operator.ts"), "utf8"));
    const loader = route.slice(route.indexOf("export async function loader"));
    const action = route.slice(
      route.indexOf("export async function action"),
      route.indexOf("export async function loader"),
    );
    eq("operator: the POST path meters", /meterOperator\(/.test(action), true);
    eq("operator: GET describe does NOT meter", /meterOperator\(/.test(loader), false);
    eq("operator: GET describe still authenticates", /authenticateOperator\(/.test(loader), true);
  }

  {
    const routeDir = join(root, "app/routes");
    /** @type {string[]} */
    const bare = [];
    let scanned = 0;
    for (const name of readdirSync(routeDir).filter((f) => f.endsWith(".tsx"))) {
      const code = stripComments(readFileSync(join(routeDir, name), "utf8"));
      // Capsomer's JsonLd (capsomer/react/json-ld) escapes through Prelum's jsonLdText and sets the text
      // through the Trusted Types policy; a route that writes its own ld+json script bypasses both.
      if (code.includes("<JsonLd")) scanned += 1;
      if (code.includes("ld+json")) bare.push(name);
    }
    eq("json-ld: the scan found the emitters at all", scanned >= 4, true);
    eq(
      `json-ld: no emitter bypasses Capsomer's JsonLd (${bare.join(", ") || "none"})`,
      bare.length === 0,
      true,
    );
  }

  /* Stripped: a comment naming the rule would otherwise stand in for it. Prelum's robotsDocument writes each path in
     the `disallow` list workers/app.ts hands standardFiles into every group; the list is ROBOTS_DISALLOW in app/lib/seo.ts,
     which /ai.txt shares. */
  const robots = stripComments(readFileSync(join(root, "workers/app.ts"), "utf8"));
  const seo = stripComments(readFileSync(join(root, "app/lib/seo.ts"), "utf8"));
  eq(
    "ask: robots.txt disallows /search/ask",
    /disallow:\s*ROBOTS_DISALLOW\b/.test(robots) &&
      /ROBOTS_DISALLOW\s*=\s*\[[^\]]*"\/search\/ask"/.test(seo),
    true,
  );
}

/*
 * Drafts must never reach the AI index: Ask cannot filter at query time, so the corpus query AI Search runs excludes
 * them. Its visibility is the shared SQL rule (visibilityClause, whose equivalence to publiclyVisible
 * test/visibility-invariants.test.mjs proves) with the database's clock, since the query binds nothing;
 * test/worker/visibility.test.ts runs it on a database holding a draft and a scheduled post.
 */
{
  const searchRaw = readFileSync(join(root, "app/lib/search/search.server.ts"), "utf8");
  /* Comments stripped before matching: a comment describing a removed filter would satisfy it. */
  const searchSource = stripComments(searchRaw);
  const queryAt = searchSource.indexOf("export const ASK_INDEX_QUERY =");
  const query =
    queryAt === -1 ? "" : searchSource.slice(queryAt, searchSource.indexOf(";", queryAt));

  eq("ask index: ASK_INDEX_QUERY was found in search.server.ts", query.length > 200, true);
  eq(
    "ask index: its posts are type 'post' with the shared visibility rule on the database's clock",
    /WHERE type = 'post' AND `\s*\+\s*visibilityClause\(\s*NO_ALIAS\s*,\s*"unixepoch\(\)"\s*\)/.test(
      query,
    ),
    true,
  );
  eq(
    "ask index: its papers are the published ones only",
    /FROM publications WHERE status = '\$\{PUBLISHED_STATUS\}'/.test(query),
    true,
  );
  eq(
    "ask index: nothing else selects into it (search_docs, publications and the paper parts twice)",
    (query.match(/\bFROM\b/g) ?? []).length,
    4,
  );
}

/* Measured by running this gate, and it moves with the measurement: slack is the defect. */
const MINIMUM_CHECKS = 37;
const floorBreach = assertFloor("check:ask-guards", "checks", tally.checks, MINIMUM_CHECKS);
if (floorBreach) tally.fail(floorBreach);

if (tally.failures > 0) {
  console.error(`check:ask-guards FAILED, ${tally.failures} of ${tally.checks} checks:\n`);
  for (const f of tally.failed) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check:ask-guards ok. ${tally.checks} assertions, 0 failures.`);
