import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createTally } from "./lib/tally.mjs";
import { walkFiles } from "./lib/walk-files.mjs";
import {
  bindingUses,
  findAction,
  intentBranches,
  isLiteralString,
  objectConst,
  parseSource,
  propertyValue,
  stringArrayConst,
} from "./lib/destructive-scan.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES = join(root, "app", "routes");

const PREDICATE = "confirmationSatisfied";

/**
 * DESTRUCTIVE: removes something that cannot be brought back by pressing the
 * inverse control. Each of these must call the predicate inside its own branch.
 */
const DESTRUCTIVE = new Set([
  "admin.posts._index.tsx:bulk-delete",
  "admin.posts.$slug.edit.tsx:delete",
  "admin.media._index.tsx:delete",
  "admin.media._index.tsx:empty-trash",
  // Both destroy records and cannot know their own removal count without running, so both confirm on
  // a count of one.
  "admin.media._index.tsx:rebuild",
  "admin.posts._index.tsx:sync-ask",
  // No recovery path: a row came from a stranger's POST and has no derivation to rebuild it from.
  "admin.mentions.tsx:delete",
  "admin.mentions.tsx:sweep",
  // A retention sweep like the mentions one: the rows have no derivation to rebuild them from.
  "admin.tools.tsx:purge-zero-results",
]);

/**
 * REVERSIBLE, with the reason, because "not destructive" is a judgment and an
 * unexplained entry here is how something destructive gets waved through.
 */
const REVERSIBLE = new Map([
  ["admin.posts._index.tsx:bulk-add-tag", "a tag, undone by remove"],
  ["admin.posts._index.tsx:bulk-remove-tag", "a tag, undone by add"],
  [
    "admin.posts._index.tsx:duplicate",
    "creates a new draft; removes and overwrites nothing, and savePost refuses a slug that exists",
  ],
  [
    "admin.posts._index.tsx:unpublish",
    "sets draft:true, undone by republish; the file, its history and first_published all stand",
  ],
  ["admin.posts._index.tsx:regenerate", "rewrites D1 rows from the artifact, idempotent"],
  ["admin.posts._index.tsx:reset-ask-budget", "a counter; see the report, no data is lost"],
  ["admin.posts.$slug.edit.tsx:preview-link", "mints, removes nothing"],
  ["admin.posts.$slug.edit.tsx:revoke-preview-link", "revokes access; fails in the safe direction"],
  ["admin.media._index.tsx:trash", "a D1 flag; the object and its URL are untouched"],
  ["admin.media._index.tsx:restore", "the inverse of trash"],
  ["admin.media._index.tsx:bulk-trash", "trash, in bulk; same flag"],
  ["admin.media._index.tsx:bulk-add-tag", "a tag, undone by remove"],
  ["admin.media._index.tsx:bulk-remove-tag", "a tag, undone by add"],
  ["admin.media._index.tsx:set-tags", "replaces the tag set; retypable"],
  ["admin.media._index.tsx:set-alt", "overwrites alt text; retypable"],
  [
    "admin.mentions.tsx:approve",
    "sets a decision on a verified mention, undone by reject: the DB layer's " +
      "decidable set holds approved and rejected alongside pending precisely so " +
      "the pair is a two-way door, and no column is removed either way",
  ],
  ["admin.mentions.tsx:reject", "the inverse of approve, on the same two-way door"],
  [
    "admin.tools.tsx:podcast-slot",
    "overwrites which episode the home page features; the feed is untouched and the slot is re-pickable",
  ],
]);

// One upload path is selected by a shared predicate rather than an intent string, so this detector
// cannot see it, nor any future intent routed the same way.

const tally = createTally({ blankLine: true });
const { ok } = tally;

console.log("\ncheck:destructive\n");

if (!existsSync(ROUTES)) {
  console.log(`\n  FAIL  ${ROUTES} is missing.`);
  process.exit(1);
}

const files = readdirSync(ROUTES).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
ok(
  "the route directory yielded files to scan",
  files.length >= 34,
  `found ${files.length}, floor 34, measured 37 on 2026-08-24; a glob that stops matching would otherwise report zero problems`,
);

