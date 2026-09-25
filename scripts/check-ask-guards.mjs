// The guards in front of what costs money or writes from outside, asserted on source: the Ask route
// refuses a GET, gates on origin, and refuses cheapest first; the origin predicate, the operator
// bearer and the JSON-LD helper are the ones every caller uses; and a draft can never reach the AI
// index. Moved out of check:policy, which keeps the publish policy itself.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments.mjs";
import { blockFrom, functionBody } from "./lib/source-body.mjs";

import { isPubliclyVisible, statusForDraft } from "../app/lib/search/visibility.mjs";
import { assertFloor } from "./lib/floor.mjs";
import { createTally } from "./lib/tally.mjs";

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
    "ask: the question is read from the request body",
    /request\.formData\(\)/.test(askCode),
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
  eq(
    "ask: the action body is non-empty",
    actionBody.length > 200,
    true,
  );

  const originAt = actionBody.indexOf("originVerdict(");
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

  eq(
    "ask: a refused origin is answered 403",
    /status:\s*403/.test(actionBody),
    true,
  );
  eq(
    "ask: the origin predicate is imported, not restated here",
    /from\s+"~\/lib\/origin\.mjs"/.test(askCode),
    true,
  );

  for (const [label, routePath] of [
    ["theme", "app/routes/theme.ts"],
    ["the admin plane", "app/routes/admin.tsx"],
  ]) {
    const code = stripComments(readFileSync(join(root, routePath), "utf8"));
    eq(
      `origin: ${label} imports the shared predicate`,
      /from\s+"~\/lib\/origin\.mjs"/.test(code),
      true,
    );
    eq(`origin: ${label} calls originVerdict`, /originVerdict\(/.test(code), true);
    eq(
      `origin: ${label} refuses with 403`,
      /status:\s*403/.test(code),
      true,
    );
  }

  /* AND THE ABSENT-ORIGIN EXEMPTION SURVIVES: a scriptless form post carries none, the progressive-enhancement rule. */
  {
    const predicate = stripComments(readFileSync(join(root, "app/lib/origin.mjs"), "utf8"));
    const absent = /if\s*\(\s*origin\s*===\s*null\s*\|\|\s*origin\s*===\s*undefined\s*\|\|\s*origin\s*===\s*""\s*\)/.exec(
      predicate,
    );
    eq(
      "origin: an absent Origin is allowed by the predicate",
      absent !== null && /ok:\s*true/.test(blockFrom(predicate, absent.index)),
      true,
    );
  }

  {
    const auth = stripComments(
      readFileSync(join(root, "app/lib/operator/auth.server.ts"), "utf8"),
    );
    const body = auth.slice(auth.indexOf("export async function authenticateOperator"));
    const lengthGate = body.indexOf("presented.length > configured.length");
    const hash = body.indexOf("constantTimeEqual(");
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
      if (!code.includes("ld+json")) continue;
      scanned += 1;
      let at = code.indexOf("ld+json");
      while (at !== -1) {
        const window = code.slice(at, at + 400);
        if (/dangerouslySetInnerHTML/.test(window) && /JSON\.stringify\(/.test(window)) {
          bare.push(name);
        }
        at = code.indexOf("ld+json", at + 1);
      }
    }
    eq("json-ld: the scan found the emitters at all", scanned >= 4, true);
    eq(
      `json-ld: no emitter bypasses the helper (${bare.join(", ") || "none"})`,
      bare.length === 0,
      true,
    );
  }

  /* Stripped: a comment naming the rule would otherwise stand in for it. */
  const robots = stripComments(readFileSync(join(root, "app/routes/robots.ts"), "utf8"));
  eq(
    "ask: robots.txt disallows /search/ask",
    /Disallow: \/search\/ask/.test(robots),
    true,
  );
}

