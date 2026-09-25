// The operator publish policy, and the admin plane's smoke and session guards that enforce it.
// Every rule has its paired negative: a policy that only refuses has not been shown to permit anything.

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
import { assertFloor } from "./lib/floor.mjs";
import { createTally } from "./lib/tally.mjs";
import { walkFiles } from "./lib/walk-files.mjs";

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
{
  const out = forceFirstPublished(file({ draft: false }), "2026-07-28");
  eq("forceFirstPublished keeps the body", out.trimEnd().endsWith("Body."), true);
  eq("forceFirstPublished keeps other keys", out.includes("slug: t"), true);
  eq("forceFirstPublished keeps the draft flag", readState(out).draft, false);
}

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
  ["unpublish a live post", file({ draft: true }), file({ draft: false, firstPublished: "2026-01-01" })],
  ["republish a withdrawn post", file({ draft: false }), file({ draft: true, firstPublished: "2026-01-01" })],
  ["publish for the first time", file({ draft: false }), file({ draft: true })],
  ["create an already published post", file({ draft: false }), null],
];

for (const [what, incomingRaw, priorRaw] of EVERY_TRANSITION) {
  refuses(
    `smoke cannot ${what}`,
    () => decide({ actor: SMOKE, incomingRaw: String(incomingRaw), priorRaw: /** @type {string | null} */ (priorRaw) }),
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

  const mentions = [];
  for (let at = src.indexOf("SMOKE_READ_ONLY_POLICY"); at !== -1; at = src.indexOf("SMOKE_READ_ONLY_POLICY", at + 1)) {
    const lineStart = src.lastIndexOf("\n", at) + 1;
    if (!/^\s*import\b/.test(src.slice(lineStart, at))) mentions.push(at);
  }
  eq("the smoke refusal exists in admin.tsx, outside comments and imports", mentions.length > 0, true);
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

  /** @type {string[]} */
  const constructors = [];
  for (const full of walkFiles(join(root, "app"), { keep: (name) => /\.(ts|tsx|mjs)$/.test(name) })) {
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

  eq("the admin-session reader scan found a reader to check", readers.length > 0, true);
  eq(
    "and the readers are the ones this rule was written against",
    readers.sort().join(", "),
    "admin.posts.$slug.edit.tsx",
  );
}

{
  const r = decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: file({ draft: true }) });
  const stamped = readState(r.raw).firstPublished;
  eq("admin first publish stamps a date", typeof stamped === "string" && /^\d{4}-\d{2}-\d{2}$/.test(stamped), true);
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
  eq("and the raw written out carries the file's value", readState(r.raw).firstPublished, "2026-01-01");
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
  permits("delete: the admin is permitted", () =>
    decideDelete({ actor: { kind: "admin" } }),
  );

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

  const publishSrc = readFileSync(join(root, "app/lib/editor/publish.server.ts"), "utf8");
  const at = publishSrc.indexOf("export async function deletePost(");
  eq("delete: deletePost exists to be checked", at !== -1, true);
  const body = functionBody(publishSrc, /export async function deletePost\(/);
  eq("delete: deletePost's body parses", body.length > 0, true);
  eq("delete: deletePost calls decideDelete in its own body",
    /decideDelete\(\s*\{\s*actor\s*\}\s*\)/.test(body), true);

  /* BEFORE THE FILE READ, or the difference between two errors tells a caller which slugs exist. */
  eq("delete: the decision precedes the file read",
    body.indexOf("decideDelete") < body.indexOf("readFile("), true);
}

/* Measured by running this gate, and it moves with the measurement: slack is the defect. */
const MINIMUM_CHECKS = 77;
const floorBreach = assertFloor("check:policy", "checks", tally.checks, MINIMUM_CHECKS);
if (floorBreach) tally.fail(floorBreach);

if (tally.failures > 0) {
  console.error(`check:policy FAILED, ${tally.failures} of ${tally.checks} checks:\n`);
  for (const f of tally.failed) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check:policy ok. ${tally.checks} assertions, 0 failures.`);
