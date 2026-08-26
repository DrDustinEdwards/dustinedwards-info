/**
 * Gate: the public script payload is measured, and its ceilings are here.
 *
 *   npm run check:script-payload
 *
 * OBSERVATION BOUNDARY: this reads the BUILD ON DISK under build/client. It
 * does not build, so it measures whatever the last `npm run build` produced:
 * run against a stale build it certifies the stale build, exactly as
 * `npm run deploy` would ship it. It also cannot see the wire; the deployed
 * page's script set is verify-live's assertion, which imports this module's
 * walk so the two cannot disagree about what "the set" means.
 *
 * ## What it measures and why
 *
 * `app/root.tsx` renders `<Scripts />` unconditionally, so every public page
 * hydrates React: the framework floor is the largest thing any reader
 * downloads and nothing measured it. Hard rule 4 grades everything a reader
 * downloads; the stylesheet was split with ceremony while 331 KB raw of
 * hydration script shipped unfloored. This gate makes both numbers visible on
 * every run and refuses growth past the ceilings below.
 *
 * Two subjects:
 *
 *   HYDRATION  every module statically reachable from the client entry plus
 *              the root and blog.$slug route modules, the set the SSR page
 *              emits as modulepreloads. The article page is the payload rule's
 *              stated subject, which is why blog.$slug and not some wider
 *              union; a route outside this set can still grow unwatched, and
 *              that is a stated gap, not an oversight.
 *   ENHANCE    the dynamically imported chunk built from app/enhance/blog.ts,
 *              the "1.59 kB" a published post cites. It is reached by dynamic
 *              import, so the hydration walk deliberately does not include it
 *              and it gets its own ceiling.
 *
 * ## Finding the manifest, measured 2026-08-25
 *
 * There is NO Vite manifest.json under build/client: the react-router build
 * does not emit one (`find build -name manifest.json` comes back empty). What
 * exists is React Router's browser manifest, `assets/manifest-<hash>.js`,
 * carrying `entry` and per-route `module` + `imports`. Those import arrays are
 * the flattened preload lists the SSR page emits, and the walk below re-closes
 * them transitively over each chunk's own static imports anyway, so a chunk
 * the manifest under-listed is still counted.
 *
 * ## Identifying the enhancement chunk
 *
 * The browser manifest maps no source files, so "the chunk built from
 * app/enhance/blog.ts" is identified two-factor and fails closed on both:
 * it must be a DYNAMIC import target of a chunk in the hydration set (that is
 * how BlogEnhancements loads it), and its minified body must carry the string
 * literals the source file carries. Either factor alone can mislead; the name
 * cannot be used at all, because Vite hashes may contain dashes and
 * `blog-<hash>.js` is not distinguishable from a hyphenated basename by
 * pattern.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR = join(root, "build", "client", "assets");
const ENHANCE_SOURCE = join(root, "app", "enhance", "blog.ts");

/**
 * CEILINGS AND FLOOR. The only copies of these numbers, rule 17.
 *
 * MEASURED 2026-08-25 through this gate's own pipeline, on a fresh build of
 * HEAD: hydration 12 files, 331,047 bytes raw, 95,456 bytes brotli; the
 * enhancement chunk 4,177 raw, 1,387 brotli.
 *
 * Margins, stated: the hydration ceiling is the measured 95,456 plus roughly
 * ten percent, room for ordinary edits and dependency patch bumps but not for
 * a new library riding into the shared chunks. The enhancement ceiling is the
 * measured 1,387 plus roughly fifty percent, wide in relative terms because
 * the chunk is tiny and a legitimate feature moves it by whole percents, tight
 * in absolute terms because its job is to catch a dependency wandering into a
 * chunk a published post calls small. The file floor is the measured 12 less
 * two, the same slack discipline check:secrets applies: a walk that reads
 * fewer files than that has lost a route or gone vacuous, not gotten lean.
 */
const HYDRATION_BROTLI_CEILING = 105000;
const ENHANCE_BROTLI_CEILING = 2100;
const MINIMUM_FILES_WALKED = 10;

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/**
 * A chunk name with its content hash stripped: `entry.client-DvLiibbQ.js`
 * becomes `entry.client`.
 *
 * Exported for verify-live, which compares the DEPLOYED page's script set to
 * this walk. Stems rather than full names, because a standalone verify-live
 * run may face a deploy whose hashes predate the build on this disk, and
 * "same chunks, different hashes" is a stale-hash observation rather than a
 * payload defect. Vite hashes are eight base64url characters, which may
 * themselves contain a dash; the pattern anchors on the extension for that
 * reason.
 *
 * @param {string} name
 */
