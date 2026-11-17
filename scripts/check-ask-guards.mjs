// The guards in front of what costs money or writes from outside, asserted on source. The operator publish
// policy and the admin plane's smoke and session guards that enforce it, every rule with its paired negative (a
// policy that only refuses has not been shown to permit anything); the Ask route refuses a GET, gates on origin
// and refuses cheapest first; the origin predicate, the operator bearer and the JSON-LD helper are the ones every
// caller uses; and a draft can never reach the AI index.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments.mjs";
import { functionBody } from "./lib/source-body.mjs";

import {
  decide,
  decideDelete,
  forceFirstPublished,
  readState,
  PolicyError,
  SMOKE_READ_ONLY_POLICY,
  WRITE_CAPABILITIES,
} from "../app/lib/editor/publish-policy.mjs";
import { originVerdict } from "@dustinedwards/site-runtime/origin";
import { assertFloor } from "@dustinedwards/devkit/node";
import { createTally } from "@dustinedwards/devkit/node";
import { walkFiles } from "@dustinedwards/devkit/node";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const tally = createTally({ print: false });
const { ok, eq } = tally;

/** @param {string} label @param {() => void} fn @param {string} policy */
function refuses(label, fn, policy) {
  let problem = "expected a PolicyError, got none";
  try {
    fn();
  } catch (error) {
    if (!(error instanceof PolicyError)) problem = `expected PolicyError, got ${error}`;
    else if (error.policy !== policy) problem = `expected policy ${policy}, got ${error.policy}`;
    else problem = "";
  }
  ok(`${label}\n    ${problem}`, problem === "");
}

/** @param {string} label @param {() => void} fn */
function permits(label, fn) {
  let problem = "";
  try {
    fn();
  } catch (error) {
    problem = `expected no error, got ${error}`;
  }
  ok(`${label}\n    ${problem}`, problem === "");
}

/** @param {{draft: boolean, firstPublished?: string | null}} o */
function file(o) {
  const lines = [
    "---",
    'title: "T"',
    "slug: t",
    'description: "D"',
    "date: 2026-07-28",
    "tags: [a]",
    `draft: ${o.draft}`,
  ];
  if (o.firstPublished) lines.push(`first_published: ${o.firstPublished}`);
  lines.push("---", "", "Body.", "");
  return lines.join("\n");
}

const OPERATOR = /** @type {const} */ ({ kind: "operator", id: "abcd1234" });
const ADMIN = /** @type {const} */ ({ kind: "admin" });
const SMOKE = /** @type {const} */ ({ kind: "smoke", id: "beef0001" });

eq("readState reads an unpublished draft", readState(file({ draft: true })), {
  draft: true,
  firstPublished: null,
});
eq(
  "readState reads a previously published post",
  readState(file({ draft: false, firstPublished: "2026-01-01" })),
  { draft: false, firstPublished: "2026-01-01" },
);
// The negative: a post withdrawn after publication is draft:true but HAS a date.
eq(
  "readState distinguishes a withdrawn post from a new draft",
  readState(file({ draft: true, firstPublished: "2026-01-01" })),
  { draft: true, firstPublished: "2026-01-01" },
);

eq(
  "forceFirstPublished adds the field when absent",
  readState(forceFirstPublished(file({ draft: false }), "2026-07-28")).firstPublished,
  "2026-07-28",
);
eq(
  "forceFirstPublished replaces a value already there",
  readState(forceFirstPublished(file({ draft: false, firstPublished: "2020-01-01" }), "2026-07-28"))
    .firstPublished,
  "2026-07-28",
);
eq(
  "forceFirstPublished removes the field when told to",
  readState(forceFirstPublished(file({ draft: true, firstPublished: "2020-01-01" }), null))
    .firstPublished,
  null,
);
{
  const out = forceFirstPublished(file({ draft: false }), "2026-07-28");
  eq("forceFirstPublished keeps the body", out.trimEnd().endsWith("Body."), true);
  eq("forceFirstPublished keeps other keys", out.includes("slug: t"), true);
  eq("forceFirstPublished keeps the draft flag", readState(out).draft, false);
}

refuses(
  "operator cannot publish a post that has never been published",
  () =>
    decide({
      actor: OPERATOR,
      incomingRaw: file({ draft: false }),
      priorRaw: file({ draft: true }),
    }),
  "first-publish-requires-admin",
);

