/**
 * Gate: what a reader downloads to see a public page, per route, with ceilings.
 *
 *   npm run check:page-payload
 *
 * ## RENAMED FROM check:script-payload, 2026-08-27, because the old name was
 * ## the old scope
 *
 * It graded the four enhancement bundles, which is the JavaScript, while rule 4
 * names "everything a reader downloads to see a page". The stylesheet was in
 * that sentence and in no gate: 45,778 bytes on every route with no ceiling
 * anywhere, and the largest single resource on the site, the font, had none
 * either. The whole-page section is at the bottom of this file; everything
 * above it is the script gate, unchanged and still doing its job.
 *
 * OBSERVATION BOUNDARY: this reads the BUILD ON DISK under build/client and
 * the bundles under app/enhance/dist. It does not build, so run against a
 * stale build it certifies the stale build, exactly as `npm run deploy` would
 * ship it. It also cannot see a RENDERED page: the public plane is
 * server-rendered at request time, so "the page carries only enhancement
 * script tags" is a claim about a response, asserted by check:browser against
 * the preview and by verify-live section 16 against the wire. What this gate
 * CAN see offline is the build's shape (every bundle emitted verbatim, every
 * served asset syntactically runnable) and the source's shape (hydration is
 * opt-in and only the admin plane and its door opt in).
 *
 * ## What changed here, 2026-08-26
 *
 * Until the public plane stopped hydrating, this gate's subject was the
 * hydration set: 12 files, 95,456 bytes brotli that every public reader
 * downloaded, plus one dynamically imported enhancement chunk. The framework
 * no longer rides on public pages, so the public payload IS the enhancement
 * bundles, measured per module below. The manifest walk survives as a
 * structural floor (a manifest that stops listing routes is a broken build,
 * whoever downloads it), and verify-live imports it for stem comparison; its
 * brotli ceiling is gone because its subject is now the admin plane's payload,
 * which rule 4 does not grade.
 *
 * ## Identifying the enhancement assets
 *
 * By BYTE EQUALITY against app/enhance/dist/, not by name (a Vite hash may
 * contain a dash) and not by content anchors (the old two-factor match, which
 * existed because the chunk used to be compiled out of the source; a ?url
 * asset is the dist file verbatim, so equality is available and exact). Each
 * bundle must match exactly one asset: zero means the ?url import stopped
 * serving it or the build is stale relative to dist, two means the walk can no
 * longer tell them apart.
 *
 * ## The syntax pass
 *
 * `?url` copies bytes verbatim, so a ?url import pointed at the .ts SOURCE
 * ships raw TypeScript that parses nowhere (measured 2026-07-28). Every .js
 * asset in the build is therefore syntax-checked with `node --check` on a
 * .mjs copy, an instrument independent of the bundler that produced them, and
 * the failure names the file.
 */

import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";

// The gate-side comment stripper, per the one-helper discipline: a gate
// reading source can be satisfied by a comment, so comments go first.
import { stripComments } from "./lib/strip-comments.mjs";
// The per-route resolution, pure and therefore testable, on the footing
// ci-status.mjs and ask-converge.mjs stand on. Grounds in that file.
import {
  fontsIn,
  reachableAssets,
  stylesheetsFor,
} from "./lib/page-payload.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR = join(root, "build", "client", "assets");
const DIST_DIR = join(root, "app", "enhance", "dist");

/**
 * CEILINGS AND FLOORS. The only copies of these numbers, rule 17.
 *
 * MEASURED 2026-08-27 through this gate's own pipeline on a fresh build of the
 * working tree, after the palette stopped riding on every document: ask 3,010
 * raw / 1,342 brotli; blog 4,514 / 1,477; palette 11,050 / 3,878; theme 1,795 /
 * 671. Theme carries the palette loader now and roughly doubled; palette lost
 * the gesture bindings that moved into it. Margins are the old enhancement-chunk
 * discipline: roughly fifty percent over measured, wide in relative terms
 * because the bundles are tiny and a legitimate feature moves one by whole
 * percents, tight in absolute terms because the job is catching a dependency
 * wandering in. The palette carries ask inlined (a bundle may not import), so
 * a growth in ask moves palette too; that coupling is deliberate and the
 * ceilings absorb it.
 *
 * A module missing from this map fails: a new enhancement arrives with its own
 * measured ceiling in the same commit, or not at all.
 *
 * @type {Record<string, number>}
 */
const ENHANCE_BROTLI_CEILINGS = {
  "ask.js": 2000,
  "blog.js": 2100,
  "palette.js": 6000,
  "theme.js": 1000,
};

/**
 * Floor on the manifest walk, the old discipline kept: a walk that reads
 * fewer files than this has lost a route or gone vacuous, not gotten lean.
 * Re-measured 2026-08-26 after the loaders left the hydration set: 12 files.
 */
const MINIMUM_FILES_WALKED = 8;

/** Floor on the syntax pass, so an empty assets directory cannot pass it. */
const MINIMUM_ASSETS_SYNTAX_CHECKED = 15;

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
 * the enhancement set. Stems rather than full names, because a standalone
 * verify-live run may face a deploy whose hashes predate the build on this
 * disk, and "same chunks, different hashes" is a stale-hash observation rather
 * than a payload defect. Vite hashes are eight base64url characters, which may
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
 * `import("./x.js")`, any of the three quote characters.
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
 * Every JS chunk statically reachable from the client entry, the root module
 * and the blog.$slug route module.
 *
 * This is the set the framework WOULD hand a hydrating page, kept as a
 * structural floor on the manifest and for verify-live's stem comparison. No
 * public page references it any more; the admin plane and /login still do.
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
        `route "${id}" is missing from the manifest. The build lost a route.`,
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
 * The enhancement bundles as the build serves them, matched by byte equality
 * against app/enhance/dist/.
 *
 * Exported for verify-live: the stems of these asset names are the ONLY
 * script references a live public page may carry.
 *
 * @returns {Array<{ module: string, assetName: string | null, matches: number, raw: number, brotli: number }>}
 */
export function enhancementAssets() {
  /** @type {string[]} */
  let distFiles;
  try {
    distFiles = readdirSync(DIST_DIR).filter((f) => f.endsWith(".js"));
  } catch {
    throw new Error(
      `${DIST_DIR} is missing. The bundles are built by npm run build:enhance, ` +
        `which every runner executes before this gate; run it first.`,
    );
  }
  if (distFiles.length === 0) {
    throw new Error(`${DIST_DIR} holds no bundles; run npm run build:enhance.`);
  }

  const assetNames = readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".js"));
  return distFiles.sort().map((module) => {
    const distBytes = readFileSync(join(DIST_DIR, module));
    const matches = assetNames.filter((name) =>
      distBytes.equals(readFileSync(join(ASSETS_DIR, name))),
    );
    return {
      module,
      assetName: matches.length === 1 ? matches[0] : null,
      matches: matches.length,
      raw: distBytes.length,
      brotli: brotliSize(distBytes),
    };
  });
}

