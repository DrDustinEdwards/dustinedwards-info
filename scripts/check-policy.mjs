/**
 * Gate over the operator publish policy.
 *
 *   npm run check:policy
 *
 * BOUNDARY: the decision function in isolation, and pure. It proves what the policy DECIDES,
 * never that a caller consults it before writing.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments.mjs";

import {
  decide,
  decideDelete,
  forceFirstPublished,
  readState,
  PolicyError,
  SMOKE_READ_ONLY_POLICY,
  WRITE_CAPABILITIES,
} from "../app/lib/editor/publish-policy.mjs";
import { assertFloor } from "./lib/floor.mjs";

/** Repo root, so the source assertions below read real files. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let checks = 0;
/** @type {string[]} */
const failures = [];

/**
 * @param {string} label
 * @param {unknown} actual
 * @param {unknown} expected
 */
function eq(label, actual, expected) {
  checks += 1;
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) failures.push(`${label}\n    expected ${b}\n    actual   ${a}`);
}

/** @param {string} label @param {() => void} fn @param {string} policy */
function refuses(label, fn, policy) {
  checks += 1;
  try {
    fn();
    failures.push(`${label}\n    expected a PolicyError, got none`);
  } catch (error) {
    if (!(error instanceof PolicyError)) {
      failures.push(`${label}\n    expected PolicyError, got ${error}`);
      return;
    }
    if (error.policy !== policy) {
      failures.push(`${label}\n    expected policy ${policy}, got ${error.policy}`);
    }
  }
}

/** @param {string} label @param {() => void} fn */
function permits(label, fn) {
  checks += 1;
  try {
    fn();
  } catch (error) {
    failures.push(`${label}\n    expected no error, got ${error}`);
  }
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

// readState

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

// forceFirstPublished

eq(
  "forceFirstPublished adds the field when absent",
  readState(forceFirstPublished(file({ draft: false }), "2026-07-28")).firstPublished,
  "2026-07-28",
);
eq(
  "forceFirstPublished replaces a value already there",
  readState(
    forceFirstPublished(file({ draft: false, firstPublished: "2020-01-01" }), "2026-07-28"),
  ).firstPublished,
  "2026-07-28",
);
eq(
  "forceFirstPublished removes the field when told to",
  readState(forceFirstPublished(file({ draft: true, firstPublished: "2020-01-01" }), null))
    .firstPublished,
  null,
);
// Negative: it must not disturb anything else in the frontmatter or the body.
{
  const out = forceFirstPublished(file({ draft: false }), "2026-07-28");
  eq("forceFirstPublished keeps the body", out.trimEnd().endsWith("Body."), true);
  eq("forceFirstPublished keeps other keys", out.includes("slug: t"), true);
  eq("forceFirstPublished keeps the draft flag", readState(out).draft, false);
}

// The policy: operator

refuses(
  "operator cannot publish a post that has never been published",
  () => decide({ actor: OPERATOR, incomingRaw: file({ draft: false }), priorRaw: file({ draft: true }) }),
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

// The paired positives: everything an operator IS allowed to do.
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

// The policy: admin

permits("admin may publish a post for the first time", () =>
  decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: file({ draft: true }) }),
);
permits("admin may create an already published post", () =>
  decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: null }),
);

// The policy: smoke, the read-only machine actor

/* The claim: the smoke actor appears in NO WRITE BRANCH, both halves, by two instruments. */

/* Driven off a TABLE, so a refusal list that drifted cannot leave a transition unasserted. */
const EVERY_TRANSITION = [
  ["create a draft", file({ draft: true }), null],
  ["edit an existing draft", file({ draft: true }), file({ draft: true })],
  [
    "edit a live post",
    file({ draft: false, firstPublished: "2026-01-01" }),
    file({ draft: false, firstPublished: "2026-01-01" }),
  ],
  ["unpublish a live post", file({ draft: true }), file({ draft: false, firstPublished: "2026-01-01" })],
  ["republish a withdrawn post", file({ draft: false }), file({ draft: true, firstPublished: "2026-01-01" })],
  ["publish for the first time", file({ draft: false }), file({ draft: true })],
  ["create an already published post", file({ draft: false }), null],
];

// SCOPE, ASSERTED. An empty table would run this loop zero times and report a
// clean sweep, which is the zero-scope class hard rule 10 names.
eq("the transition table is not empty", EVERY_TRANSITION.length >= 7, true);