const found = new Set();
let actionFiles = 0;

for (const file of files) {
  const sf = parseSource(file, readFileSync(join(ROUTES, file), "utf8"));
  const action = findAction(sf);
  if (!action) continue;
  actionFiles += 1;

  // Every intent this action BRANCHES on, read off the syntax tree so a comment cannot add one and
  // `form.get("intent") === "x"` is seen as well as `intent === "x"`. The comparison is the
  // vocabulary: a value only reaches a destructive path by being tested for here.
  const branches = intentBranches(action, PREDICATE);
  for (const b of branches) found.add(`${file}:${b.intent}`);

  // Every comparison of a destructive intent must select code that calls the predicate. An intent
  // tested twice is held at both sites, so a guard in a sibling path cannot stand in for it, and a
  // comment naming the predicate is not a call.
  for (const b of branches) {
    const id = `${file}:${b.intent}`;
    if (!DESTRUCTIVE.has(id)) continue;
    ok(`${id}: its branch parses`, !b.reason, `${b.reason}, so nothing was examined`);
    if (b.reason) continue;
    ok(
      `${id}: the confirmation is checked in the ACTION`,
      b.guarded,
      `the branch handling this destructive intent never calls ${PREDICATE}(). ` +
        `If the confirmation moved to an onClick or onSubmit handler, it is gone ` +
        `for every reader without JavaScript while the destruction is not.`,
    );
  }
}

ok(
  "route modules exporting an action were found",
  actionFiles >= 12,
  `only ${actionFiles} matched, floor 12, measured 13 on 2026-08-24; the action detector stopped matching`,
);
ok(
  "the intent vocabulary is non-empty",
  found.size >= 17,
  `parsed ${found.size} intent(s), floor 17, measured 19 on 2026-08-24; every per-intent assertion above is vacuous if this is empty`,
);

// A new intent nobody classified fails by name rather than defaulting to safe.
for (const id of found) {
  ok(
    `${id} is classified`,
    DESTRUCTIVE.has(id) || REVERSIBLE.has(id),
    `a new intent is handled by an action and nobody has said whether it ` +
      `destroys anything. Add it to DESTRUCTIVE (and guard it) or to ` +
      `REVERSIBLE with the reason.`,
  );
}
for (const id of [...DESTRUCTIVE, ...REVERSIBLE.keys()]) {
  ok(
    `${id} still exists`,
    found.has(id),
    "classified here but no action branches on it; the entry is stale",
  );
}

console.log(`  ${actionFiles} action module(s), ${found.size} intent(s), ${DESTRUCTIVE.size} destructive`);