/**
 * Every source file under one directory, recursively.
 *
 * ONE WALKER, ONE ARGUMENT ORDER, hoisted 2026-09-06 when a second section
 * needed it. Two inline copies of a recursive walk is the shape hard rule 10's
 * helper-signature line names: they agree until one of them gains an extension
 * and the other silently stops reading it.
 *
 * @param {string} dir
 * @returns {string[]} absolute paths
 */
function walkSource(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSource(full));
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function main() {
  const { files, manifestFile } = walkHydrationSet();
  const bundles = enhancementAssets();

  console.log(`check:page-payload over ${manifestFile}\n`);
  console.log(`  manifest walk (entry + root + blog.$slug), ${files.length} file(s)`);
  for (const b of bundles) {
    console.log(
      `  ${b.module}: ${b.raw} bytes raw, ${b.brotli} bytes brotli` +
        (b.assetName ? `, served as ${b.assetName}` : `, ${b.matches} byte-equal asset(s)`),
    );
  }
  console.log("");

  ok(
    `the manifest walk read at least ${MINIMUM_FILES_WALKED} file(s)`,
    files.length >= MINIMUM_FILES_WALKED,
    `only ${files.length} walked. A route module vanished from the manifest or the ` +
      `walk went vacuous; a smaller number here is a broken walk, not a lean build.`,
  );

  /* ---- every bundle is served verbatim, and its ceiling holds ------------ */

  for (const b of bundles) {
    ok(
      `${b.module} is served verbatim: exactly one byte-equal asset`,
      b.matches === 1,
      `${b.matches} asset(s) in build/client/assets are byte-equal to ` +
        `app/enhance/dist/${b.module}. Zero means the ?url import stopped serving ` +
        `the bundle (or the build is stale relative to dist: rebuild both); the ` +
        `syntax pass below names the file if raw TypeScript is being served.`,
    );

    const ceiling = ENHANCE_BROTLI_CEILINGS[b.module];
    ok(
      `${b.module} has a measured ceiling in this gate`,
      ceiling !== undefined,
      `no ceiling for ${b.module}. A new enhancement bundle arrives with its own ` +
        `measured ceiling in the same commit.`,
    );
    if (ceiling !== undefined) {
      ok(
        `${b.module} brotli is under ${ceiling}`,
        b.brotli <= ceiling,
        `measured ${b.brotli} bytes brotli (${b.raw} raw). A dependency has wandered ` +
          `into a bundle the public payload rule calls small.`,
      );
    }
  }
  const ceilingOnly = Object.keys(ENHANCE_BROTLI_CEILINGS).filter(
    (name) => !bundles.some((b) => b.module === name),
  );
  ok(
    "every ceiling names a bundle that exists",
    ceilingOnly.length === 0,
    `${ceilingOnly.join(", ")} carry ceilings but no bundle; the map is describing ` +
      `a repo that no longer exists.`,
  );

  /* ---- the syntax pass: every served .js asset actually parses ----------- */

  const scratch = join(root, "node_modules", ".cache", "check-page-payload");
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  /*
   * .ts AND .tsx TOO, not only .js, because the plant that motivated this
   * pass produces one: a ?url import pointed at `app/enhance/blog.ts` emits
   * the raw source as `blog-<hash>.ts` (measured 2026-08-26), so a .js-only
   * sweep would grade every healthy asset and skip the defective one. A
   * TypeScript extension under assets/ is also refused outright below, since
   * no browser parses it whatever its content.
   */
  const assetNames = readdirSync(ASSETS_DIR).filter((f) => /\.(js|ts|tsx|mts|mjs)$/.test(f));
  const tsAssets = assetNames.filter((f) => /\.(ts|tsx|mts)$/.test(f));
  ok(
    "no TypeScript source is emitted as an asset",
    tsAssets.length === 0,
    `[${tsAssets.join(", ")}] under build/client/assets. A ?url import is pointed at ` +
      `a .ts source instead of its dist bundle; the browser will be served raw ` +
      `TypeScript.`,
  );
  /** @type {string[]} */
  const invalid = [];
  for (const name of assetNames) {
    // node --check honours the ES-module parse goal only for .mjs, and every
    // asset here is a module.
    const copy = join(scratch, `${name}.mjs`);
    copyFileSync(join(ASSETS_DIR, name), copy);
    const parsed = spawnSync(process.execPath, ["--check", copy], { encoding: "utf8" });
    if (parsed.status !== 0) {
      // The Error line specifically: --check's stderr ends with a blank line
      // and the Node version, which is what a tail slice grabs instead.
      const errorLine =
        (parsed.stderr || "").split("\n").find((line) => /Error/.test(line)) ??
        (parsed.stderr || "").trim().split("\n")[0] ??
        "no stderr";
      invalid.push(`${name}: ${errorLine.trim()}`);
    }
  }
  rmSync(scratch, { recursive: true, force: true });
  /*
   * DELIBERATELY NOT an `assertFloor`, and the reason is what the number is.
   *
   * This counts BUILT CHUNKS, not assertions this gate executed. It is a SCOPE
   * floor in hard rule 10's sense: it proves the syntax pass below has something
   * to examine, and it guards a partial build. Measured 2026-09-05 it stands at
   * 78 against a floor of 15, which looks like drift and is not: the chunk count
   * is a property of the bundler's splitting on the day, and pinning it near 78
   * would fail every build that happens to emit fewer.
   *
   * `check:floors` compares executed counts against their floors and would read
   * that gap as drift, so this floor stays out of the mechanism rather than
   * being given a tolerance wide enough to be meaningless. The scope floors are
   * their own sweep.
   */
  ok(
    `the syntax pass examined at least ${MINIMUM_ASSETS_SYNTAX_CHECKED} asset(s)`,
    assetNames.length >= MINIMUM_ASSETS_SYNTAX_CHECKED,
    `only ${assetNames.length} .js asset(s) under build/client/assets; the pass ` +
      `below is examining a partial build.`,
  );
  ok(
    "every served .js asset parses as a module (node --check)",
    invalid.length === 0,
    `unparseable asset(s), most likely a ?url import pointed at TypeScript ` +
      `source instead of its dist bundle:\n        ${invalid.join("\n        ")}`,
  );

  /* ---- hydration is opt-in, and only the admin plane and its door opt in - */

  /*
   * The routes that hydrate are found by reading every route file for a
   * `hydrate: true` handle, comments stripped, and the resulting set is pinned
   * to exactly admin.tsx (which covers its children) and login.tsx. A public
   * route gaining the flag fails HERE, by name, before check:browser ever has
   * to notice the framework riding back onto a reading page.
   */
  const routesDir = join(root, "app", "routes");
  const hydrating = readdirSync(routesDir)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /hydrate\s*:\s*true/.test(stripComments(readFileSync(join(routesDir, f), "utf8"))))
    .sort();
  ok(
    "hydration opt-in is exactly the admin layout and the login door",
    hydrating.join(", ") === "admin.tsx, login.tsx",
    `route file(s) carrying hydrate: true: [${hydrating.join(", ")}], expected ` +
      `[admin.tsx, login.tsx]. A public route opted into hydration, or the admin ` +
      `plane lost it.`,
  );

  /*
   * And root.tsx only renders the framework's scripts behind that flag. The
   * window is the Layout return, bounded by the two literals; a gate reading
   * source can be satisfied by a comment, so comments are stripped first.
   */
  const rootSource = stripComments(readFileSync(join(root, "app", "root.tsx"), "utf8"));
  const scriptsAt = rootSource.indexOf("<Scripts");
  const guardAt = rootSource.indexOf("hydrates ? (");
  ok(
    "root.tsx renders <Scripts> exactly once, behind the hydrate guard",
    scriptsAt !== -1 &&
      rootSource.indexOf("<Scripts", scriptsAt + 1) === -1 &&
      guardAt !== -1 &&
      guardAt < scriptsAt,
    `expected one <Scripts inside the "hydrates ? (" conditional in app/root.tsx; ` +
      `an unconditional <Scripts> hydrates every public page again.`,
  );

  /* ------------------------------- no ineffective dynamic import */

  /*
   * A DYNAMIC IMPORT THAT SPLITS NOTHING, which is the shape Rolldown prints
   * INEFFECTIVE_DYNAMIC_IMPORT for on every build.
   *
   * `admin.posts.$slug.revisions.tsx` carried one for months. It wrote
   * `await import("~/lib/editor/github.server")` three lines below its own
   * STATIC import of the same module, and five other modules imported it
   * statically too, so the chunk was in the graph however that line was
   * written. The warning was printed on every build and had become scenery,
   * which is the failure this assertion exists to end: the next one is a red
   * gate rather than a line in a wall of build output.
   *
   * OBSERVATION BOUNDARY, and it is the important paragraph here. **This does
   * NOT read the build log.** No gate in this repo runs the build, and a log
   * written by the last build is a claim that ages exactly like the stale build
   * this gate's own header warns about. So it derives the bundler's criterion
   * from SOURCE instead: a dynamic import is ineffective when some module in
   * the same graph also imports that module statically. What it therefore
   * cannot see is anything the resolver below cannot resolve, which is
   * deliberate and enumerated: bare package specifiers (`shiki/wasm`) and
   * virtual modules (`virtual:react-router/server-build`) are skipped, because
   * this scan has no view of node_modules or of the plugin graph.
   *
   * The one dynamic import it does judge is the CodeMirror lazy split, which is
   * hard rule 4's only lazy boundary on the admin plane, so this doubles as the
   * assertion that the split is still a split.
   */
  const importScopeDirs = [join(root, "app"), join(root, "workers")];
  const importScope = importScopeDirs.flatMap((dir) => walkSource(dir));

  ok(
    "the dynamic-import scan walked a non-empty scope",
    importScope.length >= 150,
    `walked ${importScope.length} source file(s) under app/ and workers/. A scan over ` +
      `nothing reports what a clean scan reports.`,
  );

  /**
   * Every ineffective dynamic import in a set of {path, source} records.
   *
   * A pure function over its input, not a reader of the disk, because the
   * self-test below has to be able to run it against synthetic sources. That is
   * the documented cure for a per-item assertion whose real collection can
   * legitimately shrink to nothing (VERIFICATION.md, check:secrets): the checks
   * stay falsifiable no matter what the tree happens to contain.
   */
  const findIneffectiveDynamicImports = (/** @type {Array<{path: string, source: string}>} */ files) => {
    // Resolution is by NORMALISED SPECIFIER rather than by resolved file path.
    // `~/lib/editor/github.server` and a relative spelling of the same module
    // would not match here, and that is stated rather than hidden: this catches
    // the shape that actually occurs, which is one project alias used
    // consistently. A path resolver would need to replicate the vite alias
    // table, which is a second statement of a fact tsconfig already owns.
    const normalise = (/** @type {string} */ spec, /** @type {string} */ from) => {
      if (spec.startsWith("~/")) return spec.slice(2);
      if (!spec.startsWith(".")) return null; // bare package or virtual module
      const parts = dirname(from).split(/[\\/]/);
      for (const segment of spec.split("/")) {
        if (segment === ".") continue;
        else if (segment === "..") parts.pop();
        else parts.push(segment);
      }
      const joined = parts.join("/");
      const cut = joined.lastIndexOf("/app/") >= 0 ? joined.lastIndexOf("/app/") + 5 : 0;
      return joined.slice(cut);
    };

    /** @type {Map<string, string[]>} module -> files importing it statically */
    const statics = new Map();
    /** @type {Array<{module: string, path: string}>} */
    const dynamics = [];

    for (const { path, source } of files) {
      const code = stripComments(source);
      for (const m of code.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
        const key = normalise(m[1], path);
        if (!key) continue;
        if (!statics.has(key)) statics.set(key, []);
        /** @type {string[]} */ (statics.get(key)).push(path);
      }
      // `import(` preceded by a type position (`: import(`, `<import(`) is
      // erased by TypeScript and never reaches the bundler, so it is not one.
      for (const m of code.matchAll(/(^|[^:<\w])import\(\s*["']([^"']+)["']\s*\)/g)) {
        const key = normalise(m[2], path);
        if (key) dynamics.push({ module: key, path });
      }
    }

    return dynamics
      .filter((d) => statics.has(d.module))
      .map((d) => ({
        ...d,
        importers: /** @type {string[]} */ (statics.get(d.module)),
      }));
  };

  // SELF-TEST, on every execution. Two synthetic files, one of which MUST be
  // reported and one of which must not, so the finder is proven able to fire
  // even on the day the real tree contains no dynamic import at all.
  const selfTest = findIneffectiveDynamicImports([
    { path: "app/a.tsx", source: 'import { x } from "~/lib/thing";\nconst y = import("~/lib/thing");' },
    { path: "app/b.tsx", source: 'const z = import("~/lib/only-dynamic");' },
  ]);
  ok(
    "the dynamic-import finder reports the ineffective case and only that one",
    selfTest.length === 1 && selfTest[0].module === "lib/thing",
    `the finder returned ${JSON.stringify(selfTest.map((s) => s.module))} for a pair ` +
      `built to contain exactly one ineffective import. It cannot be trusted about the ` +
      `real tree until it can tell these two apart.`,
  );

  const ineffective = findIneffectiveDynamicImports(
    importScope.map((path) => ({
      // Relative to the repo root, so the failure names a path someone can
      // open. A fixed-depth tail was tried and printed the checkout directory
      // for anything three levels down, which the first plant showed.
      path: relative(root, path).split("\\").join("/"),
      source: readFileSync(path, "utf8"),
    })),
  );
  ok(
    "no dynamic import is defeated by a static import of the same module",
    ineffective.length === 0,
    ineffective
      .map(
        (d) =>
          `${d.path} dynamically imports ${d.module}, which is ALSO imported ` +
          `statically by ${d.importers.join(", ")}. Rolldown prints ` +
          `INEFFECTIVE_DYNAMIC_IMPORT for this and splits nothing.`,
      )
      .join("\n        "),
  );

  gradeBuildOnlyDependencies();

  gradeEveryPage();

  if (failures > 0) {
    console.log(`\n${failures} FAILED of ${checks} checks\n`);
    process.exit(1);
  }
  console.log(`\n${checks} checks, 0 failures\n`);
}

