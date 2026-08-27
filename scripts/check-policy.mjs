/**
 * Gate over the operator publish policy.
 *
 * OBSERVATION BOUNDARY: the decision function in isolation. It never calls
 * GitHub, D1 or the operator endpoint, so it proves what the policy DECIDES and
 * nothing about whether a caller actually consults it before writing.
 *
 *   npm run check:policy
 *
 * Imports app/lib/editor/publish-policy.mjs directly, the same module the Worker
 * imports, so it exercises the
 * decision the Worker actually makes rather than a restatement of the rule.
 * Pure functions only: no GitHub, no database, no network.
 *
 * EVERY RULE HAS A PAIRED NEGATIVE, on the same principle as check:search. A
 * policy that only refuses has not been shown to permit anything, and a policy
 * that only permits is not a policy. The case that matters most is the FORGERY
 * pair: an operator submitting its own first_published must not be able to
 * assert the fact the gate is checking, and the admin must still be able to
 * publish the same post.
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

// --- readState ------------------------------------------------------------

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
// This is the exact state the whole policy exists to tell apart from a new draft.
eq(
  "readState distinguishes a withdrawn post from a new draft",
  readState(file({ draft: true, firstPublished: "2026-01-01" })),
  { draft: true, firstPublished: "2026-01-01" },
);

// --- forceFirstPublished --------------------------------------------------

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

// --- The policy: operator ------------------------------------------------

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

// THE FORGERY CASE. An operator submits first_published in its own payload,
// claiming the post was published before. The prior FILE says otherwise, and
// the prior file is the only thing consulted.
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

// --- The policy: admin ----------------------------------------------------

permits("admin may publish a post for the first time", () =>
  decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: file({ draft: true }) }),
);
permits("admin may create an already published post", () =>
  decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: null }),
);

// --- The policy: smoke, the read-only machine actor -----------------------

/*
 * THE CLAIM UNDER TEST: the smoke actor appears in NO WRITE BRANCH.
 *
 * That claim has two halves and they are proven by different instruments,
 * because they are enforced in different places and one of them is not a policy
 * decision at all:
 *
 *   THE PUBLISH PATH   `decide()` and `decideDelete()` refuse it, from the
 *                      capability table. Proven by RUNNING them, below.
 *   EVERY OTHER ACTION the eleven media intents, the tag writes, the trash and
 *                      the rebuild consult no policy module. They are refused
 *                      by the `/admin` middleware's method gate. Proven by
 *                      reading that guard out of the route source, below.
 *
 * Asserting only the first would leave the larger half unexamined while reading
 * like a complete answer, which is this repo's recorded N-1-of-N shape.
 */

/*
 * EVERY TRANSITION AN OPERATOR OR THE ADMIN IS PERMITTED, refused for smoke.
 *
 * Driven off a TABLE rather than written out, so the cases here are the same
 * cases the permitting blocks above use. A smoke refusal list that drifted out
 * of step with the permit list would leave a transition permitted for the
 * machine actor and unasserted, which is exactly the gap the table closes.
 */
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

/*
 * THE FORGERY CASE, for this actor too. An operator cannot assert the fact the
 * gate checks; a smoke credential must not be able to either, and it must be
 * refused as READ ONLY rather than as a first-publish, because the read-only
 * refusal is the one that is true of it.
 */
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

