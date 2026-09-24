import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";

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
]);

// One upload path is selected by a shared predicate rather than an intent string, so this detector
// cannot see it, nor any future intent routed the same way.

let checks = 0;
let failures = 0;

/**
 * Condition first: a string literal in argument one is always truthy.
 *
 * @param {boolean} ok
 * @param {string} label
 * @param {string} [detail]
 */
function assertThat(ok, label, detail) {
  checks += 1;
  if (ok) return;
  failures += 1;
  console.log(`\n  FAIL  ${label}`);
  if (detail) console.log(`        ${detail}`);
}

/**
 * Preserves length so offsets still index.
 * @param {string} src
 */
function strip(src) {
  const out = src.split("");
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "/*") {
      let j = src.indexOf("*/", i + 2);
      if (j === -1) j = src.length;
      for (let k = i; k < Math.min(j + 2, src.length); k++) if (out[k] !== "\n") out[k] = " ";
      i = j + 2;
      continue;
    }
    if (two === "//") {
      let j = src.indexOf("\n", i);
      if (j === -1) j = src.length;
      for (let k = i; k < j; k++) out[k] = " ";
      i = j;
      continue;
    }
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === c) break;
        j++;
      }
      // The literal's BODY is blanked but its delimiters are kept, so an
      // `intent === "x"` comparison is still findable on the raw text while
      // brace matching cannot be thrown by a brace inside a string.
      for (let k = i + 1; k < Math.min(j, src.length); k++) if (out[k] !== "\n") out[k] = " ";
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join("");
}

/** @param {string} s @param {number} open */
function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

console.log("\ncheck:destructive\n");

if (!existsSync(ROUTES)) {
  console.log(`\n  FAIL  ${ROUTES} is missing.`);
  process.exit(1);
}

const files = readdirSync(ROUTES).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
assertThat(
  files.length >= 34,
  "the route directory yielded files to scan",
  `found ${files.length}, floor 34, measured 37 on 2026-08-24; a glob that stops matching would otherwise report zero problems`,
);

const found = new Set();
let actionFiles = 0;

for (const file of files) {
  const raw = readFileSync(join(ROUTES, file), "utf8");
  if (!/export\s+async\s+function\s+action|export\s+const\s+action/.test(raw)) continue;
  actionFiles += 1;
  const bare = strip(raw);

  // Every intent this module BRANCHES on. The comparison is the vocabulary:
  // a value only reaches a destructive path by being tested for here.
  for (const m of raw.matchAll(/intent\s*===\s*"([^"]+)"/g)) {
    found.add(`${file}:${m[1]}`);
  }

  for (const id of [...found].filter((k) => k.startsWith(`${file}:`))) {
    const intent = id.slice(file.length + 1);
    if (!DESTRUCTIVE.has(id)) continue;

    // The smallest branch that tests this intent: one intent is tested twice in its file, and the outer
    // condition would be satisfied by a guard in a sibling path.
    /** @type {{ text: string, size: number } | null} */
    let smallest = null;
    for (const m of raw.matchAll(new RegExp(`intent\\s*===\\s*"${intent}"`, "g"))) {
      // Offsets come from raw and are used against bare, `strip` preserving length. Brace matching runs on
      // the stripped text, or a brace inside a string throws it.
      const open = bare.indexOf("{", m.index);
      if (open === -1) continue;
      const close = matchBrace(bare, open);
      if (close === -1) continue;
      const size = close - open;
      if (!smallest || size < smallest.size) {
        smallest = { text: raw.slice(open, close), size };
      }
    }

    assertThat(
      smallest !== null,
      `${id}: its branch parses`,
      "no braced branch was found for this intent, so nothing was examined",
    );
    if (!smallest) continue;

    assertThat(
      smallest.text.includes(PREDICATE),
      `${id}: the confirmation is checked in the ACTION`,
      `the branch handling this destructive intent never calls ${PREDICATE}(). ` +
        `If the confirmation moved to an onClick or onSubmit handler, it is gone ` +
        `for every reader without JavaScript while the destruction is not.`,
    );
  }
}

assertThat(
  actionFiles >= 12,
  "route modules exporting an action were found",
  `only ${actionFiles} matched, floor 12, measured 13 on 2026-08-24; the action detector stopped matching`,
);
assertThat(
  found.size >= 17,
  "the intent vocabulary is non-empty",
  `parsed ${found.size} intent(s), floor 17, measured 19 on 2026-08-24; every per-intent assertion above is vacuous if this is empty`,
);

// A new intent nobody classified fails by name rather than defaulting to safe.
for (const id of found) {
  assertThat(
    DESTRUCTIVE.has(id) || REVERSIBLE.has(id),
    `${id} is classified`,
    `a new intent is handled by an action and nobody has said whether it ` +
      `destroys anything. Add it to DESTRUCTIVE (and guard it) or to ` +
      `REVERSIBLE with the reason.`,
  );
}
for (const id of [...DESTRUCTIVE, ...REVERSIBLE.keys()]) {
  assertThat(
    found.has(id),
    `${id} still exists`,
    "classified here but no action branches on it; the entry is stale",
  );
}

console.log(`  ${actionFiles} action module(s), ${found.size} intent(s), ${DESTRUCTIVE.size} destructive`);

