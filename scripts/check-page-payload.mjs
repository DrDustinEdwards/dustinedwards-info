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
  /** @type {string[]} */
  const importScope = [];
  const walkSources = (/** @type {string} */ dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) walkSources(full);
      else if (/\.(ts|tsx|mjs)$/.test(name.name)) importScope.push(full);
    }
  };
  for (const dir of importScopeDirs) walkSources(dir);

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

  gradeEveryPage();

  if (failures > 0) {
    console.log(`\n${failures} FAILED of ${checks} checks\n`);
    process.exit(1);
  }
  console.log(`\n${checks} checks, 0 failures\n`);
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
};

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