/*
 * THE CAPABILITY TABLE ITSELF, in both directions.
 *
 * Iterated over `Object.entries` rather than naming the three capabilities, so
 * a FOURTH capability added to the table and granted to smoke fails here rather
 * than passing unexamined. Naming them would freeze this assertion at the shape
 * the table has today, which is the same defect as a hand-maintained mirror.
 */
{
  const smokeRow = Object.entries(WRITE_CAPABILITIES.smoke);
  eq("the smoke capability row is not empty", smokeRow.length >= 3, true);
  for (const [name, granted] of smokeRow) {
    eq(`smoke is denied the ${name} capability`, granted, false);
  }

  /*
   * THE PAIRED POSITIVE, and it is not a formality. Every assertion above is
   * satisfied by a table in which NOBODY may write, and such a table would take
   * the whole publish path down while this gate reported a perfect score.
   */
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

/*
 * THE METHOD GATE IN THE MIDDLEWARE, read out of the route source.
 *
 * **THE GUARD EXPRESSION IS EXTRACTED BY WALKING BACK FROM THE EXIT**, not
 * matched near it. That is the needle class recorded 2026-08-24: a proximity
 * needle stays satisfied by a PRINT of the name after control flow has stopped
 * consulting it, so `SMOKE_READ_ONLY_POLICY` appearing within N characters of a
 * `403` proves only that the string is nearby. What has to be true is that the
 * refusal is CONDITIONED on the method, so the condition itself is what gets
 * read.
 */
{
  const adminRoute = readFileSync(join(root, "app", "routes", "admin.tsx"), "utf8");
  const src = stripComments(adminRoute);

  /*
   * THE EXIT: the 403 that names the policy. Located in COMMENT-STRIPPED
   * source, because a comment quoting the refusal has both satisfied an
   * assertion about code and failed one in this repo, within one week.
   *
   * **NOT THE FIRST MENTION OF THE CONSTANT, and this gate caught itself on
   * exactly that.** The first occurrence in the stripped file is the IMPORT
   * line, which sits above every `if` in the module, so the backward walk found
   * no guard and three assertions failed reporting a missing gate that was
   * present. An import is a mention, not a use. Import lines are skipped by
   * looking at the line the occurrence sits on, rather than by assuming the
   * last occurrence is the interesting one, which would break the moment a
   * second refusal is added below this one.
   */
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

  // SCOPE, ASSERTED, twice. An extractor returning "" would make every
  // assertion below report a missing guard that is present; one that ran away
  // to the top of the file would let a neighbour's condition satisfy them.
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
  /*
   * AND IT IS NOT A DENYLIST. `method === "POST"` would pass every assertion
   * above and let PUT, PATCH and DELETE through, which is the whole reason the
   * allowlist form was chosen. Asserted as the absence of an equality test on
   * the method, inside the guard alone.
   */
  eq(
    "the gate does not name the methods it refuses",
    !/request\.method\s*===/.test(guard),
    true,
  );

  /*
   * REFUSED BEFORE ANYTHING RUNS. A method gate that fired after `next()` would
   * refuse the response and leave the write already done, which is a 403 that
   * lies. Position in the middleware body is the assertion.
   */
  const nextAt = src.indexOf("return next()");
  eq("the middleware calls next()", nextAt > 0, true);
  eq("the smoke method gate refuses BEFORE next() is reached", exitAt < nextAt, true);

  /*
   * THE OTHER DIRECTION: the smoke actor is CONSTRUCTED in exactly one place.
   *
   * This is the assertion that keeps "appears in no write branch" true as the
   * code moves. A future edit that hands `{ kind: "smoke" }` to `savePost`, to
   * `deletePost`, or to the operator API would be refused by the capability
   * table at runtime, but it would also be a caller that believed it could
   * write, and this fails on the day it is written rather than at the throw.
   *
   * Scoped to app/, comment-stripped, and the permitted sites are NAMED.
   *
   * **TWO FILES, NOT ONE, and the second is listed rather than excluded.** The
   * needle matches the `AdminActor` type union in `auth.server.ts`, which
   * DECLARES the shape, as well as the object literal in the middleware, which
   * CONSTRUCTS it. Telling a type annotation from a value with a regex is the
   * parser that section 5 of check:invariants was deleted for, and an exclusion
   * that names a file excludes everything else in it too. So both are named,
   * with their roles, and a THIRD file appearing still fails, which is the
   * property this assertion is for.
   */
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

/*
 * THE ONE WAY A SMOKE GET COULD STILL 500, closed here.
 *
 * `adminSessionContext` holds a Better Auth session and the middleware sets it
 * for the HUMAN ADMIN ONLY, because the smoke actor has no session and a
 * synthesised one would be the stub this repo refuses. `context.get` on an
 * unset context THROWS. So a LOADER that reads it would be fine for Dustin and
 * a 500 for every smoke request, on a page that renders perfectly in every
 * other gate: `check:admin-ui` stubs the server modules, and `check:browser`
 * would report it as a surface that failed to render rather than as an
 * authentication defect.
 *
 * Today there is exactly one reader and it is inside an ACTION, which the
 * method gate makes unreachable for the smoke actor. That is a property of
 * where one line happens to sit, so it is asserted rather than assumed.
 *
 * INSIDE THE ACTION'S BRACE-MATCHED BODY, in comment-stripped source. The
 * first form of this scan asserted only that every read sat AFTER the action
 * export BEGAN, an unbounded window to end-of-file, and that window had the
 * exact hole this section exists about: a helper declared below the action,
 * reading the session and called from the loader, sat "after the action" in
 * text while running on the read path at runtime. Planted 2026-08-25 and the
 * old form passed 138/0 over it. The window is now bounded to the action's
 * own body, the technique `bodyOf` below already uses (a top-level function
 * ends at the first line that is exactly a closing brace in this codebase's
 * formatting), so a read anywhere outside that span fails, helper or loader
 * alike. Fail closed: this cannot see the call graph, so a read the action
 * itself delegates to a sibling helper is refused too, and the repair is to
 * move the read inside the action, where its reachability is the method
 * gate's guarantee.
 */
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

// --- What decide() stamps -------------------------------------------------

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

/* -------------------------------------------------------------------------
 * What a save DID, which is what the editor reports back
 * ----------------------------------------------------------------------
 *
 * The editor's feedback slot names the transition, and a first publication is
 * rendered differently from every other save because it is the one act reserved
 * to the human. The classification therefore has to be right about the two
 * cases current state cannot tell apart on its own, and both are asserted here
 * with their negatives: a withdrawn post republished is NOT a first
 * publication, and a live post edited again is NOT a republication.
 */

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
  // The negative that matters: a post published, withdrawn, and published again
  // must NOT read as a first publication, or the editor would perform the
  // ceremony a second time for an act that is not the one being marked.
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

/* -------------------------------------------------------------------------
 * The Ask index is a public surface
 * ---------------------------------------------------------------------- */

/* ----------------------------------------------------------------------
 * OPERATORS CANNOT DELETE.
 * ---------------------------------------------------------------------- *
 *
 * Ruled 2026-08-17. `savePost` refused an operator's FIRST publish through
 * decide(); `deletePost` took the same actor and used it only to build a commit
 * message, so a token forbidden from making a post public was permitted to
 * DESTROY it, over the network through /api/operator. Least privilege: the
 * destructive verb needs more authority than the publishing one, not less.
 *
 * Driven through the REAL decide/decideDelete, not a copy of the rule.
 */
{
  refuses(
    "delete: an operator is refused",
    () => decideDelete({ actor: { kind: "operator", id: "mcp" } }),
    "delete-requires-admin",
  );
  permits("delete: the admin is permitted", () =>
    decideDelete({ actor: { kind: "admin" } }),
  );

  /*
   * THE ASYMMETRY IS GONE, asserted as a PAIR rather than as two separate
   * facts. The defect was not that delete was permissive in isolation, it was
   * that it was permissive while publish was not, so the property worth holding
   * is that an actor refused a first publish is also refused a delete.
   */
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

  /*
   * AND THE CALL SITE ACTUALLY REACHES IT. The predicate passing proves the
   * rule; it does not prove `deletePost` asks. SCOPED to deletePost's own body,
   * because the file imports decide() for savePost and a file-wide match would
   * be satisfied by that.
   */
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

  /*
   * BEFORE THE FILE READ. A guard placed after it still refuses, but it lets an
   * unauthorised caller probe which slugs exist by the difference between two
   * error messages. Position is part of the guard.
   */
  eq("delete: the decision precedes the file read",
    body.indexOf("decideDelete") < body.indexOf("readFile("), true);
}

/* ----------------------------------------------------------------------
 * ASK IS BILLED, SO IT MUST NOT BE REACHABLE BY A GET.
 * ---------------------------------------------------------------------- *
 *
 * Every answer spends a per-IP allowance and one of a capped number of daily
 * generations. A GET that bills is a side-effecting GET: a crawler, a link
 * prefetch, a preview unfurler or an `<img src>` on somebody else's page all
 * issue one without a person deciding to. The METHOD is the only part of that a
 * third party cannot choose for us, and robots.txt is advisory on top.
 *
 * Asserted from SOURCE. The route file must export an action and must not
 * export a loader that does work, and the robots body must name the path.
 */
{
  const askRoute = readFileSync(join(root, "app/routes/search.ask.ts"), "utf8");

  eq(
    "ask: the route exports an action",
    /export\s+async\s+function\s+action\b/.test(askRoute),
    true,
  );

  /*
   * The loader must exist and must REFUSE. Asserting merely that no loader
   * exists would pass for a route that quietly serves GET through some other
   * export, and asserting the file mentions 405 anywhere would pass on a
   * comment. Scoped to the loader's own body.
   */
  const loaderAt = askRoute.search(/export\s+function\s+loader\s*\(/);
  eq("ask: the route exports a loader", loaderAt !== -1, true);
  const loaderBody = loaderAt === -1 ? "" : askRoute.slice(loaderAt, loaderAt + 400);
  eq("ask: the loader refuses with 405", /status:\s*405/.test(loaderBody), true);
  eq("ask: the refusal names the allowed method", /allow:\s*"POST"/.test(loaderBody), true);

  /*
   * And the question is read from the BODY, not the query string. A route that
   * kept reading `searchParams` would still bill on a hand-made GET the moment
   * somebody restored a loader.
   */
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


  /*
   * THE ORIGIN GATE, AND ITS POSITION IS THE ASSERTION THAT MATTERS.
   *
   * Ask is anonymous, so this is not CSRF in the usual sense: there is no
   * session to borrow and SameSite does nothing. What a hostile page can do is
   * make its own readers' browsers spend the shared Ask budget, and the per-IP
   * limiter is blind to it because a thousand readers are a thousand IPs.
   *
   * Asserting the check merely EXISTS would pass on a version that ran it after
   * the Durable Object had already been consulted, which is most of the cost of
   * the attack. So the assertion is ORDER: the origin verdict is taken before
   * checkAskRate, measured by position in the action's own body.
   *
   * Comments are stripped first, on this file's established rule: the action's
   * docblock explains the limiter and the attack in prose, and an unstripped
   * scan would find both names in the explanation and compare the wrong offsets.
   */
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
   * THE REST OF THE CHAIN: RATE, then CACHE, then BUDGET, then MODEL.
   *
   * Hard rule 19 names the whole order, and until 2026-08-24 only its first
   * pair was asserted. The origin-before-rate assertion above is untouched and
   * deliberately not rebuilt here; this is the TAIL it stops at.
   *
   * ## WHY POSITION AND NOT PRESENCE
   *
   * Every one of these four calls exists in any arrangement of them, so a
   * presence assertion passes on an action that reserves budget before checking
   * the cache, which spends a Durable Object write on a question already
   * answered, and on one that reaches the model before either. The ORDER is the
   * property; the names are only how it is located.
   *
   * ## WHY EACH STAGE SITS WHERE IT DOES, cheapest refusal first
   *
   *   rate    one Durable Object call, and it is in front of the cache on
   *           purpose: a cached answer is cheap but not free, and hammering for
   *           cached answers is still hammering.
   *   cache   one KV read. It reaches no model and consumes no budget.
   *   budget  the second Durable Object call, the exact daily ceiling, reserved
   *           here and nowhere else.
   *   model   the only billed step, and the last thing the action does.
   *
   * SCOPED to the action body already extracted above, with comments stripped
   * by the same call, because the action's docblock names all four in prose and
   * an unstripped scan would compare the offsets of the explanation.
   *
   * ABSENT `Origin` IS ALLOWED and is NOT asserted here: it is the predicate's
   * behaviour, not the route's ordering, and `test/origin.test.mjs` owns it.
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

  /*
   * EVERY MUTATING SURFACE TAKES THE SAME PREDICATE, since 2026-08-28.
   *
   * `originVerdict` was `askOriginVerdict` and lived under `lib/search`,
   * applied by the one endpoint that spends money. Two other mutating surfaces
   * had no check of their own.
   *
   * WHAT REACT ROUTER ALREADY DOES, measured rather than assumed, because it
   * decides what these assertions are for: `throwIfPotentialCSRFAttack` refuses
   * a foreign `origin` on every mutating DOCUMENT request with 400, before
   * middleware. It does NOT run for resource routes, which is what
   * `admin.logout.tsx`, `admin.media.upload.ts`, `admin.preview.ts` and
   * `/theme` are. Those four are the gap, and they are what these cover.
   *
   * Asserted on the SOURCE calling the predicate rather than on a status code,
   * because a status code is `check:browser`'s and verify-live's to observe and
   * this gate is offline. What it can see is that neither route restates the
   * rule.
   */
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

  /*
   * AND THE ABSENT-ORIGIN EXEMPTION SURVIVES, asserted on the predicate itself.
   * A scriptless form post carries no `Origin`; refusing it would break the
   * no-script door hard rule 9 requires, and it is the single easiest thing to
   * "tighten" by accident while fixing a cross-origin hole.
   */
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

  /*
   * THE OPERATOR TOKEN IS REFUSED ON LENGTH BEFORE IT IS HASHED.
   *
   * `constantTimeEqual` hashes BOTH operands so comparison time does not depend
   * on where they diverge, which is right and has one cost: the input side is
   * whatever the caller sent, so hashing it is work an unauthenticated caller
   * can ask for in any quantity. A megabyte of bearer token is a megabyte of
   * SHA-256 before anything has checked who is asking.
   *
   * ASSERTED BY POSITION IN THE FUNCTION'S OWN BODY, which is the same
   * instrument hard rule 19's ordering uses and for the same reason: asserting
   * that the length check merely EXISTS would pass on an arrangement that ran
   * it after the hash, which is the arrangement that buys nothing.
   *
   * OBSERVATION BOUNDARY: this reads SOURCE POSITION, not a runtime measurement.
   * It cannot see that the hash did not run; it can see that the refusal is
   * written before the call. Measuring the hash itself would need the digest
   * instrumented, which no gate here can do.
   */
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

    /*
     * AND DESCRIBE DOES NOT SPEND A RATE-LIMIT UNIT. Metering used to sit
     * inside authentication, so `GET /api/operator`, which takes no arguments
     * and changes nothing, cost the same unit as a publish. Asserted as
     * absence in the loader and presence in the action, because either half
     * alone passes on a build that meters both or neither.
     */
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

  /*
   * EVERY JSON-LD BLOCK GOES THROUGH THE ESCAPING SERIALISER.
   *
   * The contents of a `<script>` element are RAW TEXT: no entities are decoded
   * inside it and the only thing that ends it is the literal `</script`. A
   * title carrying that sequence closes the element early and the rest is
   * parsed as markup. Every block was a bare `JSON.stringify` handed to
   * `dangerouslySetInnerHTML` until 2026-08-28.
   *
   * FOUND BY SCANNING, not from a list. A hand-kept list of emitters is the
   * mirror this repo keeps paying for: the fifth one would be added without it.
   * Every `dangerouslySetInnerHTML` in a route whose element is a `script` with
   * `ld+json` is required to use the helper, and the failure names the file.
   *
   * The speculation-rules blocks are deliberately out of scope: they are the
   * other `<script>` type on the site and their payload is built from
   * `HEADER_PATHS` and a pathname rather than from post content. They have
   * their own gate in `test/header-speculation.test.mjs`.
   */
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

  /*
   * THE LIGHTBOX IS A REAL MODAL DIALOG, asserted on source.
   *
   * ## WHY HERE AND NOT ONLY IN check:browser
   *
   * `check:browser` has the better instrument: it opens the thing and asks the
   * platform whether `dialog:modal` matches, which a div carrying
   * `role="dialog"` cannot fake. That case is SKIPPED on the current corpus,
   * and has been for as long as the skip has existed, because no published post
   * carries a body image, so there is no `.image-link` on any page to click.
   * verify-live reports the same absence.
   *
   * A wire assertion that never runs is not a gate. These are the offline half:
   * weaker, because source text is a claim about behaviour rather than the
   * behaviour, and they run on every commit. When a post gains an image the
   * browser case starts running and becomes the stronger of the two; neither
   * replaces the other.
   *
   * The `div` spelling is refused by name, because that is what this replaced.
   */
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

  const robots = readFileSync(join(root, "app/routes/robots.ts"), "utf8");
  eq(
    "ask: robots.txt disallows /search/ask",
    /Disallow: \/search\/ask/.test(robots),
    true,
  );
}

/* --------------------------------- the Ask index is kept in step by ship -- */

/*
 * `sync:content` REBUILDS D1 AND BOTH FTS INDEXES AND DOES NOT TOUCH AI SEARCH.
 *
 * For a long time the only writers of the answer index were `savePost`, for a
 * post published through the editor, and a human clicking sync-ask in the
 * admin. This site's writing mostly lands by COMMIT, so the index fell behind
 * on every content ship and stayed behind until somebody read an alert.
 *
 * MEASURED 2026-08-23: the scheduled health check went red four polls running
 * at expected 91, present 90, and shipping nine post updates widened it to
 * expected 99, present 90, tracking search_docs growth exactly.
 *
 * Asserted on POSITION and on the FAILURE PATH, not merely on presence. A call
 * that ran before the deploy would upload to a Worker that is about to be
 * replaced, and a call whose result nobody checked would be a step that cannot
 * fail. Both of those pass a presence assertion.
 */
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

  /*
   * ORDER. The upload writes what the DEPLOYED Worker serves, through that
   * Worker's own bindings, so it has to run after the deploy and after the D1
   * sync that produced the records it uploads.
   */
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

  /*
   * THE FAILURE PATH, which is the half that makes the step worth having. A
   * step whose result is discarded is a step that cannot fail, and this one
   * exists precisely because a green ship over a stale index is the defect.
   */
  eq(
    "ask sync: ship reads a converged verdict rather than a status code alone",
    /converged/.test(shipSource),
    true,
  );
  /*
   * THE EXIT CONDITION ITSELF, not a mention of the variable near the exit.
   *
   * REWRITTEN 2026-08-24 BECAUSE A PLANT CAUGHT IT. This read
   * `/mediaMiss[\s\S]{0,900}process\.exit\(1\)/`, and the plant that removed
   * `mediaMiss` from the final guard PASSED: the block still PRINTS the miss on
   * the way out, so the name was inside the window while the control flow no
   * longer consulted it. A 900-character window around an anchor reading its
   * neighbour's compliance is this repo's own recorded class, and the same
   * window shape was already here for the Ask half.
   *
   * The condition is extracted by walking back from the LAST `process.exit(1)`
   * to the `if (` that guards it, so what is asserted is the expression the
   * process actually branches on.
   */
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
  /*
   * And the deploy STANDS. The record must print before the exit, or a missed
   * sync would hide the version that is actually live, which is the one thing
   * an operator needs at that moment.
   */
  const recordAt = shipSource.indexOf('announce("Shipped")');
  const exitAt = shipSource.lastIndexOf("process.exit(1)");
  eq(
    "ask sync: the shipped record prints BEFORE the nonzero exit",
    recordAt !== -1 && exitAt !== -1 && recordAt < exitAt,
    true,
  );

  /*
   * READINESS: SHIP CONSULTS THE HEALTH ENDPOINT, AND IT DOES SO BETWEEN THE
   * DEPLOY AND THE FIRST WRITE.
   *
   * Five 200s from `/colophon` prove the Worker answers. They are blind to a
   * drifted Ask index, a media index that lost its rows, D1 out of step with
   * the repository, and an empty FTS index beside a full content table: all
   * four serve `/colophon` with a 200, and all four are exactly what
   * `/api/health` reports. The scheduled workflow has read that endpoint every
   * fifteen minutes for weeks while the deploy path never asked it once.
   *
   * ASSERTED ON POSITION, on the same principle as the Ask upload above. A
   * readiness check that ran BEFORE the deploy would report on the build being
   * replaced. One that ran AFTER the sync would refuse with production already
   * half converged, which is the state this ordering exists to prevent. Both
   * of those satisfy a presence assertion completely.
   */
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
  /*
   * THE VERDICT IS READ OUT OF THE BODY, not inferred from the status line,
   * and it is ACTED ON. A step that fetched the endpoint and discarded the
   * answer is a step that cannot fail, which is the shape the Ask assertions
   * above were written to catch and the same one applies here.
   *
   * The decision lives in scripts/lib/readiness.mjs so `node:test` can drive
   * every branch of it, on the precedent of ci-status.mjs and ask-converge.mjs.
   * So the assertion is split: ship must CONSULT the verdict and refuse on it,
   * and the module must decide from the parsed body.
   */
  const readinessSource = stripComments(
    readFileSync(join(root, "scripts/lib/readiness.mjs"), "utf8"),
  );
  eq("readiness: the module was read", readinessSource.length > 1000, true);
  eq(
    "readiness: the verdict is decided from the parsed body, not the status",
    /value\.ok\s*!==\s*true/.test(readinessSource),
    true,
  );
  /*
   * AND A BODY WITH NO CHECKS REFUSES. This is what stops the step passing on
   * the wrong URL: any JSON on the origin can carry `ok: true`, and only a
   * health report carries a checks array.
   */
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

  /*
   * THE MEDIA INDEX, THE SAME CONTRACT, ASSERTED SEPARATELY.
   *
   * Added 2026-08-24 with the media sync at ship. Deliberately not folded into
   * the assertions above by widening a regex to match either name: the two
   * steps fail independently, and an assertion satisfied by whichever one
   * happens to be present would pass on the commit that deleted the other. That
   * is the N-1-of-N shape, and this gate has been the one to catch it before.
   */
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
  /*
   * RULE 18, ASSERTED RATHER THAN TRUSTED. The repair goes through the
   * derivation. A tool that wrote rows itself, or took keys from the caller,
   * would make the index a second truth, which is the property check:media
   * exists to hold.
   */
  eq(
    "media sync: the tool repairs THROUGH the derivation, not by writing rows",
    /rebuildMediaIndex\(env\)/.test(apiSource),
    true,
  );
  /*
   * AND THE VERDICT IS READ BACK, not taken from the rebuild's own counters.
   * `rebuildMediaIndex` returns what its loops think they wrote; only
   * `mediaIndexStatus` re-enumerates the sources and reads D1 afterwards.
   */
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

/**
 * Drafts must never reach the AI index.
 *
 * `/search/ask` is unauthenticated and cites the post it answered from, so an
 * uploaded draft is publicly readable by anyone who asks the right question.
 * The classic index filters at QUERY time; Ask cannot, because AI Search has no
 * per-item status to filter on, so the exclusion has to happen at UPLOAD time.
 *
 * This is a regression test for a real leak. On 2026-07-29 five unpublished
 * drafts were staged through the operator path, uploaded unconditionally, and
 * the live Ask endpoint answered from one and cited it by slug.
 *
 * The predicate is re-derived here from the same rule the uploader applies:
 * not a draft, and not scheduled for the future.
 */
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
  // The withdrawn case, which is the one that leaks silently: a post that was
  // published and indexed, then set back to draft, must be REMOVED rather than
  // merely skipped on the next sync.
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
   * COMMENTS STRIPPED BEFORE MATCHING, and this is not tidiness.
   *
   * The assertion below used to be "publishableForAsk(posts) appears at least
   * twice". On 2026-08-19 askIndexStatus stopped calling it, the change wrote a
   * comment EXPLAINING that it used to call it, and the count stayed at two. The
   * gate went green on prose. That is hard rule 10's comment-satisfied anchor,
   * caught here only because the change's author went looking.
   *
   * LIMIT, stated: this removes block comments and whole-line `//` comments. It
   * does not attempt trailing `//`, because a naive pass corrupts a URL inside
   * a string literal, and it does not parse. A pattern hidden in a trailing
   * comment would still satisfy these matches.
   */
  /*
   * **TRAILING `//` COMMENTS ARE STRIPPED TOO, and they were not until
   * 2026-08-22.** The second replace matched only a line comment that BEGINS a
   * line, so a comment written after code survived stripping and could satisfy
   * every needle below.
   *
   * PROVEN BY PLANT rather than by reading. Replacing the real
   * `recordsForPosts(publishableForAsk(posts))` with an unfiltered
   * `recordsForPosts(posts)` and moving the original text into a trailing
   * comment left this gate GREEN. The assertion that no unpublished draft
   * enters the PUBLIC Ask index was satisfiable by a comment, and the absence
   * of that filter is what put five unpublished drafts on `/search/ask` in
   * July.
   *
   * Same form as `check:invariants` now, including the `[^:]` guard so a
   * `https://` inside a string literal is not read as the start of a comment.
   * Four gates still carry their own stripper of differing strength; that is
   * the class, and it is named in the report rather than half-fixed here.
   */
  const askSource = stripComments(askRaw);
  const searchSource = stripComments(searchRaw);

  // SCOPE, ASSERTED. Stripping is only safe if it left something to match. An
  // over-eager stripper would empty the file and every assertion below would
  // report a missing filter that is present.
  // A QUARTER, not a third, since 2026-08-25: the module is deliberately
  // comment-heavy and the artifact-arc change took it to a measured 0.329
  // code ratio, brushing the old guard. The guard exists to tell an emptied
  // file (near zero) from a healthy one, and a quarter still does that.
  eq(
    "stripping comments left the module's code behind",
    askSource.length > askRaw.length / 4 && /export async function syncAskCorpus/.test(askSource),
    true,
  );

  /*
   * SINCE THE ARTIFACT ARC the full-corpus uploader takes no posts argument:
   * it reads `askCorpusRecords`, whose SQL composes `visibilityClause` (rule
   * 1; check:invariants section 8 holds every search_docs reader to it). What
   * this gate still owns is the BINDING: the uploader must source from that
   * one reader and from nothing unfiltered, and the reader's SQL must scope
   * to type='post' with the shared predicate concatenated in. An uploader
   * that re-grew its own SELECT, or a reader that lost the clause, is the
   * five-drafts-in-Ask shape again.
   */
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

  /*
   * THE ASK FILTER COMPOSES THE SHARED PREDICATE RATHER THAN RESTATING IT.
   *
   * The two assertions above prove the filter is CALLED. They cannot see what it
   * DOES, and what it did until 2026-08-23 was restate the visibility rule in a
   * third shape: `draft === true` out, `publishAt > now` out. That agreed with
   * `publiclyVisible()` by inspection and by these greps and by nothing else,
   * and a third hand-rolled copy is exactly what leaked five drafts into Ask on
   * 2026-07-29.
   *
   * So the rule now has ONE JavaScript owner and this binds Ask to it. Scoped to
   * `publishableForAsk`'s own body by brace matching, not to the file: the
   * module's prose names both symbols while explaining them, and a whole-file
   * match would read the comment as the code.
   */
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

  /*
   * THE DRIFT CHECK'S EXPECTED SET, re-scoped 2026-08-19 to the mechanism that
   * replaced the one this used to watch.
   *
   * It no longer recomputes records from the corpus, because doing so cost a
   * 600KB GitHub round trip on every admin page load. It reads the same records
   * out of `search_docs`. So the property worth pinning moved with it: the
   * expected set must come from that query, and that query must compose the
   * shared visibility predicate rather than hand-copying it, and must stay
   * posts-only or the twenty page records read as permanently stale.
   */
  const bodyOf = (/** @type {string} */ src, /** @type {string} */ name) => {
    const start = src.indexOf(`export async function ${name}(`);
    if (start === -1) return "";
    // To the first line that is exactly a closing brace, which is where a
    // top-level function ends in this codebase's formatting.
    const end = src.indexOf("\n}", start);
    return end === -1 ? src.slice(start) : src.slice(start, end + 2);
  };

  /*
   * RE-SCOPED 2026-08-22, from a LINE ARRANGEMENT to the PROPERTY the comment
   * above already says this is for.
   *
   * The needle was `/const expected = new Set\(\(await askExpectedUrls\(env\)\)/`,
   * which pinned one spelling of one line. Running the D1 read and the AI
   * Search listing CONCURRENTLY, which is legitimate and measured, broke it
   * while leaving the binding it exists to protect completely intact: the
   * expected set still comes from `askExpectedUrls` and from nothing else.
   *
   * This is the repo's own rule that a gate broken by a refactor is a finding
   * rather than a fixture to update, applied honestly in the direction it
   * actually points. The finding is that the ASSERTION was wrong, not the
   * refactor: it could not distinguish "reads the expected set from D1" from
   * "reads it from D1 on one physical line", and only the first is the policy.
   *
   * It is scoped to the function BODY rather than the file, on exactly the
   * grounds the block below states: an unanchored needle finds a neighbour's
   * compliance.
   */
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

  eq(
    "askIndexStatus takes its expected set from askExpectedUrls",
    /askExpectedUrls\(env\)/.test(statusBody) &&
      /const expected = new Set\([\s\S]{0,80}\.map\(\(u\) => keyForUrl\(u\)\)\)/.test(statusBody),
    true,
  );

  /*
   * AND FROM NOTHING ELSE, which is the half the old needle got for free by
   * pinning the whole line and which would otherwise be lost. `recordsForPosts`
   * is the corpus-recomputing producer this moved away from; the file-wide
   * check below catches it adjacent to the listing, this catches it anywhere in
   * the body at all.
   */
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
   * SCOPED TO THE FUNCTION BODY, not to a character window after its name.
   *
   * The first draft of these three matched `askExpectedUrls` followed by the
   * needle within 900 characters. A plant that replaced the composed predicate
   * with a hand-copied one PASSED, because `zeroState` sits directly below and
   * composes `visibilityClause(NO_ALIAS)` itself: the window reached into the
   * next function and found a neighbour's compliance. That is hard rule 10's
   * unanchored needle, and it was caught by planting rather than by reading.
   */
  const expectedUrlsBody = bodyOf(searchSource, "askExpectedUrls");

  // SCOPE, ASSERTED, for the same reason as the stripper above: an extractor
  // that returned "" would make all three assertions below report a missing
  // predicate that is present, and an extractor that returned the whole file
  // would make them pass on a neighbour's code, which is the defect that
  // produced this block.
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

// --- Report ---------------------------------------------------------------

/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate is what stands between an operator and the one operation reserved
 * for the human, so a version of it that quietly stopped asserting would be
 * expensive: the policy module would keep its shape while nothing tested the
 * transitions through it.
 *
 * RE-MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-24 by RUNNING it: 138,
 * after the smoke actor's section and the admin-session position guard landed.
 * Never summed. Floored at 128, about seven percent under.
 *
 * The previous pair was 104 measured against a floor of 96, and the floor is
 * moved with the measurement rather than left where it was, because thirty
 * assertions of slack is most of a section able to stop running unnoticed. That
 * is the same arithmetic the entry below this one is about.
 *
 * **THE FLOOR WAS 60 AGAINST 96, which is a third of this gate able to stop
 * running unnoticed.** It was set against a measurement of 59 and never moved
 * while the Ask origin check, the ordered cost chain for hard rule 19 and the
 * operator-token assertions all landed on top of it. That is the largest single
 * gap the 2026-08-24 floor sweep found in a gate whose subject is money paths
 * and delete authority, which is why the slack is not being preserved here:
 * most cases are inline state fixtures driven through the real decide(), so the
 * count moves only when a transition is added to the table or a source
 * assertion is added beside it.
 *
 * RE-MEASURED 2026-08-26 by RUNNING it, after ship gained its readiness step
 * and the four assertions that bind it: 145. The count had already moved to
 * 141 under the 128 floor before this session touched it, so the slack was
 * back to thirteen and is now reset. Floor 128 to 135, about seven percent
 * under, which is the same proportion the 2026-08-24 entry chose.
 */
const MINIMUM_CHECKS = 135;
if (checks < MINIMUM_CHECKS) {
  failures.push(
    `only ${checks} assertions executed, expected at least ${MINIMUM_CHECKS}. ` +
      `A block was SKIPPED rather than failing. Measured 2026-08-26: 145.`,
  );
}

if (failures.length > 0) {
  console.error(`check:policy FAILED, ${failures.length} of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check:policy ok. ${checks} assertions, 0 failures.`);