// The operator API is a bearer-token POST dispatched on a tool name, which the intent vocabulary cannot
// see. For a machine caller the credential is the ceremony, so each tool declares a policy instead.
{
  const apiPath = join(root, "app", "lib", "operator", "descriptors.ts");
  const apiTree = parseSource(apiPath, readFileSync(apiPath, "utf8"));

  const toolsBlock = stringArrayConst(apiTree, "TOOLS");
  ok(
    "the operator TOOLS list was located",
    toolsBlock !== null,
    "nothing below examines anything, so every tool would read as classified",
  );
  const toolNames = toolsBlock ?? [];

  /* An empty parse classifies nothing and reports what a compliant surface reports. */
  ok(
    "the operator tool list parsed",
    toolNames.length >= 9,
    `parsed ${toolNames.length} tool(s), floor 9, measured 11. A zero-scope parse agrees with anything.`,
  );

  /**
   * DESTRUCTIVE operator tools. Each removes something no derivation can
   * rebuild, and each must declare its policy in TOOL_DESCRIPTORS.
   */
  const OPERATOR_DESTRUCTIVE = new Set(["delete_post", "decide_mention"]);

  /** REVERSIBLE, with the reason, because "not destructive" is a judgment. */
  const OPERATOR_REVERSIBLE = new Map([
    ["list_posts", "a read"],
    ["get_post", "a read"],
    ["sync_status", "a read"],
    ["list_mentions", "a read"],
    [
      "save_post",
      "creates or edits a post through the same door the editor uses; the file, " +
        "its git history and first_published all stand, and unpublish is a field " +
        "change rather than a removal",
    ],
    [
      "sync_ask",
      "converges a DERIVED index to the corpus through its own derivation, which " +
        "hard rule 18 calls repair rather than destruction. Idempotent, and it " +
        "reports a read-back reconciliation rather than its own counters",
    ],
    ["sync_media", "the media index, on sync_ask's terms: derived, idempotent, read back"],
    ["sync_posts", "D1 rows, on sync_ask's terms: derived from the repository, idempotent"],
    [
      "backup_media",
      "COPIES ONLY. It has no delete branch in either bucket and nothing is ever " +
        "copied backup to media; check:destructive's own MEDIA_BACKUP sweep below " +
        "is what holds that",
    ],
    [
      "upload_media",
      "ADDS ONLY, and cannot overwrite anything with different bytes: the key is " +
        "a digest of the content, so the one object a second upload can land on " +
        "is the byte-identical one it just recomputed. It has no delete branch, " +
        "it writes to MEDIA alone, and the annotation row goes through " +
        "upsertMediaRecord the way every other writer's does",
    ],
  ]);

  for (const name of toolNames) {
    ok(
      `operator tool ${name} is classified`,
      OPERATOR_DESTRUCTIVE.has(name) || OPERATOR_REVERSIBLE.has(name),
      `a tool is callable over the operator token and nobody has said whether it ` +
        `destroys anything. Add it to OPERATOR_DESTRUCTIVE (and give it a policy in ` +
        `TOOL_DESCRIPTORS) or to OPERATOR_REVERSIBLE with the reason.`,
    );
  }
  for (const name of [...OPERATOR_DESTRUCTIVE, ...OPERATOR_REVERSIBLE.keys()]) {
    ok(
      `operator classification ${name} still names a live tool`,
      toolNames.includes(name),
      "classified here but absent from TOOLS; the entry is stale",
    );
  }

  // `policy` is a property whose value is a non-empty string literal, read off the syntax tree, so
  // neither prose nor a comment can satisfy it and the layout of the object does not matter.
  const descriptors = objectConst(apiTree, "TOOL_DESCRIPTORS");
  ok(
    "the operator TOOL_DESCRIPTORS object was located",
    descriptors !== null,
    "no descriptor below could be examined",
  );
  for (const name of OPERATOR_DESTRUCTIVE) {
    const entry = descriptors ? propertyValue(descriptors, name) : null;
    const descriptor = entry && ts.isObjectLiteralExpression(entry) ? entry : null;
    ok(
      `${name}: its TOOL_DESCRIPTORS entry was located`,
      descriptor !== null,
      "the assertion below would examine nothing",
    );
    ok(
      `${name}: declares the policy that refuses it`,
      descriptor !== null && isLiteralString(propertyValue(descriptor, "policy")),
      `a destructive tool with no \`policy\` in its descriptor is one an agent ` +
        `discovers by being refused. GET /api/operator serves this block, so the ` +
        `refusal is documented before it is hit.`,
    );
  }
}