/**
 * A NATIVE BUILD-TIME DEPENDENCY MAY NOT REACH THE WORKER, in either bundle.
 *
 * ## The subject, and why it is this gate's
 *
 * `sharp` arrived 2026-09-06 so `build:assets` could derive a body placeholder
 * for every static content image. It is a native libvips binding: Node only,
 * platform specific, tens of megabytes of prebuilt binary. `workerd` has no
 * filesystem and no native modules, so an import that reached the Worker would
 * not be a size problem, it would be a Worker that fails to start.
 *
 * This gate owns it because it is the only one that READS THE BUILD ON DISK and
 * fails closed when there is none. Every other candidate would have had to
 * either skip when the build is absent, which is the vacuous branch
 * `check:contrast` already paid for, or assert on source alone.
 *
 * ## THREE ASSERTIONS, AND THE FIRST TWO ARE NOT THE POINT
 *
 * A source scan says nobody wrote the import today. The manifest says nobody
 * declared it as a runtime dependency. Neither is evidence about what SHIPPED:
 * FAILURES.md's line is that a plant is proven in the artifact the gate reads,
 * and the artifact here is `build/server/index.js`. So the third assertion
 * greps the emitted Worker, which is what a deploy uploads.
 *
 * The scan and the manifest stay because they name the defect at the right
 * altitude when it happens: "you imported sharp in app/lib/x.ts" is a fix, and
 * "the Worker bundle mentions sharp" is a hunt.
 */