refuses(
  "operator cannot create a post already published in one shot",
  () => decide({ actor: OPERATOR, incomingRaw: file({ draft: false }), priorRaw: null }),
  "first-publish-requires-admin",
);

// THE FORGERY CASE: the payload claims first_published; only the prior file is consulted.
refuses(
  "operator cannot forge first_published to bypass the gate",
  () =>
    decide({
      actor: OPERATOR,
      incomingRaw: file({ draft: false, firstPublished: "2020-01-01" }),
      priorRaw: file({ draft: true }),
    }),
  "first-publish-requires-admin",
);

refuses(
  "operator cannot forge first_published on a brand new post",
  () =>
    decide({
      actor: OPERATOR,
      incomingRaw: file({ draft: false, firstPublished: "2020-01-01" }),
      priorRaw: null,
    }),
  "first-publish-requires-admin",
);

permits("operator may create a draft", () =>
  decide({ actor: OPERATOR, incomingRaw: file({ draft: true }), priorRaw: null }),
);
permits("operator may edit an existing draft", () =>
  decide({ actor: OPERATOR, incomingRaw: file({ draft: true }), priorRaw: file({ draft: true }) }),
);
permits("operator may edit a live post", () =>
  decide({
    actor: OPERATOR,
    incomingRaw: file({ draft: false, firstPublished: "2026-01-01" }),
    priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
  }),
);
permits("operator may unpublish a live post", () =>
  decide({
    actor: OPERATOR,
    incomingRaw: file({ draft: true }),
    priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
  }),
);
permits("operator may REpublish a post it withdrew", () =>
  decide({
    actor: OPERATOR,
    incomingRaw: file({ draft: false }),
    priorRaw: file({ draft: true, firstPublished: "2026-01-01" }),
  }),
);

permits("admin may publish a post for the first time", () =>
  decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: file({ draft: true }) }),
);
permits("admin may create an already published post", () =>
  decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: null }),
);

const EVERY_TRANSITION = [
  ["create a draft", file({ draft: true }), null],
  ["edit an existing draft", file({ draft: true }), file({ draft: true })],
  [
    "edit a live post",
    file({ draft: false, firstPublished: "2026-01-01" }),
    file({ draft: false, firstPublished: "2026-01-01" }),
  ],
  [
    "unpublish a live post",
    file({ draft: true }),
    file({ draft: false, firstPublished: "2026-01-01" }),
  ],
  [
    "republish a withdrawn post",
    file({ draft: false }),
    file({ draft: true, firstPublished: "2026-01-01" }),
  ],
  ["publish for the first time", file({ draft: false }), file({ draft: true })],
  ["create an already published post", file({ draft: false }), null],
];

for (const [what, incomingRaw, priorRaw] of EVERY_TRANSITION) {
  refuses(
    `smoke cannot ${what}`,
    () =>
      decide({
        actor: SMOKE,
        incomingRaw: String(incomingRaw),
        priorRaw: /** @type {string | null} */ (priorRaw),
      }),
    SMOKE_READ_ONLY_POLICY,
  );
}

refuses("smoke cannot delete a post", () => decideDelete({ actor: SMOKE }), SMOKE_READ_ONLY_POLICY);

refuses(
  "smoke cannot forge first_published to buy itself a write",
  () =>
    decide({
      actor: SMOKE,
      incomingRaw: file({ draft: false, firstPublished: "2020-01-01" }),
      priorRaw: file({ draft: true }),
    }),
  SMOKE_READ_ONLY_POLICY,
);

/* Iterated rather than named, so a FOURTH capability granted to smoke fails here. */
{
  const smokeRow = Object.entries(WRITE_CAPABILITIES.smoke);
  eq("the smoke capability row is not empty", smokeRow.length >= 3, true);
  for (const [name, granted] of smokeRow) {
    eq(`smoke is denied the ${name} capability`, granted, false);
  }

  eq("admin may still write", WRITE_CAPABILITIES.admin.write, true);
  eq("admin may still publish for the first time", WRITE_CAPABILITIES.admin.firstPublish, true);
  eq("admin may still delete", WRITE_CAPABILITIES.admin.destroy, true);
  eq("operator may still write", WRITE_CAPABILITIES.operator.write, true);
  eq("carrel may write", WRITE_CAPABILITIES.carrel.write, true);
  eq("carrel may publish for the first time", WRITE_CAPABILITIES.carrel.firstPublish, true);
  eq("carrel may delete (site-api v0.3.0 content.delete)", WRITE_CAPABILITIES.carrel.destroy, true);

  eq(
    "the capability table names the four actor kinds",
    Object.keys(WRITE_CAPABILITIES).sort().join(","),
    "admin,carrel,operator,smoke",
  );
}

