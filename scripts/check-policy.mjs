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

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decide, forceFirstPublished, readState, PolicyError } from "../app/lib/editor/publish-policy.mjs";

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
  const askSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "app", "lib", "search", "ask.server.ts"),
    "utf8",
  );
  eq(
    "syncAskCorpus filters through publishableForAsk",
    /recordsForPosts\(publishableForAsk\(posts\)\)/.test(askSource),
    true,
  );
  eq(
    "syncAskPost refuses a non-publishable post",
    /askPublishable\(post\)\s*\?\s*recordsForPosts\(\[post\]\)\s*:\s*\[\]/.test(askSource),
    true,
  );
  eq(
    "askIndexStatus uses the same filter",
    (askSource.match(/publishableForAsk\(posts\)/g) ?? []).length >= 2,
    true,
  );
}

// --- Report ---------------------------------------------------------------

if (failures.length > 0) {
  console.error(`check:policy FAILED, ${failures.length} of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check:policy ok. ${checks} assertions, 0 failures.`);