export function chunkStem(name) {
  return name.replace(/-[A-Za-z0-9_-]{8}\.js$/, "");
}

/** @param {Buffer} bytes */
function brotliSize(bytes) {
  return brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
}

/**
 * The React Router browser manifest, parsed, plus its own filename.
 *
 * Fails closed in every direction: no build, no manifest, two manifests, or a
 * manifest that does not parse are all throws, never an empty walk.
 */
export function readClientManifest() {
  /** @type {string[]} */
  let entries;
  try {
    entries = readdirSync(ASSETS_DIR);
  } catch {
    throw new Error(
      `${ASSETS_DIR} is missing or unreadable. This gate measures the build on ` +
        `disk; run npm run build first.`,
    );
  }
  const names = entries.filter((f) => /^manifest-[A-Za-z0-9_-]+\.js$/.test(f));
  if (names.length !== 1) {
    throw new Error(
      `expected exactly one manifest-<hash>.js under build/client/assets, ` +
        `found ${names.length}${names.length ? `: ${names.join(", ")}` : ""}. ` +
        `A stale or partial build; run npm run build.`,
    );
  }
  const source = readFileSync(join(ASSETS_DIR, names[0]), "utf8");
  const manifest = JSON.parse(
    source.slice(source.indexOf("=") + 1, source.lastIndexOf(";")),
  );
  return { manifest, manifestFile: names[0] };
}

/**
 * Static import specifiers of one built chunk, as sibling filenames.
 *
 * Minified output writes `from"./x.js"`, bare `import"./x.js"` and dynamic
 * `import("./x.js")`, any of the three quote characters. Dynamic targets are
 * NOT part of the eager payload and are collected separately, which is how
 * the enhancement chunk is found without being counted as hydration weight.
 *
 * @param {string} source
 * @returns {{ static: string[], dynamic: string[] }}
 */