// Whole-source, not routes: any line anywhere that deletes from the binding is the danger. It reads the
// syntax tree because every file touching this binding has a comment naming both.
{
  /** @param {string} dir @returns {string[]} */
  const walk = (dir) =>
    existsSync(dir)
      ? walkFiles(dir, {
          keep: (name) => /\.(ts|tsx|mjs|js)$/.test(name),
          skipDir: (name) => name === "node_modules" || name === "dist",
        })
      : [];

  /**
   * Read off the syntax tree: a comment naming the binding is not a use, `env["MEDIA_BACKUP"]` and a
   * local alias are, and a delete is only one whose receiver IS the binding.
   *
   * @param {string} name
   * @param {string} text
   */
  const backupUses = (name, text) => bindingUses(parseSource(name, text), "MEDIA_BACKUP");

  // A matcher that cannot detect the violation agrees with every file it reads, so it is proven first.
  ok(
    "the backup-delete scan detects a real delete",
    backupUses("c.ts", "await env.MEDIA_BACKUP.delete(key);").deletes.length === 1,
    "it matched nothing, so the sweep below would pass over a genuine violation",
  );
  ok(
    "the backup-delete scan follows a local alias",
    backupUses("c.ts", "const b = env.MEDIA_BACKUP; await b.delete(key);").deletes.length === 1,
    "a delete through `const b = env.MEDIA_BACKUP` would pass unseen",
  );
  ok(
    "the backup-delete scan ignores a put",
    backupUses("c.ts", "await env.MEDIA_BACKUP.put(key, body);").deletes.length === 0,
    "a scan that fires on any use of the binding would be unusable",
  );
  ok(
    "the backup-delete scan does not fire on a delete from MEDIA",
    backupUses("c.ts", "await env.MEDIA.delete(key); const b = env.MEDIA_BACKUP;").deletes.length === 0,
    "deleting a media object is legitimate; only the mirror is protected",
  );

  /**
   * Functions the binding may be handed to, with the reason, keyed by file and callee. A helper can
   * delete from what it is given, so a new call site fails by name until someone has read it.
   */
  const BACKUP_PASSED_TO = new Map([
    ["app/lib/media/backup.server.ts:listAll", "pages through bucket.list() and returns the objects; it has no other call"],
  ]);

  const sources = [
    ...walk(join(root, "app")),
    ...walk(join(root, "workers")),
    ...walk(join(root, "scripts")),
  ];

  // A walk that returned nothing would report a clean sweep.
  ok(
    "the backup sweep read a non-empty source tree",
    sources.length >= 100,
    `only ${sources.length} file(s) were read, so a clean result means nothing`,
  );

  let mentioning = 0;
  /** @type {string[]} */
  const violations = [];
  /** @type {Set<string>} */
  const passedSeen = new Set();
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    if (!text.includes("MEDIA_BACKUP")) continue;
    const rel = file.slice(root.length + 1).replaceAll("\\", "/");
    const uses = backupUses(file, text);
    if (uses.mentions === 0) continue;
    mentioning += 1;
    for (const hit of uses.deletes) violations.push(`${rel}: ${hit}`);
    for (const callee of uses.passedTo) {
      const id = `${rel}:${callee}`;
      passedSeen.add(id);
      ok(
        `${id} is handed MEDIA_BACKUP and has been read`,
        BACKUP_PASSED_TO.has(id),
        "a function given the backup binding can delete from it where this sweep cannot see. " +
          "Read it, and add it to BACKUP_PASSED_TO with the reason it cannot delete.",
      );
    }
  }
  for (const id of BACKUP_PASSED_TO.keys()) {
    ok(`${id} is still handed MEDIA_BACKUP`, passedSeen.has(id), "the entry is stale");
  }

  // Zero files naming the binding means it was renamed, and every assertion above would be true of nothing.
  ok(
    "at least one source file reaches the MEDIA_BACKUP binding",
    mentioning > 0,
    "no file names it, so either the mirror is gone or this gate is watching a " +
      "binding that no longer exists",
  );

  ok(
    "no source deletes from the backup bucket",
    violations.length === 0,
    `${violations.length} delete(s) against MEDIA_BACKUP: ${violations.join(" | ")}`,
  );

  console.log(
    `  backup bucket: ${sources.length} source file(s) swept, ${mentioning} reach ` +
      `MEDIA_BACKUP, ${violations.length} delete from it`,
  );
}

// Measured by running this gate. Not raised on every addition: its job is to catch a whole block being skipped.
const MINIMUM_CHECKS = 99;
tally.floor("check:destructive", "checks", MINIMUM_CHECKS);

console.log(`\n${tally.checks} checks, ${tally.failures} failure${tally.failures === 1 ? "" : "s"}\n`);
process.exit(tally.failures > 0 ? 1 : 0);