for (const [what, incomingRaw, priorRaw] of EVERY_TRANSITION) {
  refuses(
    `smoke cannot ${what}`,
    () => decide({ actor: SMOKE, incomingRaw: String(incomingRaw), priorRaw: /** @type {string | null} */ (priorRaw) }),
    SMOKE_READ_ONLY_POLICY,
  );
}

refuses("smoke cannot delete a post", () => decideDelete({ actor: SMOKE }), SMOKE_READ_ONLY_POLICY);

/* THE FORGERY CASE here too, refused as READ ONLY, the refusal that is true of this actor. */
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

  /* THE PAIRED POSITIVE: every assertion above is satisfied by a table in which nobody writes. */
  eq("admin may still write", WRITE_CAPABILITIES.admin.write, true);
  eq("admin may still publish for the first time", WRITE_CAPABILITIES.admin.firstPublish, true);
  eq("admin may still delete", WRITE_CAPABILITIES.admin.destroy, true);
  eq("operator may still write", WRITE_CAPABILITIES.operator.write, true);

  // And the table covers exactly the kinds that exist, no more.
  eq(
    "the capability table names the three actor kinds",
    Object.keys(WRITE_CAPABILITIES).sort().join(","),
    "admin,operator,smoke",
  );
}

/* The guard is extracted by walking back from the EXIT: a proximity needle passes on a print. */
{
  const adminRoute = readFileSync(join(root, "app", "routes", "admin.tsx"), "utf8");
  const src = stripComments(adminRoute);

  /* The exit is located in comment-stripped source, by the line it sits on, not by first mention. */
  const mentions = [];
  for (let at = src.indexOf("SMOKE_READ_ONLY_POLICY"); at !== -1; at = src.indexOf("SMOKE_READ_ONLY_POLICY", at + 1)) {
    const lineStart = src.lastIndexOf("\n", at) + 1;
    if (!/^\s*import\b/.test(src.slice(lineStart, at))) mentions.push(at);
  }
  eq("the smoke refusal exists in admin.tsx, outside comments and imports", mentions.length > 0, true);
  const exitAt = mentions[0] ?? -1;

  // Walk BACK to the nearest enclosing `if (`, then take its balanced parens.
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

  // SCOPE, ASSERTED twice: an empty extract reports a present guard missing, a greedy one passes.
  eq("the guard expression was extracted", guard.length > 10, true);
  eq("and it is a condition, not a span of the file", guard.length < 200, true);

  eq(
    "the smoke refusal is conditioned on the request METHOD",
    /request\.method/.test(guard),
    true,
  );
  eq(
    "the method gate is an ALLOWLIST: it names GET and HEAD and refuses the rest",
    /!==\s*"GET"/.test(guard) && /!==\s*"HEAD"/.test(guard),
    true,
  );
  /* AND NOT A DENYLIST: equality on POST lets PUT, PATCH and DELETE through. */
  eq(
    "the gate does not name the methods it refuses",
    !/request\.method\s*===/.test(guard),
    true,
  );

  /* REFUSED BEFORE ANYTHING RUNS: a gate after next() is a 403 with the write already done. */
  const nextAt = src.indexOf("return next()");
  eq("the middleware calls next()", nextAt > 0, true);
  eq("the smoke method gate refuses BEFORE next() is reached", exitAt < nextAt, true);

  /* The other direction: the smoke actor is CONSTRUCTED in one place, and two files are NAMED. */
  /** @type {string[]} */
  const constructors = [];
  const walk = (/** @type {string} */ dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs)$/.test(entry.name)) {
        const text = stripComments(readFileSync(full, "utf8"));
        if (/kind:\s*"smoke"/.test(text)) {
          constructors.push(relative(root, full).split(sep).join("/"));
        }
      }
    }
  };
  walk(join(root, "app"));

  // The scan is proven non-empty before its result is read: a walk that
  // examined nothing reports exactly what a clean sweep reports.
  eq(
    "the smoke-actor scan found the one construction site it expects",
    constructors.length > 0,
    true,
  );
  eq(
    "the smoke actor is declared in auth.server and constructed in the middleware, nowhere else",
    constructors.sort().join(", "),
    "app/lib/auth.server.ts, app/routes/admin.tsx",
  );
}