function gradeBuildOnlyDependencies() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

  ok(
    "sharp is a devDependency and not a runtime dependency",
    Boolean(pkg.devDependencies?.sharp) && !pkg.dependencies?.sharp,
    `sharp is ${pkg.dependencies?.sharp ? "in dependencies" : "not in devDependencies"}. ` +
      `It is a native Node binding used by build:assets and nothing else.`,
  );
  ok(
    "sharp is pinned to an exact version",
    /^\d+\.\d+\.\d+$/.test(String(pkg.devDependencies?.sharp ?? "")),
    `sharp is "${pkg.devDependencies?.sharp}". A range would let a minor bump change ` +
      `the encoder that writes every committed placeholder, and the manifest is a ` +
      `byte-gated artifact.`,
  );

  /*
   * THE SOURCE SCAN. Comments stripped, because a comment that names the module
   * has both satisfied and failed an assertion in this repo before, and the
   * paragraph above this function is itself full of the word.
   */
  const importers = [];
  for (const dir of ["app", "workers"]) {
    for (const file of walkSource(join(root, dir))) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (/\bfrom\s*["']sharp["']|\brequire\(\s*["']sharp["']\s*\)|\bimport\(\s*["']sharp["']/.test(code)) {
        importers.push(relative(root, file).split("\\").join("/"));
      }
    }
  }
  ok(
    "nothing under app/ or workers/ imports sharp",
    importers.length === 0,
    `${importers.join(", ")} imports sharp. It is a native Node module; workerd has ` +
      `no native modules, so this is a Worker that does not start.`,
  );
  /*
   * SCOPE, ASSERTED. A walk that read nothing agrees with a clean tree, which
   * is the zero-scope class in hard rule 10.
   */
  const scanned = walkSource(join(root, "app")).length + walkSource(join(root, "workers")).length;
  ok(
    "the import scan read a plausible number of source files",
    scanned >= 100,
    `scanned ${scanned} file(s) under app/ and workers/. A scan this small is a ` +
      `broken walk, and a broken walk finds no importer either.`,
  );

  /*
   * THE ARTIFACT. `build/server/index.js` is what wrangler uploads.
   *
   * A bare substring, not an import pattern: the bundler rewrites the syntax
   * and a require of a native module can survive as a string, a banner or an
   * external. Anything mentioning it at all is worth failing on, because
   * nothing legitimate in the Worker has cause to.
   */
  const serverBundle = join(root, "build", "server", "index.js");
  let bundle = "";
  try {
    bundle = readFileSync(serverBundle, "utf8");
  } catch {
    /* Falls to the assertion below, which names the missing build. */
  }
  ok(
    "the Worker bundle is on disk to be read",
    bundle.length > 0,
    `${relative(root, serverBundle)} is missing or empty. This gate measures the ` +
      `build on disk; run npm run build first.`,
  );
  ok(
    "the built Worker does not carry sharp",
    bundle.length > 0 && !/["']sharp["']/.test(bundle),
    `build/server/index.js mentions sharp. Something under app/ or workers/ reached ` +
      `a build-only module, and the deploy would upload it.`,
  );
}

/**
 * THE WHOLE PAGE, PER ROUTE. Rule 4's actual subject.
 *
 * The gate above grades the four enhancement bundles, which is the JavaScript.
 * Rule 4 names "everything a reader downloads to see a page", and until
 * 2026-08-27 the stylesheet was not in that number at all: a 45,778-byte sheet
 * rode on every route with no ceiling anywhere, and the font that is the
 * largest single resource on the site had none either.
 *
 * ## WHAT IT RESOLVES, AND FROM WHERE
 *
 * Offline, from the build on disk plus the source, per `lib/page-payload.mjs`:
 *
 *   stylesheets   React Router's browser manifest, root's plus the route's,
 *                 which is the list it emits link tags from
 *   bundles       reachability over the route's import graph for
 *                 `~/enhance/dist/*.js?url` specifiers
 *   fonts         `@font-face` src urls inside the stylesheets above
 *
 * ## WHAT IT REFUSES
 *
 *   a reachable font that is not preloaded, unless exempt with a written reason
 *   a stylesheet set over its per-route ceiling
 *   a route's whole cold load over its ceiling
 *   an enhancement bundle reachable from a route that has no markup for it
 *
 * ## WHAT IT DELIBERATELY DOES NOT OWN
 *
 * The speculation self-reference. `test/header-speculation.test.mjs` asserts
 * that a page is excluded from its own speculation rule, and asserting it here as
 * well would be two owners for one fact, which is rule 17 in the direction that
 * costs most: two copies that can disagree. Named here so a reader looking for
 * it does not conclude it is ungated.
 *
 * It also cannot see a RENDERED page. Reachability over-approximates, which is
 * the safe direction for a ceiling, and the wire half is `check:browser`.
 */

/**
 * PER-ROUTE CEILINGS, in BROTLI bytes. The only copies, rule 17.
 *
 * MEASURED 2026-08-27 through this gate's own pipeline on a fresh build, after
 * the per-route CSS split. `css` is every stylesheet the route links; `total`
 * adds the enhancement bundles it serves. Fonts are excluded from `total` and
 * asserted separately, because the normal face is shared by every route and
 * counting it into eight totals would say the site is eight fonts heavy.
 *
 * Margins are roughly twenty percent over measured, which is tighter than the
 * per-bundle margins above and deliberately so: a stylesheet grows by a rule at
 * a time rather than by a dependency at a time, so a twenty percent jump is a
 * decision somebody should have to make in this file.
 *
 * A route missing from this map FAILS, in both directions, against the derived
 * public route set below.
 *
 * @type {Record<string, { id: string, css: number, total: number }>}
 */