/** Drafts must never reach the AI index: Ask cannot filter at query time, so exclude at upload. */
{
  const now = Date.parse("2026-07-29T12:00:00.000Z");
  /*
   * The composition publishableForAsk is asserted below to be, run on the shared owners of the rule,
   * so these cases exercise the production predicate rather than a copy defined here.
   */
  /** @param {{draft?: boolean, publishAt?: string|null}} p */
  const publishable = (p) =>
    isPubliclyVisible({ status: statusForDraft(p.draft), publishAt: p.publishAt }, now);

  eq("a draft is not Ask-publishable", publishable({ draft: true }), false);
  eq("a published post is Ask-publishable", publishable({ draft: false }), true);
  eq(
    "a future-dated post is not Ask-publishable",
    publishable({ draft: false, publishAt: "2099-01-01T00:00:00.000Z" }),
    false,
  );
  eq(
    "a past-dated post is Ask-publishable",
    publishable({ draft: false, publishAt: "2020-01-01T00:00:00.000Z" }),
    true,
  );
  // The withdrawn case leaks silently: an indexed post set back to draft must be REMOVED.
  eq(
    "a withdrawn post is not Ask-publishable",
    publishable({ draft: true, publishAt: "2020-01-01T00:00:00.000Z" }),
    false,
  );

  const askRaw = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "app", "lib", "search", "ask.server.ts"),
    "utf8",
  );
  const searchRaw = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "app", "lib", "search", "search.server.ts"),
    "utf8",
  );

  /* Comments stripped before matching: a comment describing a removed filter would satisfy the count. */
  const askSource = stripComments(askRaw);
  const searchSource = stripComments(searchRaw);

  eq(
    "stripping comments left the module's code behind",
    askSource.length > askRaw.length / 4 && /export async function syncAskCorpus/.test(askSource),
    true,
  );

  eq(
    "syncAskCorpus sources its records from askCorpusRecords",
    /const records = await askCorpusRecords\(env\)/.test(askSource),
    true,
  );
  eq(
    "askCorpusRecords composes visibilityClause beside type='post'",
    /SELECT url, title, body FROM search_docs WHERE type = 'post' AND\s*`\s*\+\s*visibilityClause\(\s*NO_ALIAS\s*\)/.test(
      searchSource,
    ),
    true,
  );
  eq(
    "syncAskPost refuses a non-publishable post",
    /askPublishable\(post\)\s*\?\s*recordsForPosts\(\[post\]\)\s*:\s*\[\]/.test(askSource),
    true,
  );

  const askAt = askSource.search(/function publishableForAsk\b/);
  eq("publishableForAsk exists in ask.server.ts", askAt !== -1, true);

  const askBody = functionBody(askSource, /function publishableForAsk\b/);
  eq("publishableForAsk's body was extracted", askBody.length > 40, true);

  eq(
    "publishableForAsk composes isPubliclyVisible, the shared owner of the rule",
    /isPubliclyVisible\s*\(/.test(askBody),
    true,
  );
  eq(
    "publishableForAsk maps draft to status rather than testing draft itself",
    /statusForDraft\s*\(/.test(askBody) && !/\.draft\s*===/.test(askBody),
    true,
  );
  eq(
    "publishableForAsk does not restate the publish-date rule",
    !/Date\.parse\s*\([^)]*publishAt/.test(askBody),
    true,
  );

  const bodyOf = (/** @type {string} */ src, /** @type {string} */ name) => {
    const start = src.indexOf(`export async function ${name}(`);
    if (start === -1) return "";
    // To the first line that is exactly a closing brace, which is where a
    // top-level function ends in this codebase's formatting.
    const end = src.indexOf("\n}", start);
    return end === -1 ? src.slice(start) : src.slice(start, end + 2);
  };

  const statusBody = bodyOf(askSource, "askIndexStatus");

  eq(
    "the askIndexStatus body was extracted, and it is that function alone",
    statusBody.length > 80 &&
      statusBody.length < askSource.length / 4 &&
      !statusBody.includes("export function askStatusReader"),
    true,
  );

  eq(
    "askIndexStatus takes its expected set from askExpectedUrls",
    /askExpectedUrls\(env\)/.test(statusBody) &&
      /const expected = new Set\([\s\S]{0,200}\.map\(\(u\) => keyForUrl\(u\)\)/.test(statusBody),
    true,
  );
  eq(
    "askIndexStatus adds the papers from the corpus module, not from a query",
    /const expected = new Set\([\s\S]{0,200}paperItemKeys\(\)/.test(statusBody) &&
      !/DB\.prepare|search_docs/.test(statusBody),
    true,
  );

  eq(
    "askIndexStatus builds its expected set from no other producer",
    !/recordsForPosts\(/.test(statusBody),
    true,
  );
  /* Scoped to the function body: zeroState sits below and composes visibilityClause itself. */
  const expectedUrlsBody = bodyOf(searchSource, "askExpectedUrls");

  eq(
    "the askExpectedUrls body was extracted, and it is that function alone",
    expectedUrlsBody.length > 80 &&
      expectedUrlsBody.length < searchSource.length / 4 &&
      !expectedUrlsBody.includes("export async function zeroState"),
    true,
  );

  eq(
    "askExpectedUrls composes visibilityClause rather than hand-copying it",
    expectedUrlsBody.includes("visibilityClause(NO_ALIAS)"),
    true,
  );
  eq(
    "askExpectedUrls stays posts-only, or every page record reads as stale",
    expectedUrlsBody.includes("type = 'post'"),
    true,
  );
  eq(
    "askExpectedUrls binds seconds, the unit publish_at is stored in",
    expectedUrlsBody.includes("Math.floor(now.getTime() / 1000)"),
    true,
  );
}

/* Measured by running this gate, and it moves with the measurement: slack is the defect. */
const MINIMUM_CHECKS = 57;
const floorBreach = assertFloor("check:ask-guards", "checks", tally.checks, MINIMUM_CHECKS);
if (floorBreach) tally.fail(floorBreach);

if (tally.failures > 0) {
  console.error(`check:ask-guards FAILED, ${tally.failures} of ${tally.checks} checks:\n`);
  for (const f of tally.failed) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check:ask-guards ok. ${tally.checks} assertions, 0 failures.`);