/* The guard is extracted by walking back from the EXIT: a proximity needle passes on a print. */
{
  const adminRoute = readFileSync(join(root, "app", "routes", "admin.tsx"), "utf8");
  const src = stripComments(adminRoute);

  const mentions = [];
  for (
    let at = src.indexOf("SMOKE_READ_ONLY_POLICY");
    at !== -1;
    at = src.indexOf("SMOKE_READ_ONLY_POLICY", at + 1)
  ) {
    const lineStart = src.lastIndexOf("\n", at) + 1;
    if (!/^\s*import\b/.test(src.slice(lineStart, at))) mentions.push(at);
  }
  eq(
    "the smoke refusal exists in admin.tsx, outside comments and imports",
    mentions.length > 0,
    true,
  );
  const exitAt = mentions[0] ?? -1;

  const ifAt = src.lastIndexOf("if (", exitAt);
  let guard = "";
  if (ifAt !== -1) {
    let depth = 0;
    for (let i = ifAt + 3; i < exitAt; i += 1) {
      if (src[i] === "(") depth += 1;
      else if (src[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          guard = src.slice(ifAt + 3, i + 1);
          break;
        }
      }
    }
  }

  eq("the guard expression was extracted", guard.length > 10, true);
  eq("and it is a condition, not a span of the file", guard.length < 200, true);

  eq("the smoke refusal is conditioned on the request METHOD", /request\.method/.test(guard), true);
  eq(
    "the method gate is an ALLOWLIST: it names GET and HEAD and refuses the rest",
    /!==\s*"GET"/.test(guard) && /!==\s*"HEAD"/.test(guard),
    true,
  );
  /* AND NOT A DENYLIST: equality on POST lets PUT, PATCH and DELETE through. */
  eq("the gate does not name the methods it refuses", !/request\.method\s*===/.test(guard), true);

  /* REFUSED BEFORE ANYTHING RUNS: a gate after next() is a 403 with the write already done. */
  const nextAt = src.indexOf("return next()");
  eq("the middleware calls next()", nextAt > 0, true);
  eq("the smoke method gate refuses BEFORE next() is reached", exitAt < nextAt, true);

  /** @type {string[]} */
  const constructors = [];
  for (const full of walkFiles(join(root, "app"), {
    keep: (name) => /\.(ts|tsx|mjs)$/.test(name),
  })) {
    if (/kind:\s*"smoke"/.test(stripComments(readFileSync(full, "utf8")))) {
      constructors.push(relative(root, full).split(sep).join("/"));
    }
  }

  eq(
    "the smoke-actor scan found the one construction site it expects",
    constructors.length > 0,
    true,
  );
  eq(
    "the smoke actor is declared in admin-actor.server and constructed in the middleware, nowhere else",
    constructors.sort().join(", "),
    "app/lib/admin-actor.server.ts, app/routes/admin.tsx",
  );
}

{
  const r = decide({
    actor: ADMIN,
    incomingRaw: file({ draft: false }),
    priorRaw: file({ draft: true }),
  });
  const stamped = readState(r.raw).firstPublished;
  eq(
    "admin first publish stamps a date",
    typeof stamped === "string" && /^\d{4}-\d{2}-\d{2}$/.test(stamped),
    true,
  );
  eq("admin first publish reports published", r.published, true);
  eq("the stamped date is echoed back", r.firstPublished, stamped);
}

{
  const r = decide({
    actor: ADMIN,
    incomingRaw: file({ draft: false, firstPublished: "2020-01-01" }),
    priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
  });
  eq("a submitted first_published never wins over the file", r.firstPublished, "2026-01-01");
  eq(
    "and the raw written out carries the file's value",
    readState(r.raw).firstPublished,
    "2026-01-01",
  );
}

{
  const r = decide({ actor: OPERATOR, incomingRaw: file({ draft: true }), priorRaw: null });
  eq("a new draft is stamped with nothing", r.firstPublished, null);
  eq("and reports itself unpublished", r.published, false);
}

{
  // Unpublishing must NOT clear the date, or the next republish would be read
  // as a first publication and an operator would be locked out of its own post.
  const r = decide({
    actor: OPERATOR,
    incomingRaw: file({ draft: true }),
    priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
  });
  eq("unpublishing preserves first_published", r.firstPublished, "2026-01-01");
  eq("and writes it back into the file", readState(r.raw).firstPublished, "2026-01-01");
}