const ROUTE_CEILINGS = {
  "/": { id: "routes/home", css: 5300, total: 6300 },
  "/blog": { id: "routes/blog._index", css: 5800, total: 6800 },
  "/blog/:slug": { id: "routes/blog.$slug", css: 7300, total: 10000 },
  /*
   * MEASURED 2026-09-03 through this gate on a fresh build: css 4797 over three
   * sheets, 5615 total. The ceilings are `/blog`'s, which are the same numbers
   * twenty percent over would give and are the right ones on their own terms:
   * this is the same kind of listing, rendering the same cards from the same
   * stylesheets, so the two pages should be graded against one bar rather than
   * drifting apart by whichever happened to be measured later.
   */
  "/blog/tags/:tag": { id: "routes/blog.tags.$tag", css: 5800, total: 6800 },
  /*
   * MEASURED 2026-09-04 through this gate on a fresh build: css 4797 over three
   * sheets, 5615 total, which is the tag archive's figure to the byte because
   * it is the same page shape linking the same two stylesheets. The ceilings
   * are the tag archive's for the same reason: one bar for one kind of page,
   * rather than two that drift apart by whichever was measured later.
   */
  "/blog/series/:series": { id: "routes/blog.series.$series", css: 5800, total: 6800 },
  "/search": { id: "routes/search", css: 6100, total: 8700 },
  "/projects": { id: "routes/projects", css: 5300, total: 6300 },
  "/colophon": { id: "routes/colophon", css: 5700, total: 6600 },
  "/playground": { id: "routes/playground", css: 6600, total: 7500 },
  "/phage-discovery": { id: "routes/phage-discovery", css: 5700, total: 6600 },
  "/privacy": { id: "routes/privacy", css: 5700, total: 6600 },
  /*
   * MEASURED 2026-09-11 through this gate on a fresh build: css 4976 over two
   * sheets, 5794 total. That is /privacy and /colophon to the BYTE, which is
   * the whole argument for these ceilings being theirs rather than a fresh
   * margin drawn around this one page: it is the same page shape, app.css
   * plus prose.css, serving the same single enhancement bundle. One bar for
   * one kind of page, rather than three that drift apart by whichever
   * happened to be measured last, which is the reasoning the tag and series
   * archives above are already on.
   */
  "/about": { id: "routes/about", css: 5700, total: 6600 },
};

/**
 * THE MATH VARIANT'S CEILINGS, in BROTLI bytes. The only copies, rule 17.
 *
 * MEASURED 2026-09-06 through this gate on a fresh build: `/blog/:slug` is css
 * 6,493 over four sheets and 9,099 total; the math stylesheet adds 2,819, so a
 * post with an expression in it is css 9,312 and 11,918 total.
 *
 * The margins are `/blog/:slug`'s own, proportionally: 12 percent on css and 10
 * on the total, which is what that route carries and is the right bar because
 * this IS that route, with one more sheet. A wider margin would be room for the
 * stylesheet to grow, and the stylesheet is generated from a pinned package and
 * cannot grow without a version bump somebody chose.
 */
const MATH_CEILING = { css: 10500, total: 13200 };

/**
 * Floor on the faces the math stylesheet names.
 *
 * MEASURED 2026-09-06 through this gate: 20, which is katex 0.16.47's whole
 * woff2 set. A floor rather than an equality so an upstream face ADDED in a
 * later version does not fail the gate, while the trim in `build-katex.mjs`
 * quietly dropping one does.
 */
const MINIMUM_MATH_FACES = 20;

/**
 * Fonts that are reachable and deliberately NOT preloaded, with the reason.
 *
 * The italic face is 79,716 bytes and is needed only by a page that renders
 * italic latin text. Its `unicode-range` already makes the browser fetch it on
 * demand, and a preload that goes unused within a few seconds is worse than
 * none: the browser warns, and the bytes compete with the ones that were
 * needed. That reasoning is root.tsx's; this names the file that owns it rather
 * than repeating the argument where it could drift.
 *
 * @type {Record<string, string>}
 */
const PRELOAD_EXEMPT = {
  "inter-latin-italic": "loaded on demand by unicode-range; see app/root.tsx, links",
};

/**
 * Which routes may serve which enhancement bundle, by the markup it upgrades.
 *
 * The palette is `false` everywhere on purpose: it is fetched by `theme.ts` on
 * the first search gesture from a URL on a data attribute, so no import graph
 * should reach it, and a route that starts reaching it has put a search dialog
 * back on a document.
 */
const BUNDLE_USE = {
  "theme.js": () => true,
  "blog.js": (/** @type {string} */ id) => id === "routes/blog.$slug",
  "ask.js": (/** @type {string} */ id) => id === "routes/search",
  "palette.js": () => false,
};