/* The one way a smoke GET could still 500: adminSessionContext is unset and context.get throws. */
{
  /** @type {string[]} */
  const readers = [];
  const routes = join(root, "app", "routes");
  for (const entry of readdirSync(routes, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
    const text = stripComments(readFileSync(join(routes, entry.name), "utf8"));
    if (!text.includes("context.get(adminSessionContext)")) continue;
    readers.push(entry.name);

    const actionAt = text.indexOf("export async function action(");
    // The body's end: the first line that is exactly `}` after the export,
    // where every top-level function in this repo's formatting closes.
    const actionEnd = actionAt === -1 ? -1 : text.indexOf("\n}", actionAt);
    const reads = [];
    for (
      let at = text.indexOf("context.get(adminSessionContext)");
      at !== -1;
      at = text.indexOf("context.get(adminSessionContext)", at + 1)
    ) {
      reads.push(at);
    }

    eq(`${entry.name} declares an action to scope the read against`, actionAt > 0, true);
    eq(`${entry.name}'s action body has a measurable end`, actionEnd > actionAt, true);
    eq(
      `${entry.name} reads the admin SESSION only inside the action body, never in ` +
        `a loader or a helper outside it`,
      reads.every((at) => at > actionAt && at < actionEnd),
      true,
    );
  }

  // Scope, asserted. Zero readers would make the loop above examine nothing and
  // report exactly what a compliant tree reports.
  eq("the admin-session reader scan found a reader to check", readers.length > 0, true);
  eq(
    "and the readers are the ones this rule was written against",
    readers.sort().join(", "),
    "admin.posts.$slug.edit.tsx",
  );
}

// What decide() stamps

{
  const r = decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: file({ draft: true }) });
  const stamped = readState(r.raw).firstPublished;
  eq("admin first publish stamps a date", typeof stamped === "string" && /^\d{4}-\d{2}-\d{2}$/.test(stamped), true);
  eq("admin first publish reports published", r.published, true);
  eq("the stamped date is echoed back", r.firstPublished, stamped);
}

{
  // The forged value must be REPLACED by the real one, not merely ignored.
  const r = decide({
    actor: ADMIN,
    incomingRaw: file({ draft: false, firstPublished: "2020-01-01" }),
    priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
  });
  eq("a submitted first_published never wins over the file", r.firstPublished, "2026-01-01");
  eq("and the raw written out carries the file's value", readState(r.raw).firstPublished, "2026-01-01");
}