{
  /** @param {Parameters<typeof decide>[0]} o */
  const outcome = (o) => decide(o).outcome;

  eq(
    "a new draft is an ordinary save",
    outcome({ actor: ADMIN, incomingRaw: file({ draft: true }), priorRaw: null }),
    "saved",
  );
  eq(
    "editing an existing draft is an ordinary save",
    outcome({
      actor: ADMIN,
      incomingRaw: file({ draft: true }),
      priorRaw: file({ draft: true }),
    }),
    "saved",
  );
  eq(
    "publishing a post that has never been public is a first publication",
    outcome({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: file({ draft: true }) }),
    "published-first",
  );
  eq(
    "creating a post already published is also a first publication",
    outcome({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: null }),
    "published-first",
  );
  eq(
    "republishing a withdrawn post is a republication, not a first publication",
    outcome({
      actor: ADMIN,
      incomingRaw: file({ draft: false }),
      priorRaw: file({ draft: true, firstPublished: "2026-01-01" }),
    }),
    "republished",
  );
  eq(
    "editing a live post is an ordinary save, not a republication",
    outcome({
      actor: ADMIN,
      incomingRaw: file({ draft: false, firstPublished: "2026-01-01" }),
      priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
    }),
    "saved",
  );
  eq(
    "withdrawing a live post is an unpublish",
    outcome({
      actor: ADMIN,
      incomingRaw: file({ draft: true }),
      priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
    }),
    "unpublished",
  );
  eq(
    "re-saving a withdrawn post as a draft is not a second unpublish",
    outcome({
      actor: ADMIN,
      incomingRaw: file({ draft: true }),
      priorRaw: file({ draft: true, firstPublished: "2026-01-01" }),
    }),
    "saved",
  );
}

/* OPERATORS CANNOT DELETE: the destructive verb needs more authority than publishing, not less. */
{
  refuses(
    "delete: an operator is refused",
    () => decideDelete({ actor: { kind: "operator", id: "mcp" } }),
    "delete-requires-admin",
  );
  permits("delete: the admin is permitted", () => decideDelete({ actor: { kind: "admin" } }));

  const operator = /** @type {const} */ ({ kind: "operator", id: "mcp" });
  let publishRefused = false;
  try {
    decide({ actor: operator, incomingRaw: file({ draft: false }), priorRaw: null });
  } catch (error) {
    publishRefused = error instanceof PolicyError;
  }
  let deleteRefused = false;
  try {
    decideDelete({ actor: operator });
  } catch (error) {
    deleteRefused = error instanceof PolicyError;
  }
  eq(
    "delete: an actor refused a first publish is refused a delete too",
    [publishRefused, deleteRefused],
    [true, true],
  );

  const publishSrc = readFileSync(join(root, "app/lib/editor/publish.server.ts"), "utf8");
  const at = publishSrc.indexOf("export async function deletePost(");
  eq("delete: deletePost exists to be checked", at !== -1, true);
  const body = functionBody(publishSrc, /export async function deletePost\(/);
  eq("delete: deletePost's body parses", body.length > 0, true);
  eq(
    "delete: deletePost calls decideDelete in its own body",
    /decideDelete\(\s*\{\s*actor\s*\}\s*\)/.test(body),
    true,
  );

  /* BEFORE THE FILE READ, or the difference between two errors tells a caller which slugs exist. */
  eq(
    "delete: the decision precedes the file read",
    body.indexOf("decideDelete") < body.indexOf("readFile("),
    true,
  );
}

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
      // Capsomer's JsonLd (capsomer/react/json-ld) escapes through site-runtime's scriptJson and sets the text
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

/* Measured by running this gate, and it moves with the measurement: slack is the defect. 112 on 2026-11-17,
   when check:policy (75) folded in beside the Ask guards (37). */
const MINIMUM_CHECKS = 112;
const floorBreach = assertFloor("check:ask-guards", "checks", tally.checks, MINIMUM_CHECKS);
if (floorBreach) tally.fail(floorBreach);

if (tally.failures > 0) {
  console.error(`check:ask-guards FAILED, ${tally.failures} of ${tally.checks} checks:\n`);
  for (const f of tally.failed) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check:ask-guards ok. ${tally.checks} assertions, 0 failures.`);