function gradeEveryPage() {
  const { manifest } = readClientManifest();
  const appDir = join(root, "app");
  const clientDir = join(root, "build", "client");
  const routesDir = join(root, "app", "routes");
  const rootModule = join(appDir, "root.tsx");
  const rootSource = readFileSync(rootModule, "utf8");

  /** Source, or null when the path is not a file this walk can read. */
  const read = (/** @type {string} */ path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  };

  /** An asset path from the manifest to the file on disk. */
  const assetFile = (/** @type {string} */ assetPath) =>
    join(clientDir, assetPath.replace(/^\//, ""));

  /*
   * THE ROUTE SET IS DERIVED, then reconciled against the ceilings in BOTH
   * directions. A route that exports the shared cache headers is a public HTML
   * route, which is the same rule `check:browser` uses to build its
   * byte-identity list, so the two gates cannot disagree about what public
   * means. The feeds and the markdown twin are shared-cached and are not HTML,
   * so they are excluded by the same pattern that file uses.
   */
  const publicRoutes = readdirSync(routesDir)
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) => {
      const code = stripComments(readFileSync(join(routesDir, name), "utf8"));
      return /publicHtmlHeaders\(/.test(code) || /SHARED_CACHE_CONTROL/.test(code);
    })
    .filter((name) => !/^(blog\.(feed|rss)|blog\.\$slug\[\.md\]|llms-full)/.test(name))
    .map((name) => `routes/${name.replace(/\.tsx$/, "")}`)
    .sort();

  const declaredIds = Object.values(ROUTE_CEILINGS)
    .map((r) => r.id)
    .sort();
  const missing = publicRoutes.filter((id) => !declaredIds.includes(id));
  const extra = declaredIds.filter((id) => !publicRoutes.includes(id));
  ok(
    "every public HTML route has a measured ceiling, and every ceiling names one",
    missing.length === 0 && extra.length === 0,
    `no ceiling: ${missing.join(", ") || "none"}; ceiling but no such public route: ` +
      `${extra.join(", ") || "none"}. A new public route arrives with its own measured ` +
      `ceiling in the same commit, or this gate stops grading the page it added.`,
  );

  /* Root's own reachable assets ride on every route, so they are found once. */
  const rootAssets = reachableAssets(rootModule, appDir, read).assets;

  console.log("\n  per-route cold load, brotli bytes\n");

  for (const [path, ceiling] of Object.entries(ROUTE_CEILINGS)) {
    const routeFile = join(routesDir, `${ceiling.id.replace("routes/", "")}.tsx`);

    const sheets = stylesheetsFor(manifest, ceiling.id);
    const cssText = sheets.map((s) => readFileSync(assetFile(s), "utf8"));
    const cssTotal = sheets.reduce((n, s) => n + brotliSize(readFileSync(assetFile(s))), 0);

    ok(
      `${path}: links at least one stylesheet`,
      sheets.length > 0,
      `the manifest lists no CSS for ${ceiling.id} or for root, so every byte assertion ` +
        `below it would be about an empty set.`,
    );

    const routeAssets = reachableAssets(routeFile, appDir, read).assets;
    const bundles = [...new Set([...routeAssets, ...rootAssets])]
      .filter((a) => a.includes("enhance/dist/"))
      .map((a) => a.split("/").pop() ?? a)
      .sort();

    const served = enhancementAssets().filter((b) => bundles.includes(b.module));
    const bundleTotal = served.reduce((n, b) => n + b.brotli, 0);
    const total = cssTotal + bundleTotal;

    console.log(
      `  ${path.padEnd(18)} css ${String(cssTotal).padStart(5)} (${sheets.length} sheet) ` +
        `bundles ${String(bundleTotal).padStart(5)} [${bundles.join(" ") || "none"}] ` +
        `total ${String(total).padStart(5)} of ${ceiling.total}`,
    );

    ok(
      `${path}: stylesheets are under ${ceiling.css} brotli`,
      cssTotal <= ceiling.css,
      `${cssTotal} bytes across ${sheets.length} sheet(s): ${sheets.join(", ")}. A ` +
        `stylesheet grows by a rule at a time, so this is a decision rather than drift.`,
    );
    ok(
      `${path}: the whole cold load is under ${ceiling.total} brotli`,
      total <= ceiling.total,
      `${total} bytes: ${cssTotal} of stylesheet and ${bundleTotal} of enhancement ` +
        `bundles [${bundles.join(", ")}].`,
    );

    for (const bundle of bundles) {
      const permitted = BUNDLE_USE[/** @type {keyof typeof BUNDLE_USE} */ (bundle)];
      ok(
        `${path}: serves no enhancement bundle it has no markup for (${bundle})`,
        permitted ? permitted(ceiling.id) : false,
        `${bundle} is reachable from ${ceiling.id} and this route has nothing for it to ` +
          `upgrade. That is bytes downloaded and parsed to find nothing, which is what ` +
          `the blog bundle did on the listing page until 2026-08-27.`,
      );
    }

    /* ---- a reachable font is preloaded, or exempt with a reason ---------- */

    for (const font of fontsIn(cssText)) {
      const stem = (font.split("/").pop() ?? font).replace(/-[A-Za-z0-9_-]{8}\.woff2$/, "");
      if (PRELOAD_EXEMPT[stem]) continue;
      /*
       * THE BINDING NAME IS DERIVED, NOT GUESSED, and the first version of
       * this guessed. It turned `inter-latin-normal` into `interLatinNormalUrl`
       * and root.tsx calls it `interNormalUrl`, so the assertion failed against
       * a font that IS preloaded. A gate that invents the name it is looking
       * for is testing its own spelling.
       *
       * Read instead: find root's `?url` import whose specifier ends in this
       * font file, take the local name it bound, and require that name inside a
       * preload entry. Both halves come from the file being graded.
       */
      const bound = rootSource.match(
        new RegExp(`import\\s+(\\w+)\\s+from\\s+"[^"]*${stem}\\.woff2\\?url"`),
      );
      const preloadBlock = rootSource.slice(rootSource.indexOf('rel: "preload"'));
      ok(
        `${path}: the reachable font ${stem} is preloaded`,
        Boolean(bound) &&
          rootSource.includes('rel: "preload"') &&
          preloadBlock.slice(0, 400).includes(`href: ${bound?.[1]}`),
        `${font} is fetched by a @font-face rule on this route and root.tsx declares no ` +
          `preload for it${bound ? ` naming ${bound[1]}` : " and no ?url import of it"}. ` +
          `A font inside a stylesheet is discovered LATE: the browser fetches the sheet, ` +
          `parses it and matches the rule before it asks for the file. Exempt it in ` +
          `PRELOAD_EXEMPT with a reason, or preload it.`,
      );
    }
  }

  /*
   * THE PALETTE IS NOT PART OF ANY PAGE'S COLD LOAD, asserted rather than
   * assumed. It is fetched by `theme.ts` on the first search gesture from a URL
   * on a data attribute, so no import graph reaches it. If it ever comes back
   * as a script tag the per-route loop above fails on whichever route regains
   * it; this states the intended arrangement so the failure reads as a
   * regression rather than as a puzzle.
   */
  ok(
    "the search palette is not imported into any page's cold load",
    ![...rootAssets].some((a) => a.includes("enhance/dist/palette")),
    "root reaches app/enhance/dist/palette.js through an import, so a search dialog is " +
      "on every document again. It is fetched on the gesture; see search-trigger.tsx.",
  );

  gradeMathVariant(manifest, rootAssets, rootSource, clientDir, assetFile);
}

/**
 * THE ONE PAGE THIS GATE'S ROUTE MODEL CANNOT SEE.
 *
 * Everything above resolves a route's stylesheets from React Router's manifest,
 * which is PER ROUTE. The math stylesheet is linked PER POST: `/blog/:slug` is
 * one route serving thirteen posts, one of which has math, and root decides at
 * render time from the loader's `hasMath`. So the sheet is in no manifest, the
 * loop above cannot find it, and without this section a 2.8 kB stylesheet and
 * twenty font faces would ride on a page with no ceiling anywhere. That is the
 * exact hole this file's own header describes for the pre-2026-08-27 stylesheet.
 *
 * Four things are asserted, and the first two are a pair:
 *
 *   1. THE SHEET IS NOT IN `/blog/:slug`'s MANIFEST CSS. This is the whole
 *      "posts without math ship no extra bytes" claim, and it is what would
 *      break first: a `import "./styles/katex.generated.css"` anywhere, dropping
 *      the `?url`, puts it back on all thirteen and this fails.
 *   2. THE SHEET IS REACHABLE FROM ROOT. Without this, assertion 1 passes
 *      perfectly on a build where the stylesheet was deleted, and the math page
 *      would render unstyled with a clean gate. The pair is the measurement.
 *   3. THE MATH VARIANT'S BYTES, against a measured ceiling of its own.
 *   4. NO FACE IS INLINED AS A `data:` URI, which is a CSP refusal and not a
 *      preference; grounds at the assertion.
 *
 * @param {any} manifest @param {Set<string>} rootAssets @param {string} rootSource
 * @param {string} clientDir @param {(p: string) => string} assetFile
 */
function gradeMathVariant(manifest, rootAssets, rootSource, clientDir, assetFile) {
  console.log("\n  the math variant of /blog/:slug\n");

  /* ---- 2. the sheet is reachable from root, so 1 is not vacuous ---------- */

  const read = (/** @type {string} */ path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  };
  const postRouteFile = join(root, "app", "routes", "blog.$slug.tsx");
  const postAssets = reachableAssets(postRouteFile, join(root, "app"), read).assets;
  /*
   * A SET, because the two walks OVERLAP. `blog.$slug.tsx` and `root.tsx` share
   * most of their import graph, so a specifier reachable from both is found
   * twice and the raw count says two where there is one file. The claim is
   * about distinct specifiers.
   */
  const imported = [...new Set([...postAssets, ...rootAssets])].filter((a) =>
    a.endsWith("katex.generated.css"),
  );
  ok(
    "the math stylesheet is `?url`-imported, so there is a variant to grade",
    imported.length === 1,
    `the reachability walk over blog.$slug.tsx and root.tsx found ${imported.length} ` +
      `distinct specifier(s) ending in katex.generated.css. Zero means the conditional ` +
      `link is gone and every assertion below is about a stylesheet nobody ships; two ` +
      `means there are two copies of the file.`,
  );

  /*
   * THE BUILT ASSET IS FOUND BY CONTENT, NOT BY NAME.
   *
   * The name-based version is `katex.generated-*.css`, and this file already
   * records why that is the weak form for the enhancement bundles: a Vite hash
   * may contain a dash. Byte equality against the source is not available
   * either, because Vite compiles the stylesheet on the way through, which is
   * the entire reason it is a `?url` import.
   *
   * So the anchor is a rule only this stylesheet can contain, and the count is
   * asserted: exactly one CSS asset in the build carries `.katex-display`.
   */
  const cssAssets = readdirSync(join(clientDir, "assets")).filter((n) => n.endsWith(".css"));
  const mathSheets = cssAssets.filter((name) =>
    readFileSync(join(clientDir, "assets", name), "utf8").includes(".katex-display"),
  );
  ok(
    "exactly one built stylesheet carries the math rules",
    mathSheets.length === 1,
    `${mathSheets.length} of ${cssAssets.length} CSS asset(s) in the build contain ` +
      `.katex-display: ${mathSheets.join(", ") || "none"}. Zero means build:katex or the ` +
      `?url import is broken; more than one means the rules have been duplicated into a ` +
      `route sheet as well, which is assertion 1 failing by another route.`,
  );
  if (mathSheets.length !== 1) return;
  const mathSheet = /** @type {string} */ (mathSheets[0]);
  const mathBytes = readFileSync(join(clientDir, "assets", mathSheet));

  /* ---- 1. and it is on no route's manifest, which is the mathless cost --- */

  const onRoutes = Object.entries(ROUTE_CEILINGS)
    .filter(([, ceiling]) =>
      stylesheetsFor(manifest, ceiling.id).some((s) => s.endsWith(mathSheet)),
    )
    .map(([path]) => path);
  ok(
    "no route links the math stylesheet from its manifest",
    onRoutes.length === 0,
    `${onRoutes.join(", ")} link(s) it as route CSS, so every post pays ` +
      `${brotliSize(mathBytes)} brotli whether or not it has an expression in it. It is ` +
      `linked per POST by root.tsx from the loader's hasMath, through a "?url" import; ` +
      `a plain CSS import puts it back on the whole route.`,
  );

  /*
   * THE LINK IS CONDITIONAL, AND ROOT'S ID LIST IS RECONCILED AGAINST THE ROUTES.
   *
   * Three source facts, none of which any other instrument can see:
   *
   *   The `<link>` is guarded by `linksMath`. Drop the guard and every page on
   *   the site links the sheet, which is assertion 1 above failing from the
   *   other direction and which that assertion CANNOT see: it reads the route
   *   manifest, and a component-rendered link is in no manifest.
   *
   *   The link carries NO `precedence`. That attribute makes React 19 treat the
   *   element as a resource and hoist it to the top of `<head>`, above
   *   `<meta name="color-scheme">`. MEASURED 2026-09-06 on the rendered page,
   *   after check:browser failed by name on "the colour scheme is declared
   *   before the first stylesheet": the meta is load-bearing precisely because
   *   it arrives before the first stylesheet request, and hoisting inverted
   *   that on every math page.
   *
   *   Root names TWO ROUTE IDS, and that is a mirror. It is reconciled here
   *   against the routes that actually return `blogPostView(...)`, in both
   *   directions, so a third route rendering a post cannot render it unstyled
   *   with nothing complaining.
   */
  const rootStripped = stripComments(rootSource);
  ok(
    "root links the math stylesheet only when linksMath, and without precedence",
    /\{linksMath \?[\s\S]{0,120}rel="stylesheet"[\s\S]{0,60}\}/.test(rootStripped) &&
      !/precedence/.test(rootStripped),
    `root.tsx must render it as {linksMath ? <link rel="stylesheet" ` +
      `href={katexCssUrl} /> : null}. Without the guard every page links it; with a ` +
      `precedence attribute React hoists it above the colour-scheme meta. Neither ` +
      `failure is visible to the manifest assertions above.`,
  );

  /*
   * THE EDITOR ROUTES OPT IN, and the set is derived rather than declared.
   *
   * A route rendering `<PostEditor` shows the exact-preview pane, which copies
   * this document's stylesheets into its iframe. Without the handle an author
   * typing an expression sees it unstyled, on the one surface where this
   * feature is authored. Two routes render the editor today; a third would
   * inherit the defect silently, so the two sets are compared rather than one
   * being trusted.
   */
  const editorRoutes = readdirSync(join(root, "app", "routes"))
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) =>
      /<PostEditor/.test(stripComments(readFileSync(join(root, "app", "routes", name), "utf8"))),
    )
    .sort();
  const optedIn = editorRoutes.filter((name) =>
    /export const handle = \{[^}]*\bmath:\s*true/.test(
      stripComments(readFileSync(join(root, "app", "routes", name), "utf8")),
    ),
  );
  ok(
    "every route that renders the editor opts into the math stylesheet",
    editorRoutes.length >= 2 && optedIn.length === editorRoutes.length,
    `routes rendering <PostEditor>: [${editorRoutes.join(", ")}]; of those, opted in ` +
      `with "export const handle = { math: true }": [${optedIn.join(", ")}]. A route in ` +
      `the first list and not the second shows an author unstyled maths in the preview ` +
      `pane. Fewer than two means the derivation stopped finding them.`,
  );

  /*
   * THE ROUTES THAT CAN CARRY MATH ARE DERIVED, then compared with the ids root
   * reads. A route renders a post exactly when its loader returns the shared
   * projection, so `blogPostView(` is the discriminator rather than a name
   * pattern: `/preview/:token` is not called `blog.anything`.
   */
  const routesDir2 = join(root, "app", "routes");
  const postRoutes = readdirSync(routesDir2)
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) =>
      /blogPostView\(/.test(stripComments(readFileSync(join(routesDir2, name), "utf8"))),
    )
    .map((name) => `routes/${name.replace(/\.tsx$/, "")}`)
    .sort();
  const namedInRoot = [...rootStripped.matchAll(/useRouteLoaderData\(\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((id) => id !== "root")
    .sort();
  ok(
    "every route that renders a post is one root reads hasMath from, and vice versa",
    postRoutes.join(", ") === namedInRoot.join(", ") && postRoutes.length >= 2,
    `routes returning blogPostView(): [${postRoutes.join(", ")}]; ids root reads with ` +
      `useRouteLoaderData: [${namedInRoot.join(", ")}]. A route in the first list and ` +
      `not the second renders every equation unstyled; one in the second and not the ` +
      `first is a dead read. Fewer than two means the derivation stopped finding them.`,
  );

  /*
   * AND THE FIELD ROOT READS IS THE ONE THE PROJECTION WRITES, asserted because
   * it is a STRING on both sides.
   *
   * `blog-view.ts` puts `hasMath` on the payload and root reads that name off
   * whichever route's data it got. Nothing types the two together: root casts
   * the loader data, so a rename in the projection leaves root reading
   * `undefined`, linking nothing, and rendering every equation unstyled with a
   * green typecheck. That is the same blind spot that let `mentions` go missing
   * from the preview payload for two days (fixed 2026-09-06).
   */
  const viewSource = stripComments(readFileSync(join(root, "app", "lib", "blog-view.ts"), "utf8"));
  ok(
    "blog-view.ts publishes hasMath and root reads that exact name",
    /hasMath:\s*htmlHasMath\(/.test(viewSource) &&
      /hasMath\?:\s*boolean/.test(rootStripped),
    `the projection sets it as "hasMath: htmlHasMath(...)" and root reads it as ` +
      `"{ hasMath?: boolean }". A rename on one side leaves root reading undefined and ` +
      `every equation renders unstyled, with no type error anywhere.`,
  );

  /* ---- 3. what a math post actually costs -------------------------------- */

  const base = ROUTE_CEILINGS["/blog/:slug"];
  const baseSheets = stylesheetsFor(manifest, base.id);
  const baseCss = baseSheets.reduce((n, s) => n + brotliSize(readFileSync(assetFile(s))), 0);
  const mathCss = baseCss + brotliSize(mathBytes);

  const bundles = [...new Set([...postAssets, ...rootAssets])]
    .filter((a) => a.includes("enhance/dist/"))
    .map((a) => a.split("/").pop() ?? a);
  const bundleTotal = enhancementAssets()
    .filter((b) => bundles.includes(b.module))
    .reduce((n, b) => n + b.brotli, 0);
  const mathTotal = mathCss + bundleTotal;

  console.log(
    `  ${"/blog/:slug (math)".padEnd(18)} css ${String(mathCss).padStart(5)} ` +
      `(${baseSheets.length + 1} sheet) bundles ${String(bundleTotal).padStart(5)} ` +
      `total ${String(mathTotal).padStart(5)} of ${MATH_CEILING.total}\n`,
  );

  ok(
    `/blog/:slug (math): stylesheets are under ${MATH_CEILING.css} brotli`,
    mathCss <= MATH_CEILING.css,
    `${mathCss} bytes: ${baseCss} of route sheets plus ${brotliSize(mathBytes)} of math.`,
  );
  ok(
    `/blog/:slug (math): the whole cold load is under ${MATH_CEILING.total} brotli`,
    mathTotal <= MATH_CEILING.total,
    `${mathTotal} bytes: ${mathCss} of stylesheet and ${bundleTotal} of enhancement bundles.`,
  );

  /* ---- 4. the faces, and the one that was inlined ------------------------ */

  const faces = fontsIn([mathBytes.toString("utf8")]);
  ok(
    "the math stylesheet still names its whole font set",
    faces.length >= MINIMUM_MATH_FACES,
    `${faces.length} @font-face src(s), floor ${MINIMUM_MATH_FACES}, measured 20 for ` +
      `katex 0.16.47. Fewer means the woff2 trim in build-katex.mjs has started removing ` +
      `faces rather than formats, and the missing ones fall back to a system font with no ` +
      `error anywhere. check:content owns the disk-side reconciliation of the same set.`,
  );

  /*
   * NOT A PREFERENCE. A `data:` font is REFUSED by this site's CSP.
   *
   * MEASURED 2026-09-06 on the first build after the stylesheet landed:
   * `KaTeX_Size3-Regular.woff2` is 3,624 bytes, under Vite's default
   * 4096-byte inline limit, and Vite emitted it as base64 inside the sheet.
   * `font-src` is `'self'` and carries no `data:` source (only `img-src`
   * does), so the browser would have refused that one face while fetching the
   * other nineteen: big delimiters in a fallback serif on some equations and
   * not others, with nothing failing. It also put 4.8 kB of base64 into a file
   * every math page downloads, for a face most posts never use.
   *
   * `vite.config.ts` refuses to inline any `.woff2`. This is the assertion that
   * says so, because a config edit is invisible until something reads the build.
   */
  const inlined = faces.filter((f) => f.startsWith("data:"));
  ok(
    "no font face is inlined as a data: URI",
    inlined.length === 0,
    `${inlined.length} face(s) are base64 inside the stylesheet. font-src is 'self' with ` +
      `no data: source, so the browser REFUSES them, and the symptom is one size of ` +
      `delimiter in a fallback serif. See build.assetsInlineLimit in vite.config.ts.`,
  );

  /*
   * AND THEY ARE DELIBERATELY NOT PRELOADED, which is the opposite of the rule
   * the per-route loop applies and needs its reason stated here rather than
   * being an omission.
   *
   * The loop above demands a preload for a reachable font because the site's
   * own face is used by every page, so a late discovery costs every reader. A
   * KaTeX face is used by an EXPRESSION: `KaTeX_Fraktur` is fetched only by a
   * post containing `\mathfrak`, and a page with one inline fraction touches
   * three of the twenty. Preloading the set would be 260 kB of speculative
   * fetches on a page that needs 30 kB of it, and the browser warns about every
   * preload it does not use within a few seconds.
   */
  const preloadBlock = rootSource.slice(rootSource.indexOf('rel: "preload"'));
  ok(
    "no math face is preloaded, which is the deliberate opposite of the rule above",
    !preloadBlock.slice(0, 400).includes("katex"),
    `root.tsx preloads a KaTeX face. They are fetched on demand by the expression that ` +
      `uses them; preloading the set is 260 kB speculatively for a page that needs a ` +
      `fraction of it.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (/** @type {any} */ error) {
    console.error(
      `check:page-payload failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
