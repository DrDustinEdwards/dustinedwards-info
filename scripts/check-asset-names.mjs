/**
 * Gate: every file a reader, crawler or agent can download is named `dustin-edwards-...` (ruling 127).
 *   npm run check:asset-names
 * BOUNDARY: offline. It walks `public/`, asserts both key WRITERS emit the prefix, and reads each
 * extension route's SOURCE for a prefixed download name. The objects already in R2 are
 * `check:media`'s, which lists the buckets on the network tier and applies the same rule.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { ogImageKey } from "../app/lib/content/pipeline.mjs";
import { ASSET_PREFIX, contentKey, isContentKey } from "../app/lib/media/classify.mjs";
import {
  EXEMPT_ROUTES,
  EXEMPT_STATIC,
  EXEMPT_STATIC_PATTERNS,
  objectKeyProblem,
  staticNameProblem,
} from "./lib/asset-names.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(root, "public");

console.log("\ncheck:asset-names\n");

let checks = 0;
let failures = 0;
/** @param {string} label @param {boolean} ok @param {string} [detail] */
function assert(label, ok, detail = "") {
  checks += 1;
  if (ok) return;
  failures += 1;
  console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
}

/**
 * EVERY file, not `walkPublic()`: that one skips named non-assets, and a skipped file can still be
 * served, which is the name this gate exists to see.
 * @param {string} dir @returns {string[]}
 */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() ? [`/${relative(PUBLIC_DIR, full).split(sep).join("/")}`] : [];
  });
}

// 1. public/: the inventory the job asked for, then the rule.
const files = walk(PUBLIC_DIR).sort();
let compliant = 0;
let exempt = 0;
for (const file of files) {
  const problem = staticNameProblem(file);
  const base = file.slice(file.lastIndexOf("/") + 1);
  if (base.startsWith(ASSET_PREFIX)) compliant += 1;
  else if (!problem) exempt += 1;
  assert(`public${file}`, problem === null, problem ?? "");
}
console.log(`  public/: ${files.length} file(s), ${compliant} prefixed, ${exempt} exempt`);
// The floor counts the COMMITTED files: the twins exist only after a build, so counting them would
// move the floor by 36 between a clean checkout and a built one.
const committed = files.filter((f) => !EXEMPT_STATIC_PATTERNS.some((p) => p.test.test(f)));

// An exemption naming a file that is gone is a list nobody reads; it goes when the file does.
for (const path of EXEMPT_STATIC.keys()) {
  assert(`exemption ${path} names a file that exists`, files.includes(path));
}

// 2. The writers. A new upload and a new card must be born compliant, not repaired later.
const digest = Uint8Array.from({ length: 32 }, (_, i) => i).buffer;
for (const [label, key] of [
  ["upload with a name", contentKey(digest, "webp", { width: 800, height: 600 }, "Cohort 2017.jpg")],
  ["upload with no usable name", contentKey(digest, "svg", null, "...")],
  ["upload with no name", contentKey(digest, "pdf")],
]) {
  assert(`contentKey (${label}) emits a prefixed key`, objectKeyProblem(key) === null, key);
  assert(`contentKey (${label}) is read back as a content key`, isContentKey(key), key);
}
const card = ogImageKey({ slug: "a-post", title: "A post", description: "d", publishAt: null });
assert("ogImageKey emits a prefixed social card key", objectKeyProblem(card) === null, card);

// 3. Routes whose URL ends in an extension: exempt by name, or they set a prefixed filename.
const routesSource = readFileSync(join(root, "app", "routes.ts"), "utf8");
const extensionRoutes = [
  ...routesSource.matchAll(/route\("([^"]*\.[a-z]+)",\s*"([^"]+)"\)/g),
].map((m) => ({ path: m[1], file: m[2] }));
for (const { path, file } of extensionRoutes) {
  if (EXEMPT_ROUTES.has(path)) continue;
  const source = readFileSync(join(root, "app", file), "utf8");
  // exportHeaders is the one door that sets a download name, and it adds the prefix itself.
  assert(
    `/${path} sets a prefixed download name`,
    /exportHeaders\([^)]*,[^)]*,\s*[`"]/.test(source),
    `${file} returns a file without a Content-Disposition filename; use exportHeaders`,
  );
}
for (const path of EXEMPT_ROUTES.keys()) {
  assert(
    `exempt route ${path} still exists`,
    extensionRoutes.some((r) => r.path === path),
  );
}
console.log(`  routes: ${extensionRoutes.length} with an extension, ${EXEMPT_ROUTES.size} exempt`);

const floorBreaches = [
  assertFloor("check:asset-names", "public-files", committed.length, 57),
  assertFloor("check:asset-names", "extension-routes", extensionRoutes.length, 17),
].filter(Boolean);
for (const breach of floorBreaches) assert("this gate walked what it claims", false, breach ?? "");

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\ncheck:asset-names ok. ${checks} checks\n`);