export function chunkImports(source) {
  /** @type {string[]} */
  const staticTargets = [];
  /** @type {string[]} */
  const dynamicTargets = [];
  for (const match of source.matchAll(/from\s*["'`]\.\/([^"'`]+)["'`]/g)) {
    staticTargets.push(match[1]);
  }
  // Bare static import: `import"./x.js"`. The lookbehind refuses `import(`,
  // property access (`.import`) and identifiers ending in "import".
  for (const match of source.matchAll(/(?<![.(\w])import\s*["'`]\.\/([^"'`]+)["'`]/g)) {
    staticTargets.push(match[1]);
  }
  for (const match of source.matchAll(/import\s*\(\s*["'`]\.\/([^"'`]+)["'`]\s*\)/g)) {
    dynamicTargets.push(match[1]);
  }
  return { static: staticTargets, dynamic: dynamicTargets };
}

/**
 * The hydration set: every JS chunk statically reachable from the client
 * entry, the root module and the blog.$slug route module.
 *
 * Exported for verify-live, which asserts the DEPLOYED post page references
 * exactly this set by filename stem. One derivation, two consumers: a second
 * walk there would drift from this one the first time either moved.
 *
 * @returns {{ files: string[], dynamicTargets: Set<string>, manifestFile: string }}
 */
export function walkHydrationSet() {
  const { manifest, manifestFile } = readClientManifest();

  /** @type {Set<string>} */
  const seed = new Set();
  /** @param {string} url */
  const add = (url) => seed.add(url.replace("/assets/", ""));

  if (!manifest.entry?.module) {
    throw new Error("the manifest carries no entry module; the walk has no seed.");
  }
  add(manifest.entry.module);
  for (const url of manifest.entry.imports ?? []) add(url);

  for (const id of ["root", "routes/blog.$slug"]) {
    const route = manifest.routes?.[id];
    if (!route?.module) {
      throw new Error(
        `route "${id}" is missing from the manifest. The walk would silently ` +
          `measure a smaller page than the one readers get.`,
      );
    }
    add(route.module);
    for (const url of route.imports ?? []) add(url);
  }

  // Re-close transitively over each chunk's own static imports, so a chunk
  // the manifest's flattened arrays under-list is still counted.
  /** @type {Set<string>} */
  const dynamicTargets = new Set();
  const queue = [...seed];
  while (queue.length > 0) {
    const name = /** @type {string} */ (queue.pop());
    const source = readFileSync(join(ASSETS_DIR, name), "utf8");
    const found = chunkImports(source);
    for (const target of found.static) {
      if (!seed.has(target)) {
        seed.add(target);
        queue.push(target);
      }
    }
    for (const target of found.dynamic) dynamicTargets.add(target);
  }

  return { files: [...seed].sort(), dynamicTargets, manifestFile };
}

/**
 * The built chunk `app/enhance/blog.ts` became, identified two-factor.
 *
 * @param {Set<string>} dynamicTargets dynamic-import targets of the hydration set
 * @returns {string} the chunk filename
 */
export function findEnhancementChunk(dynamicTargets) {
  const source = readFileSync(ENHANCE_SOURCE, "utf8");
  // String literals the source carries, matched by CONTENT because esbuild
  // rewrites quote characters. Length-floored so `"click"` does not match
  // every chunk on the page.
  const anchors = [...source.matchAll(/"([^"\\]{8,})"/g)].map((m) => m[1]);
  if (anchors.length < 3) {
    throw new Error(
      `only ${anchors.length} anchor literal(s) found in ${ENHANCE_SOURCE}; ` +
        `the identification would be too weak to trust. The source moved or ` +
        `lost its string literals.`,
    );
  }
  if (dynamicTargets.size === 0) {
    throw new Error(
      "the hydration set dynamically imports nothing, so the enhancement " +
        "chunk is unreachable from the page and this gate cannot find it. " +
        "BlogEnhancements stopped loading it, which is itself the defect.",
    );
  }

  /** @type {string[]} */
  const matches = [];
  for (const name of dynamicTargets) {
    const chunk = readFileSync(join(ASSETS_DIR, name), "utf8");
    const carried = anchors.filter((a) => chunk.includes(a)).length;
    if (carried >= 3) matches.push(name);
  }
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one dynamic-import target carrying app/enhance/blog.ts ` +
        `literals, found ${matches.length}${matches.length ? `: ${matches.join(", ")}` : ""} ` +
        `among ${dynamicTargets.size} target(s).`,
    );
  }
  return matches[0];
}

function main() {
  const { files, dynamicTargets, manifestFile } = walkHydrationSet();

  let raw = 0;
  let brotli = 0;
  for (const name of files) {
    const bytes = readFileSync(join(ASSETS_DIR, name));
    raw += bytes.length;
    brotli += brotliSize(bytes);
  }

  const enhanceName = findEnhancementChunk(dynamicTargets);
  const enhanceBytes = readFileSync(join(ASSETS_DIR, enhanceName));
  const enhanceRaw = enhanceBytes.length;
  const enhanceBrotli = brotliSize(enhanceBytes);

  console.log(`check:script-payload over ${manifestFile}\n`);
  console.log(`  hydration set (entry + root + blog.$slug), ${files.length} file(s):`);
  for (const name of files) console.log(`    ${name}`);
  console.log(`  hydration total: ${raw} bytes raw, ${brotli} bytes brotli`);
  console.log(
    `  enhancement chunk ${enhanceName} (from app/enhance/blog.ts): ` +
      `${enhanceRaw} bytes raw, ${enhanceBrotli} bytes brotli\n`,
  );

  ok(
    `the walk read at least ${MINIMUM_FILES_WALKED} file(s)`,
    files.length >= MINIMUM_FILES_WALKED,
    `only ${files.length} walked. A route module vanished from the manifest or ` +
      `the walk went vacuous; a smaller number here is a broken walk, not a lean page.`,
  );
  ok(
    `hydration brotli total is under ${HYDRATION_BROTLI_CEILING}`,
    brotli <= HYDRATION_BROTLI_CEILING,
    `measured ${brotli} bytes brotli (${raw} raw) across ${files.length} file(s). ` +
      `Something new is riding into every public page's payload; the file list ` +
      `above names the chunks.`,
  );
  ok(
    `enhancement chunk brotli is under ${ENHANCE_BROTLI_CEILING}`,
    enhanceBrotli <= ENHANCE_BROTLI_CEILING,
    `${enhanceName} measured ${enhanceBrotli} bytes brotli (${enhanceRaw} raw). ` +
      `A dependency has wandered into the chunk a published post calls small.`,
  );

  if (failures > 0) {
    console.log(`\n${failures} FAILED of ${checks} checks\n`);
    process.exit(1);
  }
  console.log(`\n${checks} checks, 0 failures\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (/** @type {any} */ error) {
    console.error(
      `check:script-payload failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