// The operator API is a bearer-token POST dispatched on a tool name, which the intent vocabulary cannot
// see. For a machine caller the credential is the ceremony, so each tool declares a policy instead.
{
  const apiPath = join(root, "app", "lib", "operator", "api.server.ts");
  const apiRaw = readFileSync(apiPath, "utf8");

  const toolsBlock = apiRaw.match(/const TOOLS = \[([\s\S]*?)\] as const;/);
  assertThat(
    toolsBlock !== null,
    "the operator TOOLS list was located",
    "nothing below examines anything, so every tool would read as classified",
  );
  const toolNames = toolsBlock
    ? [...toolsBlock[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1])
    : [];

  /* An empty parse classifies nothing and reports what a compliant surface reports. */
  assertThat(
    toolNames.length >= 9,
    "the operator tool list parsed",
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
    assertThat(
      OPERATOR_DESTRUCTIVE.has(name) || OPERATOR_REVERSIBLE.has(name),
      `operator tool ${name} is classified`,
      `a tool is callable over the operator token and nobody has said whether it ` +
        `destroys anything. Add it to OPERATOR_DESTRUCTIVE (and give it a policy in ` +
        `TOOL_DESCRIPTORS) or to OPERATOR_REVERSIBLE with the reason.`,
    );
  }
  for (const name of [...OPERATOR_DESTRUCTIVE, ...OPERATOR_REVERSIBLE.keys()]) {
    assertThat(
      toolNames.includes(name),
      `operator classification ${name} still names a live tool`,
      "classified here but absent from TOOLS; the entry is stale",
    );
  }

  // `policy` is a property with a string-literal value, so prose cannot satisfy it and comments can stay.
  for (const name of OPERATOR_DESTRUCTIVE) {
    const descriptor = apiRaw.match(
      new RegExp(`\\n  ${name}: \\{([\\s\\S]*?)\\n  \\},`),
    );
    assertThat(
      descriptor !== null,
      `${name}: its TOOL_DESCRIPTORS entry was located`,
      "the assertion below would examine nothing",
    );
    assertThat(
      descriptor !== null && /\bpolicy:\s*$|\bpolicy:\s*"/m.test(descriptor[1]),
      `${name}: declares the policy that refuses it`,
      `a destructive tool with no \`policy\` in its descriptor is one an agent ` +
        `discovers by being refused. GET /api/operator serves this block, so the ` +
        `refusal is documented before it is hit.`,
    );
  }
}


// Whole-source, not routes: any line anywhere that deletes from the binding is the danger. Comments are
// stripped first because every file touching this binding has a sentence naming both.
{
  /** @param {string} dir @returns {string[]} */
  const walk = (dir) => {
    if (!existsSync(dir)) return [];
    /** @type {string[]} */
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        out.push(...walk(full));
      } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  };

  /**
   * The window makes it an anchored needle: a file may name the binding and, far away, delete from
   * something else.
   *
   * @param {string} stripped
   * @returns {string[]} offending excerpts
   */
  const backupDeletes = (stripped) => {
    /** @type {string[]} */
    const hits = [];
    const needle = /MEDIA_BACKUP/g;
    for (let m = needle.exec(stripped); m; m = needle.exec(stripped)) {
      const window = stripped.slice(m.index, m.index + 120);
      if (/\.\s*delete\s*\(/.test(window)) hits.push(window.replace(/\s+/g, " ").slice(0, 100));
    }
    return hits;
  };

  // A matcher that cannot detect the violation agrees with every file it reads, so the needle is proven first.
  assertThat(
    backupDeletes("await env.MEDIA_BACKUP.delete(key);").length === 1,
    "the backup-delete needle detects a real delete",
    "it matched nothing, so the sweep below would pass over a genuine violation",
  );
  assertThat(
    backupDeletes("await env.MEDIA_BACKUP.put(key, body);").length === 0,
    "the backup-delete needle ignores a put",
    "a needle that fires on any use of the binding would be unusable",
  );
  assertThat(
    backupDeletes("await env.MEDIA.delete(key); const b = env.MEDIA_BACKUP;").length === 0,
    "the backup-delete needle does not fire on a delete from MEDIA",
    "deleting a media object is legitimate; only the mirror is protected",
  );

  // Excluded by name, never by glob: the control above is a string literal containing the violation hunted.
  const SELF = join(root, "scripts", "check-destructive.mjs");
  const sources = [
    ...walk(join(root, "app")),
    ...walk(join(root, "workers")),
    ...walk(join(root, "scripts")),
  ].filter((file) => file !== SELF);

  // A walk that returned nothing would report a clean sweep.
  assertThat(
    sources.length >= 100,
    "the backup sweep read a non-empty source tree",
    `only ${sources.length} file(s) were read, so a clean result means nothing`,
  );

  let mentioning = 0;
  /** @type {string[]} */
  const violations = [];
  for (const file of sources) {
    const stripped = strip(readFileSync(file, "utf8"));
    if (!stripped.includes("MEDIA_BACKUP")) continue;
    mentioning += 1;
    for (const hit of backupDeletes(stripped)) {
      violations.push(`${file.slice(root.length + 1)}: ${hit}`);
    }
  }

  // Zero files naming the binding means it was renamed, and every assertion above would be true of nothing.
  assertThat(
    mentioning > 0,
    "at least one source file reaches the MEDIA_BACKUP binding",
    "no file names it, so either the mirror is gone or this gate is watching a " +
      "binding that no longer exists",
  );

  assertThat(
    violations.length === 0,
    "no source deletes from the backup bucket",
    `${violations.length} delete(s) against MEDIA_BACKUP: ${violations.join(" | ")}`,
  );

  console.log(
    `  backup bucket: ${sources.length} source file(s) swept, ${mentioning} reach ` +
      `MEDIA_BACKUP, ${violations.length} delete from it`,
  );
}

// Measured by running this gate. Not raised on every addition: its job is to catch a whole block being skipped.
const MINIMUM_CHECKS = 99;
const floorBreach = assertFloor("check:destructive", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) assertThat(false, "this gate executed its assertions", floorBreach);

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