{
  // A draft keeps no date, so a post that has never been public stays that way.
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

/* What a save DID, with both negatives: republish is not first publication, edit is not republish. */

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
  // The negative that matters: a republished post must not read as a first publication.
  eq(
    "republishing a withdrawn post is a republication, not a first publication",
    outcome({
      actor: ADMIN,
      incomingRaw: file({ draft: false }),
      priorRaw: file({ draft: true, firstPublished: "2026-01-01" }),
    }),
    "republished",
  );
  // And its pair: a live post edited again did not become live a second time.
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
  // Its negative: a draft saved as a draft again withdrew nothing.
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

/* The Ask index is a public surface */

/* OPERATORS CANNOT DELETE: the destructive verb needs more authority than publishing, not less. */
{
  refuses(
    "delete: an operator is refused",
    () => decideDelete({ actor: { kind: "operator", id: "mcp" } }),
    "delete-requires-admin",
  );
  permits("delete: the admin is permitted", () =>
    decideDelete({ actor: { kind: "admin" } }),
  );

  /* Asserted as a PAIR: the defect was delete permissive while publish was not. */
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
  eq("delete: an actor refused a first publish is refused a delete too",
    [publishRefused, deleteRefused], [true, true]);

  /* AND THE CALL SITE REACHES IT, scoped to its own body, since decide() is imported for savePost. */
  const publishSrc = readFileSync(join(root, "app/lib/editor/publish.server.ts"), "utf8");
  const at = publishSrc.indexOf("export async function deletePost(");
  eq("delete: deletePost exists to be checked", at !== -1, true);
  const open = publishSrc.indexOf("{", publishSrc.indexOf(")", at));
  let depth = 0, close = -1;
  for (let i = open; i < publishSrc.length; i += 1) {
    if (publishSrc[i] === "{") depth += 1;
    else if (publishSrc[i] === "}") { depth -= 1; if (depth === 0) { close = i; break; } }
  }
  const body = close === -1 ? "" : publishSrc.slice(open, close);
  eq("delete: deletePost's body parses", body.length > 0, true);
  eq("delete: deletePost calls decideDelete in its own body",
    /decideDelete\(\s*\{\s*actor\s*\}\s*\)/.test(body), true);

  /* BEFORE THE FILE READ, or the difference between two errors tells a caller which slugs exist. */
  eq("delete: the decision precedes the file read",
    body.indexOf("decideDelete") < body.indexOf("readFile("), true);
}

/* ASK IS BILLED, so no GET: a crawler, prefetch, unfurler or img src issues one unasked. */
{
  const askRoute = readFileSync(join(root, "app/routes/search.ask.ts"), "utf8");

  eq(
    "ask: the route exports an action",
    /export\s+async\s+function\s+action\b/.test(askRoute),
    true,
  );

  /* The loader must exist and REFUSE: absence passes for a route serving GET another way. */
  const loaderAt = askRoute.search(/export\s+function\s+loader\s*\(/);
  eq("ask: the route exports a loader", loaderAt !== -1, true);
  const loaderBody = loaderAt === -1 ? "" : askRoute.slice(loaderAt, loaderAt + 400);
  eq("ask: the loader refuses with 405", /status:\s*405/.test(loaderBody), true);
  eq("ask: the refusal names the allowed method", /allow:\s*"POST"/.test(loaderBody), true);

  /* And the question is read from the BODY, or a restored loader bills on a hand-made GET. */
  eq(
    "ask: the question is read from the request body",
    /request\.formData\(\)/.test(askRoute),
    true,
  );
  eq(
    "ask: the question is not read from the query string",
    /searchParams\.get\("q"\)/.test(askRoute),
    false,
  );


  /* THE ORIGIN GATE, AND ITS POSITION IS THE ASSERTION: a hostile page spends the shared budget. */
  const askCode = stripComments(askRoute);
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
  /*
   * THE REST OF THE CHAIN: RATE, then CACHE, then BUDGET, then MODEL, which is hard rule 19's
   * order. Presence passes on any arrangement; the ORDER is the property, cheapest refusing first.
   */
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

  /* EVERY MUTATING SURFACE TAKES THE SAME PREDICATE, measured on source rather than assumed. */
  for (const [label, file] of [
    ["theme", "app/routes/theme.ts"],
    ["the admin plane", "app/routes/admin.tsx"],
  ]) {
    const code = stripComments(readFileSync(join(root, file), "utf8"));
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

  /* AND THE ABSENT-ORIGIN EXEMPTION SURVIVES: a scriptless form post carries none, hard rule 9. */
  {
    const predicate = stripComments(readFileSync(join(root, "app/lib/origin.mjs"), "utf8"));
    eq(
      "origin: an absent Origin is allowed by the predicate",
      /origin === null \|\| origin === undefined \|\| origin === ""[\s\S]{0,80}ok: true/.test(
        predicate,
      ),
      true,
    );
  }

  /* REFUSED ON LENGTH BEFORE IT IS HASHED, asserted by POSITION, hard rule 19's instrument. */
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

    /* AND DESCRIBE SPENDS NO RATE UNIT: absence in the loader and presence in the action, both. */
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

  /* EVERY JSON-LD BLOCK GOES THROUGH THE ESCAPING SERIALISER, found by scanning, not from a list. */
  {
    const routeDir = join(root, "app/routes");
    /** @type {string[]} */
    const bare = [];
    let scanned = 0;
    for (const name of readdirSync(routeDir).filter((f) => f.endsWith(".tsx"))) {
      const code = stripComments(readFileSync(join(routeDir, name), "utf8"));
      if (!code.includes("ld+json")) continue;
      scanned += 1;
      // The window from the ld+json type to the end of that element's props.
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

  /* THE LIGHTBOX IS A REAL MODAL DIALOG, asserted on source because check:browser skips. */
  {
    const blog = stripComments(readFileSync(join(root, "app/enhance/blog.ts"), "utf8"));
    const overlay = blog.slice(blog.indexOf("function openOverlay"));
    const body = overlay.slice(0, overlay.indexOf("\n}"));
    eq("lightbox: the scan found openOverlay", body.length > 200, true);
    eq(
      "lightbox: it creates a dialog, not a div",
      /createElement\("dialog"\)/.test(body) && !/createElement\("div"\)/.test(body),
      true,
    );
    eq("lightbox: it opens with showModal", /showModal\(\)/.test(body), true);
    eq("lightbox: it carries an accessible name", /aria-label/.test(body), true);
    eq("lightbox: it has a close button", /lightbox-close/.test(body), true);
    eq(
      "lightbox: focus is restored on close",
      /addEventListener\("close"[\s\S]{0,200}restoreFocus\(\)/.test(body),
      true,
    );
  }

  /* WCAG 2.2 1.4.13 on source, each property asserted by its mechanism rather than by a claim. */
  {
    const blog = stripComments(readFileSync(join(root, "app/enhance/blog.ts"), "utf8"));
    const fn = blog.slice(blog.indexOf("function footnotePreviews"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    eq("footnotes: the scan found footnotePreviews", body.length > 200, true);
    eq(
      "footnotes: 1.4.13 hoverable, leaving schedules a hide rather than performing one",
      /scheduleHide/.test(body) && /setTimeout\(hide/.test(body),
      true,
    );
    eq(
      "footnotes: 1.4.13 hoverable, entering the bubble cancels the hide",
      /bubble\.addEventListener\("mouseenter", cancelHide\)/.test(body),
      true,
    );
    eq(
      "footnotes: 1.4.13 dismissible by Escape",
      /"Escape"/.test(body) && /keydown/.test(body),
      true,
    );
    eq(
      "footnotes: 1.4.13 persistent, no scroll listener destroys the bubble",
      !/addEventListener\("scroll"/.test(body),
      true,
    );

    /* 4.1.3: ONE role=status region, not a relabelled control and not a pseudo-element. */
    eq(
      "copy controls: there is a role=status region",
      /setAttribute\("role", "status"\)/.test(blog),
      true,
    );
    eq(
      "copy controls: all three announce through it",
      (blog.match(/announce\(/g) ?? []).length >= 4,
      true,
    );

    /* And the permalink LANDS on the heading: the assertion is on the focus move. */
    const headings = blog.slice(blog.indexOf("function headingLinks"));
    eq(
      "heading permalinks: activating one moves focus to the heading",
      /heading\.focus\(\)/.test(headings.slice(0, 2000)),
      true,
    );
  }

  const robots = readFileSync(join(root, "app/routes/robots.ts"), "utf8");
  eq(
    "ask: robots.txt disallows /search/ask",
    /Disallow: \/search\/ask/.test(robots),
    true,
  );
}

/* the Ask index is kept in step by ship */

/* sync:content does not touch AI Search, so the index fell behind on every content ship. */
{
  const apiSource = stripComments(
    readFileSync(join(root, "app/lib/operator/api.server.ts"), "utf8"),
  );
  const shipSource = stripComments(readFileSync(join(root, "scripts/ship.mjs"), "utf8"));

  eq("ask sync: the operator API was read", apiSource.length > 2000, true);
  eq("ask sync: ship.mjs was read", shipSource.length > 2000, true);

  eq(
    "ask sync: the operator API exposes sync_ask",
    /"sync_ask"/.test(apiSource),
    true,
  );
  eq(
    "ask sync: the tool derives its verdict from a report module, not inline",
    /askSyncReport\(/.test(apiSource),
    true,
  );

  eq("ask sync: SHIP CALLS sync_ask", /"sync_ask"/.test(shipSource), true);

  /* ORDER: the upload writes what the DEPLOYED Worker serves, so it runs after deploy and sync. */
  const deployAt = shipSource.indexOf('announce("Deploy")');
  const syncAt = shipSource.indexOf('announce("Sync content to remote D1")');
  const askAt = shipSource.indexOf("sync_ask");
  eq("ask sync: the deploy step was located", deployAt !== -1, true);
  eq("ask sync: the D1 sync step was located", syncAt !== -1, true);
  eq(
    "ask sync: THE ASK UPLOAD RUNS AFTER THE DEPLOY AND AFTER THE D1 SYNC",
    askAt !== -1 && deployAt !== -1 && syncAt !== -1 && askAt > deployAt && askAt > syncAt,
    true,
  );

  /* THE FAILURE PATH: a step whose result is discarded cannot fail, and stale-index ships did. */
  eq(
    "ask sync: ship reads a converged verdict rather than a status code alone",
    /converged/.test(shipSource),
    true,
  );
  /* THE EXIT CONDITION ITSELF: a block that PRINTS the miss keeps the name inside the window. */
  const lastExit = shipSource.lastIndexOf("process.exit(1)");
  const guardOpen = shipSource.lastIndexOf("\nif (", lastExit);
  const guard =
    guardOpen === -1 ? "" : shipSource.slice(guardOpen, shipSource.indexOf(") {", guardOpen) + 1);
  eq("sync: the final exit guard was located", guard.length > 0 && guard.length < 200, true);

  eq(
    "ask sync: SHIP EXITS NONZERO WHEN THE INDEX DID NOT CONVERGE",
    /\baskMiss\b/.test(guard),
    true,
  );
  /* And the deploy STANDS: the record prints before the exit, which is what an operator needs. */
  const recordAt = shipSource.indexOf('announce("Shipped")');
  const exitAt = shipSource.lastIndexOf("process.exit(1)");
  eq(
    "ask sync: the shipped record prints BEFORE the nonzero exit",
    recordAt !== -1 && exitAt !== -1 && recordAt < exitAt,
    true,
  );

  /* READINESS, BETWEEN DEPLOY AND FIRST WRITE: five 200s are blind to what /api/health reports. */
  const readinessAt = shipSource.indexOf("READINESS_PATH} reports ok");
  eq(
    "readiness: the step was located",
    readinessAt !== -1,
    true,
  );
  eq(
    "readiness: ship asks the health endpoint",
    /const\s+READINESS_PATH\s*=\s*"\/api\/health"/.test(shipSource),
    true,
  );
  eq(
    "readiness: THE CHECK RUNS AFTER THE DEPLOY AND BEFORE THE D1 SYNC",
    readinessAt !== -1 &&
      deployAt !== -1 &&
      syncAt !== -1 &&
      readinessAt > deployAt &&
      readinessAt < syncAt,
    true,
  );
  /* THE VERDICT IS READ OUT OF THE BODY and ACTED ON; the decision lives in readiness.mjs. */
  const readinessSource = stripComments(
    readFileSync(join(root, "scripts/lib/readiness.mjs"), "utf8"),
  );
  eq("readiness: the module was read", readinessSource.length > 1000, true);
  eq(
    "readiness: the verdict is decided from the parsed body, not the status",
    /value\.ok\s*!==\s*true/.test(readinessSource),
    true,
  );
  /* AND A BODY WITH NO CHECKS REFUSES: any JSON on the origin can carry ok:true. */
  eq(
    "readiness: a body carrying no checks is refused",
    /checks\.length\s*===\s*0/.test(readinessSource),
    true,
  );
  eq(
    "readiness: SHIP REFUSES ON THE VERDICT rather than logging it",
    /if\s*\(!verdict\.ok\)\s*refuse\(/.test(shipSource),
    true,
  );

  /* BOTH HALVES: deferring without the late assertion drops the check, and the reverse deadlocks. */
  const deferredAt = readinessSource.indexOf("DEFERRED_CHECKS = {");
  eq("ruling 56: the deferred checks are named in one place", deferredAt !== -1, true);
  /* ALL THREE, ENUMERATED: a regex for content-drift alone passes once the other two are gone. */
  for (const name of ["content-drift", "ask-index-drift", "media-index-drift"]) {
    eq(
      `ruling 56: ${name} is deferred`,
      // Upper case as well as lower: a lower-only class failed on correct code.
      new RegExp(`"${name}":\\s*"the [A-Za-z0-9 ]+"`).test(readinessSource),
      true,
    );
  }
  /* EACH NAMES THE STEP THAT REPAIRS IT, which is the test for whether a fourth belongs. */
  eq(
    "ruling 56: every deferred check names the step that repairs it",
    !/"[a-z-]+":\s*"",?\s*$/m.test(readinessSource),
    true,
  );
  eq(
    "ruling 48: the readiness step passes them to the verdict",
    /readinessVerdict\([^)]*Object\.keys\(DEFERRED_CHECKS\)\)/.test(shipSource),
    true,
  );
  eq(
    "ruling 48: the module subtracts deferred names rather than reading ok",
    /gatingFailed/.test(readinessSource),
    true,
  );
  /* AND ASSERTED AFTER THE SYNC, or a check that merely exists is the deadlock again. */
  const contentDriftAt = shipSource.indexOf("deferredMisses(verdict.checks, DEFERRED_CHECKS");
  eq("ruling 56: the late assertion was located", contentDriftAt !== -1, true);
  eq(
    "ruling 56: THE DEFERRED CHECKS ARE ASSERTED AFTER THE D1 SYNC",
    contentDriftAt !== -1 && syncAt !== -1 && contentDriftAt > syncAt,
    true,
  );
  eq(
    "ruling 48: a still-drifted corpus reaches the exit code",
    /deferredMiss\s*\)\s*\{/.test(shipSource) || /\|\|\s*deferredMiss/.test(shipSource),
    true,
  );

  /* THE MEDIA INDEX, ASSERTED SEPARATELY, because the two steps fail independently. */
  eq(
    "media sync: the operator API exposes sync_media",
    /"sync_media"/.test(apiSource),
    true,
  );
  eq(
    "media sync: the tool derives its verdict from a report module, not inline",
    /mediaSyncReport\(/.test(apiSource),
    true,
  );
  /* RULE 18, ASSERTED: the repair goes through the derivation, never a hand-written insert. */
  eq(
    "media sync: the tool repairs THROUGH the derivation, not by writing rows",
    /rebuildMediaIndex\(env\)/.test(apiSource),
    true,
  );
  /* AND THE VERDICT IS READ BACK: only mediaIndexStatus re-enumerates and reads D1 afterwards. */
  eq(
    "media sync: the verdict comes from a read-back reconciliation",
    /mediaIndexStatus\(env\)/.test(apiSource),
    true,
  );

  eq("media sync: SHIP CALLS sync_media", /"sync_media"/.test(shipSource), true);

  const mediaAt = shipSource.indexOf('"sync_media"');
  eq(
    "media sync: THE REBUILD RUNS AFTER THE DEPLOY",
    mediaAt !== -1 && deployAt !== -1 && mediaAt > deployAt,
    true,
  );
  eq(
    "media sync: SHIP EXITS NONZERO WHEN THE INDEX DID NOT RECONCILE",
    /\bmediaMiss\b/.test(guard),
    true,
  );
  eq(
    "media sync: the shipped record prints BEFORE the media miss can exit",
    recordAt !== -1 && exitAt !== -1 && recordAt < exitAt && mediaAt < recordAt,
    true,
  );
}

/* the cache split, in config */

/*
 * WHICH ENTRYPOINT THE PLATFORM MAY CACHE, which check:config cannot judge: gateway cache on
 * hides readership, Renderer cache off renders every request, cross_version on serves stale.
 */
{
  const exampleRaw = readFileSync(join(root, "wrangler.jsonc.example"), "utf8");
  /* Comments stripped before parsing: the file is JSONC and is mostly prose. */
  const example = JSON.parse(
    exampleRaw.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""),
  );

  eq("the example config still enables Workers Cache at the top level", example.cache?.enabled, true);
  eq("the GATEWAY entrypoint has cache DISABLED", example.exports?.default?.cache?.enabled, false);
  eq("the RENDERER entrypoint has cache ENABLED", example.exports?.Renderer?.cache?.enabled, true);
  /* ABSENT rather than false: writing it would be a second place to state a safe default. */
  eq(
    "cross_version_cache is not enabled, so a deploy invalidates the cache",
    example.cache?.cross_version_cache ?? false,
    false,
  );
}

/** Drafts must never reach the AI index: Ask cannot filter at query time, so exclude at upload. */
{
  const now = Date.parse("2026-07-29T12:00:00.000Z");
  /** @param {{draft?: boolean, publishAt?: string|null}} p */
  const publishable = (p) => {
    if (p.draft === true) return false;
    if (p.publishAt && Date.parse(p.publishAt) > now) return false;
    return true;
  };

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

  // And the source of truth actually enforces it. Read the shipped module
  // rather than restating the rule, so this fails if the filter is removed.
  const askRaw = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "app", "lib", "search", "ask.server.ts"),
    "utf8",
  );
  const searchRaw = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "app", "lib", "search", "search.server.ts"),
    "utf8",
  );

  /*
   * COMMENTS STRIPPED BEFORE MATCHING: a comment explaining a filter that had been removed kept
   * the count at two, which is hard rule 10's comment-satisfied anchor.
   */
  const askSource = stripComments(askRaw);
  const searchSource = stripComments(searchRaw);

  // SCOPE, ASSERTED: an over-eager stripper empties the file and every assertion below misreads.
  eq(
    "stripping comments left the module's code behind",
    askSource.length > askRaw.length / 4 && /export async function syncAskCorpus/.test(askSource),
    true,
  );

  /* The BINDING: the uploader sources from askCorpusRecords alone, never its own SELECT. */
  eq(
    "syncAskCorpus sources its records from askCorpusRecords",
    /const records = await askCorpusRecords\(env\)/.test(askSource),
    true,
  );
  eq(
    "syncAskCorpus does not derive records from an unfiltered corpus",
    !/recordsForPosts\(posts\)/.test(askSource),
    true,
  );
  eq(
    "askCorpusRecords composes visibilityClause beside type='post'",
    /SELECT url, title, body FROM search_docs WHERE type = 'post' AND ` \+\s*visibilityClause\(NO_ALIAS\)/.test(
      searchSource,
    ),
    true,
  );
  eq(
    "syncAskPost refuses a non-publishable post",
    /askPublishable\(post\)\s*\?\s*recordsForPosts\(\[post\]\)\s*:\s*\[\]/.test(askSource),
    true,
  );

  /* THE FILTER COMPOSES THE SHARED PREDICATE rather than restating it in a third shape. */
  const askAt = askSource.search(/function publishableForAsk\b/);
  eq("publishableForAsk exists in ask.server.ts", askAt !== -1, true);

  let askBody = "";
  if (askAt !== -1) {
    const open = askSource.indexOf("{", askSource.indexOf(")", askAt));
    let depth = 0;
    for (let i = open; i < askSource.length; i += 1) {
      if (askSource[i] === "{") depth += 1;
      else if (askSource[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          askBody = askSource.slice(open, i + 1);
          break;
        }
      }
    }
  }
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

  /* THE EXPECTED SET comes from search_docs, not from recomputing the corpus on every load. */
  const bodyOf = (/** @type {string} */ src, /** @type {string} */ name) => {
    const start = src.indexOf(`export async function ${name}(`);
    if (start === -1) return "";
    // To the first line that is exactly a closing brace, which is where a
    // top-level function ends in this codebase's formatting.
    const end = src.indexOf("\n}", start);
    return end === -1 ? src.slice(start) : src.slice(start, end + 2);
  };

  /* ASSERTED AS THE BINDING, never as a line arrangement a legitimate refactor would break. */
  const statusBody = bodyOf(askSource, "askIndexStatus");

  // SCOPE, ASSERTED. An extractor returning "" reports a missing binding that
  // is present; one returning the whole file passes on a neighbour's code.
  eq(
    "the askIndexStatus body was extracted, and it is that function alone",
    statusBody.length > 80 &&
      statusBody.length < askSource.length / 4 &&
      !statusBody.includes("export function askStatusReader"),
    true,
  );

  /* Asserted in two halves: the paper half comes from the module, not a query grown here. */
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

  /* AND FROM NOTHING ELSE: recordsForPosts, the producer this moved away from, caught anywhere. */
  eq(
    "askIndexStatus builds its expected set from no other producer",
    !/recordsForPosts\(/.test(statusBody),
    true,
  );
  eq(
    "askIndexStatus no longer recomputes records from the corpus",
    !/recordsForPosts\(publishableForAsk\(posts\)\)[\s\S]{0,400}listAllAskItems/.test(askSource),
    true,
  );
  /*
   * SCOPED TO THE FUNCTION BODY, never a window after its name: zeroState sits below and composes
   * visibilityClause itself, which is hard rule 10's unanchored needle.
   */
  const expectedUrlsBody = bodyOf(searchSource, "askExpectedUrls");

  // SCOPE, ASSERTED: an empty extract misreads all three below; a whole-file one passes anywhere.
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

// Report

/*
 * EXECUTED-COUNT FLOOR. This gate covers hard rule 19's ordered cost chain and the operation
 * reserved for the human, so the floor MOVES WITH THE MEASUREMENT: slack is the defect.
 */
const MINIMUM_CHECKS = 184;
const floorBreach = assertFloor("check:policy", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) failures.push(floorBreach);

if (failures.length > 0) {
  console.error(`check:policy FAILED, ${failures.length} of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check:policy ok. ${checks} assertions, 0 failures.`);

