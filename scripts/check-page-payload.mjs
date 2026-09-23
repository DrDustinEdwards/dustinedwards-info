/**
 * Gate: what a reader downloads to see a public page, per route, with ceilings.
 *
 *   npm run check:page-payload
 *
 * BOUNDARY: it reads the BUILD ON DISK and never builds, so a stale build is certified stale.
 *
 * IT NOW RENDERS, which the line above used to deny. The last section renders each public route's
 * components in Node and ceilings the markup they produce, because the three lines this gate
 * printed before it existed added up to a number it called "the whole cold load" and that was
 * false on the home page by a factor of two: four inline drawings, 85% of the markup, and not one
 * byte of them visible to any gate. What it renders is the ROUTE'S OWN MARKUP and not the served
 * document; the section states that difference in bytes, measured against a served page rather
 * than estimated. Three routes cannot be rendered at all and are named with the reason.
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
// Pure and therefore testable, the footing ci-status.mjs and ask-converge.mjs stand on.
import {
  fontsIn,
  reachableAssets,
  stylesheetsFor,
} from "./lib/page-payload.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR = join(root, "build", "client", "assets");
const DIST_DIR = join(root, "app", "enhance", "dist");

/**
 * CEILINGS AND FLOORS, the only copies, rule 17. Margins are wide because the bundles are tiny:
 * the job is catching a dependency wandering in. A module missing from this map fails.
 *
 * @type {Record<string, number>}
 */
const ENHANCE_BROTLI_CEILINGS = {
  "ask.js": 2000,
  /*
   * Raised for the selection link, which is a feature and not a dependency: the module
   * graph is still blog.ts alone plus one local encoder. The margin above the measured
   * bundle is kept at what it was, so this moves the floor and not the slack.
   */
  "blog.js": 2500,
  /* Measured on the first build of this module, at 431 brotli. THE SECOND SITE-WIDE BUNDLE, after
     theme.js, so it is the one to watch: every public document pays for it, which is the cost
     ruling 126's menu and persistence are buying. */
  "header.js": 700,
  "palette.js": 6000,
  /* Measured on the first build of this module, at 727 brotli: Plate I's linked highlight and its
     leader intro, home page only. */
  "plate.js": 1000,
  /* Measured on the first build of this module, at 608 brotli (esbuild output, quality 11): the
     home page's Germomics player controls, home page only (ruling 134). */
  "podcast.js": 900,
  /* Measured on the first build of this module, at 1121 brotli. */
  "search.js": 1600,
  "theme.js": 1000,
};

/** A walk that reads fewer files than this has lost a route or gone vacuous, not gotten lean. */
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
 * A chunk name with its content hash stripped. Stems, because verify-live may face a deploy
 * whose hashes predate this disk. Anchored on the extension: a Vite hash may contain a dash.
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

/** Fails closed in every direction: no build, no manifest, two, or one that does not parse. */
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
 * Minified output writes `from"./x.js"`, bare `import"./x.js"` and `import("./x.js")`.
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
 * The set the framework WOULD hand a hydrating page: a structural floor on the manifest. No
 * public page references it; the admin plane and /login do.
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
 * ONE WALKER, ONE ARGUMENT ORDER, hard rule 10's helper-signature line: two copies agree until
 * one gains an extension.
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

async function main() {
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

  /* every bundle is served verbatim, and its ceiling holds */

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

  /* the syntax pass: every served .js asset actually parses */

  const scratch = join(root, "node_modules", ".cache", "check-page-payload");
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  /* .ts AND .tsx TOO: a .js-only sweep grades every healthy asset and skips the defective one. */
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
    // node --check honors the ES-module parse goal only for .mjs, and every
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
   * NOT an `assertFloor`: this counts BUILT CHUNKS, a SCOPE floor in the sense of hard rule 10,
   * and the bundler's splitting would read to `check:floors` as drift.
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

  /* hydration is opt-in, and only the admin plane and its door opt in */

  /* Pinned to admin.tsx and login.tsx by name, so a public route gaining the flag fails HERE. */
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

  /* The window is the Layout return, bounded by two literals, comments stripped. */
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

  /* no ineffective dynamic import */

  /*
   * **This does NOT read the build log.** The criterion is derived from SOURCE: a dynamic import
   * splits nothing when some module in the same graph imports it statically. The one it judges is
   * the CodeMirror split, which hard rule 4 names.
   */
  const importScopeDirs = [join(root, "app"), join(root, "workers")];
  const importScope = importScopeDirs.flatMap((dir) => walkSource(dir));

  ok(
    "the dynamic-import scan walked a non-empty scope",
    importScope.length >= 150,
    `walked ${importScope.length} source file(s) under app/ and workers/. A scan over ` +
      `nothing reports what a clean scan reports.`,
  );

  /** Pure over its input, so the self-test below can run it on synthetic sources. */
  const findIneffectiveDynamicImports = (/** @type {Array<{path: string, source: string}>} */ files) => {
    // By NORMALISED SPECIFIER, not resolved path, so two spellings of one module do not match.
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

  // SELF-TEST on every execution, so the finder is proven able to fire on a tree with none.
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
      // Relative to the repo root, so the failure names a path someone can open.
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

  await gradeRenderedHtml();

  if (failures > 0) {
    console.log(`\n${failures} FAILED of ${checks} checks\n`);
    process.exit(1);
  }
  console.log(`\n${checks} checks, 0 failures\n`);
}

/**
 * A NATIVE BUILD-TIME DEPENDENCY MAY NOT REACH THE WORKER: `workerd` has no filesystem, so
 * this is a Worker that fails to start rather than a size problem. THE THIRD ASSERTION IS THE
 * POINT: a source scan says nothing about what SHIPPED.
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

  /* Comments stripped: a comment naming the module has satisfied an assertion here before. */
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
   * `build/server/index.js` is what wrangler uploads. A bare substring, because a require can
   * survive as a string, a banner or an external.
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
 * THE WHOLE PAGE, PER ROUTE: rule 4's subject is the stylesheets and fonts too. Resolved offline
 * by reachability, which over-approximates, the safe direction for a ceiling. The speculation
 * self-reference is `test/header-speculation.test.mjs`', named here so it does not read ungated.
 */

/*
 * THE REDESIGN UPLIFT, TEMPORARY BY CONSTRUCTION. Both palettes ship at once because the old one
 * still has consumers. Each ceiling kept its headroom, so this moves the floor, not the margin.
 * THE DATE IS THE WHOLE CONTRACT: these come down by UPLIFT_EXPIRES or this gate fails, and
 * moving the date is a ruling.
 */
const UPLIFT_EXPIRES = "2026-11-30";
/**
 * PER-ROUTE CEILINGS, in BROTLI bytes, the only copies, rule 17. `css` is the stylesheets,
 * `total` adds the bundles; fonts are excluded and asserted separately. A missing route FAILS.
 *
 * @type {Record<string, { id: string, css: number, total: number }>}
 */
/** @type {Map<string, {css: number, total: number, headCss: number, headTotal: number}>} */
const REDESIGN_UPLIFT = new Map([
  ["/",                       { css: 5300, total: 6300, headCss: 4655, headTotal: 5473 }],
  ["/blog",                   { css: 5800, total: 6800, headCss: 5091, headTotal: 5909 }],
  ["/blog/:slug",             { css: 7300, total: 10000, headCss: 6709, headTotal: 9315 }],
  ["/blog/tags/:tag",         { css: 5800, total: 6800, headCss: 4902, headTotal: 5720 }],
  ["/blog/series/:series",    { css: 5800, total: 6800, headCss: 4902, headTotal: 5720 }],
  ["/search",                 { css: 6100, total: 8700, headCss: 5335, headTotal: 7537 }],
  ["/projects",               { css: 5300, total: 6300, headCss: 4756, headTotal: 5574 }],
  ["/colophon",               { css: 5700, total: 6600, headCss: 5065, headTotal: 5883 }],
  ["/playground",             { css: 6600, total: 7500, headCss: 5901, headTotal: 6719 }],
  ["/phage-discovery",        { css: 5700, total: 6600, headCss: 5065, headTotal: 5883 }],
  ["/privacy",                { css: 5700, total: 6600, headCss: 5065, headTotal: 5883 }],
  ["/about",                  { css: 5700, total: 6600, headCss: 5065, headTotal: 5883 }],
  ["/publications",           { css: 5300, total: 6300, headCss: 4971, headTotal: 5789 }],
  ["/publications/:slug",     { css: 5300, total: 6300, headCss: 4971, headTotal: 5789 }],
  // The math variant of /blog/:slug, which carries its own ceiling below.
  ["/blog/:slug (math)",      { css: 10500, total: 13200, headCss: 9528, headTotal: 12134 }],
]);

const ROUTE_CEILINGS = {
  /*
   * RAISED FOR PART B PAGE 2: home became Plate I. The page gained a drawn morphology key, its
   * key strip, two computed figures and a split hero grid, which is a ruled feature (117, 123 and
   * 124) rather than a bundle that grew on its own. Measured 6929 css on the build that raised
   * it, against a 6900 ceiling.
   *
   * TWO CONSOLIDATION PASSES RAN FIRST, because a raise is not the default answer to an overage
   * (ruling 119): two annotation aliases collapsed into one name, and the plate and figure box
   * rules merged. Together they moved brotli by a single byte. The repetition was already being
   * compressed away, so there was nothing left to reclaim and the cost is the feature itself.
   *
   * The total ceiling is NOT raised. The whole cold load is 7743 of 7800 and still fits.
   *
   * It comes down with the rest of the uplift by UPLIFT_EXPIRES.
   */
  /*
   * RAISED FOR header.js, ruling 126, and ONLY the two routes that actually breached were moved.
   * The site-wide bundles went from 814 to 1245 brotli, so every route pays the same +431; the
   * other fourteen absorbed it inside slack they already had and keep the ceiling they were
   * measured at. Raising those too would add slack nobody measured.
   *
   * Measured 7903 on the build that raised it, and the route keeps the 328 bytes of slack it had
   * before, rounded up to the next hundred. That moves the floor and not the slack, which is the
   * same rule the blog.js raise above states.
   */
  /*
   * RAISED AGAIN FOR PLATE I'S ENHANCEMENT (ruling 119: a ceiling may rise in the commit that states
   * the reason). plate.js is 727 brotli, the linked highlight and the leader intro the solid-lawn
   * plate brings. Measured 8876 on the build that raised it; the 397 bytes of slack the last raise
   * kept are kept again, rounded up. It comes down with the rest of the uplift by UPLIFT_EXPIRES.
   *
   * RAISED AGAIN FOR THE SCIENCE COMMUNICATION SECTION (rulings 119 and 134): podcast.js at 608
   * brotli and the episode and player rules in home.css. Measured 7313 css / 9862 total on the
   * build that raised it; both keep the slack they had before (196 and 397), rounded up.
   */
  /*
   * RAISED FOR THE FOOTER REBUILD (ruling 135), and ONLY the fields that breached. The footer's
   * rules live in shell.css, so root.css went from 5409 to 5677 brotli and every route pays +268;
   * the routes that absorbed it inside their slack keep their ceilings. A breaching field rises by
   * that +268 rounded up to +300, which keeps the slack it had rather than adding any. Home, with
   * the science communication section in, measured 7580 css / 10129 total; its css keeps the 196
   * bytes of slack the podcast raise kept, rounded up, and its total still fits.
   */
  "/": { id: "routes/home", css: 7800, total: 10300 },
  "/blog": { id: "routes/blog._index", css: 7400, total: 8500 },
  /*
   * RAISED FOR PART B PAGE 1: the post gained a rail track, an evidence row, a dl head-block
   * layout and its own type rules. Measured 8982 css / 12051 total on the build that raised it.
   * It comes down with the rest of the uplift by UPLIFT_EXPIRES.
   */
  "/blog/:slug": { id: "routes/blog.$slug", css: 9400, total: 12700 },
  /* `/blog`'s ceilings: the same listing from the same sheets, graded against one bar. */
  "/blog/tags/:tag": { id: "routes/blog.tags.$tag", css: 7200, total: 8400 },
  /* The tag archive's, for the reason above: one bar for one kind of page. */
  "/blog/series/:series": { id: "routes/blog.series.$series", css: 7200, total: 8400 },
  /*
   * The total alone is raised, and by the rail track's share: `.tracks` gained the rail as a
   * third track, which every public route pays for because they all load shell.css. This page
   * had 52 bytes of headroom and was the only one that did not absorb it.
   */
  "/search": { id: "routes/search", css: 7600, total: 10600 },
  "/projects": { id: "routes/projects", css: 7100, total: 7900 },
  "/colophon": { id: "routes/colophon", css: 7400, total: 8200 },
  "/playground": { id: "routes/playground", css: 8200, total: 9000 },
  /*
   * The inventory carries the whole kit, so it is the heaviest public sheet on
   * the site by design. It is also the only page that does, which is what keeps
   * the number off every other route.
   */
  "/playground/ui": { id: "routes/playground.ui", css: 10600, total: 11500 },
  "/phage-discovery": { id: "routes/phage-discovery", css: 7400, total: 8200 },
  "/privacy": { id: "routes/privacy", css: 7400, total: 8200 },
  /* /privacy and /colophon's shape, app.css plus prose.css and one bundle. */
  "/about": { id: "routes/about", css: 7400, total: 8200 },
  /*
   * `/projects`, the same shape. It does not pay for `PUBLICATIONS`: the loader touches it and the
   * public plane does not hydrate, so the records never reach a payload.
   */
  /* RAISED FOR header.js with the home page above, and for the same +431. Measured 8400, keeping
     the 131 bytes of slack it had, rounded up. The css ceiling is untouched: it measured 7155. */
  "/publications": { id: "routes/publications", css: 7600, total: 8900 },
  /*
   * The index's ceiling measures the SHARED cold load a browser caches once, so this page's own
   * HTML is the variable part: a long author list is content, not a payload regression.
   */
  "/publications/:slug": { id: "routes/publications.$slug", css: 7300, total: 8100 },
};

/**
 * THE MATH VARIANT: `/blog/:slug` with one more sheet, generated from a pinned package.
 *
 * Raised with its parent for Part B page 1, by the same sheets: measured 11801 css / 14870 total.
 * The total raised again with its parent for the footer rebuild, by the same +300.
 */
const MATH_CEILING = { css: 12300, total: 15500 };

/** A floor rather than an equality, so an upstream face ADDED later does not fail. */
const MINIMUM_MATH_FACES = 20;

/**
 * A preload unused within seconds is worse than none: the browser warns and the bytes compete.
 *
 * @type {Record<string, string>}
 */
const PRELOAD_EXEMPT = {
  "inter-latin-italic": "loaded on demand by unicode-range; see app/root.tsx, links",
  // THE SERIF IS THE LATE FACE ON PURPOSE: Inter owns the dominant metrics, and a second preload
  // would put a whole face on every route's critical path for a few heading lines.
  "source-serif-4-latin-normal": "the late heading face; step 3 ruled the preload goes to Inter alone",
};

/** The palette is `false` everywhere on purpose: a route reaching it has put a search dialog back. */
const BUNDLE_USE = {
  "theme.js": () => true,
  /* Site-wide: the header is on every public page, so its enhancement is too. */
  "header.js": () => true,
  "blog.js": (/** @type {string} */ id) => id === "routes/blog.$slug",
  /* Plate I and its key are on the home page and nowhere else. */
  "plate.js": (/** @type {string} */ id) => id === "routes/home",
  /* The Germomics episode is on the home page and nowhere else. */
  "podcast.js": (/** @type {string} */ id) => id === "routes/home",
  "ask.js":(/** @type {string} */ id) => id === "routes/search",
  /* The search page's own enhancement: it upgrades that page's form and result list and has
     nothing to do anywhere else. */
  "search.js": (/** @type {string} */ id) => id === "routes/search",
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

  /* THE ROUTE SET IS DERIVED, reconciled BOTH directions, by the same rule `check:browser` uses. */
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

  /*
   * THE UPLIFT MAP POLICES ITSELF, in the three directions its comment claims.
   * A widening that cannot expire is just a higher ceiling with a story
   * attached.
   */
  for (const [route, before] of REDESIGN_UPLIFT) {
    // A second grading of /blog/:slug rather than a route of its own, so its ceiling is MATH_CEILING.
    const now =
      route === "/blog/:slug (math)"
        ? MATH_CEILING
        : /** @type {Record<string, {css: number, total: number}>} */ (ROUTE_CEILINGS)[route];
    ok(
      `uplift entry ${route} names a route this gate still ceilings`,
      Boolean(now),
      `the route is gone or renamed and the entry outlived it; remove it`,
    );
    if (!now) continue;
    ok(
      `uplift entry ${route} is still holding a raised ceiling`,
      now.css > before.css || now.total > before.total,
      `its ceilings are back to or below the pre-redesign ${before.css}/${before.total}, so the ` +
        `uplift is spent and the entry is dead. Remove it.`,
    );
  }
  ok(
    `the redesign uplift map is empty by ${UPLIFT_EXPIRES}`,
    REDESIGN_UPLIFT.size === 0 || new Date().toISOString().slice(0, 10) <= UPLIFT_EXPIRES,
    `${REDESIGN_UPLIFT.size} route(s) are still carrying the redesign uplift past ${UPLIFT_EXPIRES}. ` +
      `The old palette should be gone and these ceilings should have come back down to the real ` +
      `post-redesign numbers. THE DATE IS THE CONTRACT, not a build number, ruling 103: a build can ` +
      `be reverted and this deadline cannot. If they have not come down, the redesign has cost every ` +
      `reader about 1.2 KB a page and nothing else was going to say so. Moving the date is a ruling.`,
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

    /* a reachable font is preloaded, or exempt with a reason */

    for (const font of fontsIn(cssText)) {
      const stem = (font.split("/").pop() ?? font).replace(/-[A-Za-z0-9_-]{8}\.woff2$/, "");
      if (PRELOAD_EXEMPT[stem]) continue;
      /* DERIVED, NOT GUESSED: a gate that invents the name it looks for is testing its own spelling. */
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

  /* Asserted rather than assumed, which is what makes its return read as a regression. */
  ok(
    "the search palette is not imported into any page's cold load",
    ![...rootAssets].some((a) => a.includes("enhance/dist/palette")),
    "root reaches app/enhance/dist/palette.js through an import, so a search dialog is " +
      "on every document again. It is fetched on the gesture; see bar-search-submit.tsx.",
  );

  gradeMathVariant(manifest, rootAssets, rootSource, clientDir, assetFile);
}

/**
 * THE ONE PAGE THIS GATE'S ROUTE MODEL CANNOT SEE: the math sheet is linked PER POST from the
 * loader's `hasMath`, so it is in no route's manifest. THE FIRST TWO ASSERTIONS ARE A PAIR:
 * "on no route's manifest" passes on a build where the sheet was deleted.
 *
 * @param {any} manifest @param {Set<string>} rootAssets @param {string} rootSource
 * @param {string} clientDir @param {(p: string) => string} assetFile
 */
function gradeMathVariant(manifest, rootAssets, rootSource, clientDir, assetFile) {
  console.log("\n  the math variant of /blog/:slug\n");

  /* 2. the sheet is reachable from root, so 1 is not vacuous */

  const read = (/** @type {string} */ path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  };
  const postRouteFile = join(root, "app", "routes", "blog.$slug.tsx");
  const postAssets = reachableAssets(postRouteFile, join(root, "app"), read).assets;
  /* A SET, because the two walks OVERLAP and the raw count says two where there is one file. */
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

  /* BY CONTENT, NOT BY NAME: a Vite hash may contain a dash, and Vite compiles the sheet through. */
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

  /* 1. and it is on no route's manifest, which is the mathless cost */

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
   * Three source facts no other instrument can see: the `<link>` is guarded by `linksMath`, it
   * carries NO `precedence`, which would hoist it above the load-bearing `color-scheme` meta, and
   * root names TWO ROUTE IDS, reconciled against the routes returning `blogPostView(...)`.
   */
  const rootStripped = stripComments(rootSource);
  ok(
    "root links the math stylesheet only when linksMath, and without precedence",
    /\{linksMath \?[\s\S]{0,120}rel="stylesheet"[\s\S]{0,60}\}/.test(rootStripped) &&
      !/precedence/.test(rootStripped),
    `root.tsx must render it as {linksMath ? <link rel="stylesheet" ` +
      `href={katexCssUrl} /> : null}. Without the guard every page links it; with a ` +
      `precedence attribute React hoists it above the color-scheme meta. Neither ` +
      `failure is visible to the manifest assertions above.`,
  );

  /*
   * A route rendering `<PostEditor` copies these sheets into its preview iframe, so without the
   * handle an author typing an expression sees it unstyled. Derived, or a later route inherits it.
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

  /* A route renders a post exactly when its loader returns the shared projection. */
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

  /* A STRING on both sides: root casts the loader data, so a rename leaves it linking nothing. */
  const viewSource = stripComments(readFileSync(join(root, "app", "lib", "blog-view.ts"), "utf8"));
  ok(
    "blog-view.ts publishes hasMath and root reads that exact name",
    /hasMath:\s*htmlHasMath\(/.test(viewSource) &&
      /hasMath\?:\s*boolean/.test(rootStripped),
    `the projection sets it as "hasMath: htmlHasMath(...)" and root reads it as ` +
      `"{ hasMath?: boolean }". A rename on one side leaves root reading undefined and ` +
      `every equation renders unstyled, with no type error anywhere.`,
  );

  /* 3. what a math post actually costs */

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

  /* 4. the faces, and the one that was inlined */

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
   * NOT A PREFERENCE: `font-src` is `'self'` with no `data:`, so a base64-inlined face is refused
   * while the others fetch. `vite.config.ts` refuses to inline `.woff2`; this says so, because a
   * config edit is invisible until something reads the build.
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
   * THE OPPOSITE OF THE RULE ABOVE, stated rather than left an omission: a KaTeX face is used by
   * an EXPRESSION, so preloading the set is speculative fetching for a page needing a fraction.
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


/* ------------------------------------------------------------------ the HTML the page ships */

/**
 * THE DOCUMENT'S OWN CEILINGS, in brotli bytes, measured on the build that introduced them.
 *
 * WHY THIS SECTION EXISTS. Until it did, this gate measured stylesheets and enhancement bundles
 * and called the sum "the whole cold load", and on the home page that sentence was false by a
 * factor of two: PR #61 put four inline drawings on it, 85% of its markup, and not one byte of
 * them was visible here. A gate that reports the second largest cost on a page and calls it the
 * total is worse than no gate, because it is believed.
 *
 * WHAT IS MEASURED, EXACTLY. The markup the route's own components render, produced offline by
 * `route-render.mjs`, brotli-compressed at the same quality as everything else here. NOT the
 * served document: the transport wraps this in `<html>`, a `<head>` of meta and link tags, and
 * the nonced module script tags.
 *
 * THAT SHELL WAS MEASURED RATHER THAN ESTIMATED, against three served pages on 2026-09-21:
 *
 *     route     served          this section    the shell between them
 *     /         89,918 / 10,994  86,657 / 10,428  3,261 raw /  566 brotli
 *     /blog     21,288 /  4,285  18,488 /  3,700  2,800 raw /  585 brotli
 *     /about     8,793 /  2,354   6,162 /  1,817  2,631 raw /  537 brotli
 *
 * A fixed 540 to 590 brotli on three routes that share nothing else, which is what a head of
 * meta tags and link tags should look like: no route can change it, so no route's ceiling should
 * carry it. The tags in it point at the stylesheets and bundles the two lines above already
 * ceiling, so those bytes are counted once, in the right place.
 *
 * THE MARGIN IS 15% OVER THE MEASUREMENT, rounded up to the next 100, and it is not slack to
 * spend: a page that grows into it grows because someone added something, and the commit that
 * adds it says so. Ruling 119: a raise is not the default answer to an overage.
 *
 * AND NO EXPIRY MAP, deliberately, where the stylesheet ceilings have one. `REDESIGN_UPLIFT`
 * exists because those raises were TEMPORARY SLACK: a ceiling held above the real number until
 * the old palette left, so it had to carry a date or it would have become the number. An HTML
 * ceiling never holds slack. It is a current measurement plus a fixed margin, both written down,
 * so a page that legitimately grows is re-measured in the commit that grew it and both numbers
 * move together. There is nothing to expire, which is why there is no date to move.
 *
 * EACH ENTRY CARRIES THE MEASUREMENT IT WAS SET FROM, so a later raise is legible as a raise.
 * The `measured` number is provenance and NOT a second ceiling: it is never compared against the
 * page, because /blog and /blog/:slug move with the corpus and publishing a post must not turn a
 * gate red. What IS asserted on it is the MAP: no ceiling may sit more than 25% above the
 * measurement it claims to come from, which is what stops a raise from being unbounded.
 *
 * @type {Record<string, { brotli: number, measured: number }>}
 */
const HTML_CEILINGS = {
  "/": { brotli: 12000, measured: 10428 },
  /*
   * RE-MEASURED FOR THE FOOTER REBUILD (ruling 135): the footer's columns, the X mark and the ORCID
   * address are on every page, about +800 brotli each. Only the six routes it pushed over moved,
   * each to its new measurement plus this section's 15%, rounded up.
   */
  "/blog": { brotli: 5200, measured: 4495 },
  /* The LONGEST post in the corpus, which is what this route's worst case means. */
  "/blog/:slug": { brotli: 12300, measured: 10660 },
  "/blog/tags/:tag": { brotli: 4900, measured: 4200 },
  "/blog/series/:series": { brotli: 4900, measured: 4215 },
  "/projects": { brotli: 6400, measured: 5559 },
  "/colophon": { brotli: 13900, measured: 12043 },
  "/playground": { brotli: 6300, measured: 5435 },
  "/playground/ui": { brotli: 13600, measured: 11789 },
  "/phage-discovery": { brotli: 4300, measured: 3659 },
  "/privacy": { brotli: 4100, measured: 3529 },
  "/about": { brotli: 3100, measured: 2624 },
};

/** The most a ceiling may sit above the measurement it records. Ruling 119 in one number. */
const HTML_CEILING_MARGIN = 1.25;
/**
 * THE THREE ROUTES THIS SECTION CANNOT MEASURE, each with the reason, because a silent gap is
 * indistinguishable from a page nobody thought about.
 *
 * All three fail the same way and it is structural rather than lazy: `route-render.mjs` stubs
 * server-only modules at resolve time, so a loader that calls into one binds undefined and
 * throws. Fabricating the payload instead would measure the fabrication, which on a page whose
 * whole size is its result list is not a measurement of anything.
 *
 * @type {Record<string, string>}
 */
const HTML_UNMEASURED = {
  "/search":
    "its size IS the query: a result page for one word and a result page for a common " +
    "one are different documents, and its loader reaches search.server.ts, which the render " +
    "harness stubs. There is no single number for this route to be under.",
  "/publications":
    "its loader computes twenty fields over the paper data and the citation counts, " +
    "through citations.server.ts. A fabricated payload would measure the fabrication. The " +
    "Part B job for this page is the commit that should make it renderable and ceiling it.",
  "/publications/:slug":
    "the same citations.server.ts call, for one paper. It follows /publications in " +
    "and out of this list.",
};

/**
 * A floor on the routes this section renders, so a harness that quietly stops working reports a
 * clean sweep of nothing. Hard rule 10: a pass count is not coverage.
 */
const MINIMUM_ROUTES_RENDERED = 12;

/** Inline SVG, which is what made this section necessary and is reported per route. */
function inlineSvgOf(/** @type {string} */ html) {
  return (html.match(/<svg[^]*?<\/svg>/g) ?? []).join("");
}

/**
 * Renders every measurable public route offline and grades the markup it produces.
 *
 * THE FIXTURES ARE THE REPOSITORY'S OWN CORPUS, built by `build-content.mjs` from the markdown,
 * not typed into this file: a fixture decides the size, so an invented one measures an invention.
 */
async function gradeRenderedHtml() {
  const { buildArtifact, revisedDate } = await import("./build-content.mjs");
  const { bundleRoutes, importBundled, renderRoute } = await import("./lib/route-render.mjs");
  const { homeLoaderData, indexLoaderData, postLoaderData } = await import(
    "./lib/route-fixtures.mjs"
  );
  const { HOME_CARDS, POSTS_PER_PAGE } = await import("../app/lib/blog-listing.mjs");

  console.log("\n  the document each route renders, brotli bytes\n");

  /* BOTH DIRECTIONS, the same reconciliation the ceilings above get: a route is measured or it is
     named unmeasured, and a name that no longer matches a route is a dead exemption. */
  const graded = Object.keys(ROUTE_CEILINGS);
  const covered = [...Object.keys(HTML_CEILINGS), ...Object.keys(HTML_UNMEASURED)].sort();
  const uncovered = graded.filter((r) => !covered.includes(r));
  const orphaned = covered.filter((r) => !graded.includes(r));
  ok(
    "every route this gate ceilings has an HTML ceiling or a named reason it has none",
    uncovered.length === 0 && orphaned.length === 0,
    `no HTML ceiling and no reason: ${uncovered.join(", ") || "none"}; named but no such ` +
      `route: ${orphaned.join(", ") || "none"}.`,
  );

  /*
   * THE MAP POLICES ITSELF. A ceiling is allowed to be raised and the commit that raises it says
   * why; what it may not be is arbitrary, and a number nobody can trace back to a measurement is
   * arbitrary however carefully it was chosen.
   */
  const overwide = Object.entries(HTML_CEILINGS).filter(
    ([, c]) => c.brotli > Math.ceil((c.measured * HTML_CEILING_MARGIN) / 100) * 100,
  );
  ok(
    `every HTML ceiling is within ${Math.round((HTML_CEILING_MARGIN - 1) * 100)}% of the ` +
      `measurement it records`,
    overwide.length === 0,
    overwide
      .map(([route, c]) => `${route}: ${c.brotli} against a recorded ${c.measured}`)
      .join(", ") +
      `. Either the ceiling is slack nobody measured, or the recorded measurement is stale ` +
      `and the raise was never written down.`,
  );

  for (const [route, reason] of Object.entries(HTML_UNMEASURED)) {
    console.log(`  ${route.padEnd(22)} not measured: ${reason.slice(0, 64)}...`);
  }

  /* `buildArtifact` answers the SERIALISED artifact, which is what the sync writes, so the
     fixtures below read exactly the bytes production reads. */
  const artifact = JSON.parse(await buildArtifact());
  const published = artifact.posts.filter((/** @type {any} */ p) => !p.draft);
  const ordered = [...published].sort(
    (/** @type {any} */ a, /** @type {any} */ b) =>
      new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime(),
  );

  ok(
    "the corpus the fixtures are built from is not empty",
    ordered.length > 0,
    "no published post was built, so every listing fixture below would render an empty " +
      "page and every size would pass.",
  );
  if (ordered.length === 0) return;

  /*
   * THE LONGEST POST, not the newest: a post page's size is its body, and the ceiling on that
   * route has to be the worst case the corpus actually contains or it is a ceiling on whichever
   * post happened to be published last.
   */
  const longest = [...ordered].sort(
    (/** @type {any} */ a, /** @type {any} */ b) => (b.html ?? "").length - (a.html ?? "").length,
  )[0];

  const listing = indexLoaderData(ordered, POSTS_PER_PAGE);
  /** @type {[string, string, string, unknown, Record<string, string>][]} */
  const cases = [
    ["/", "app/routes/home.tsx", "/", homeLoaderData(ordered, HOME_CARDS), {}],
    ["/blog", "app/routes/blog._index.tsx", "/blog", listing, {}],
    [
      "/blog/:slug",
      "app/routes/blog.$slug.tsx",
      `/blog/${longest.slug}`,
      postLoaderData(longest, revisedDate),
      { slug: longest.slug },
    ],
    [
      "/blog/tags/:tag",
      "app/routes/blog.tags.$tag.tsx",
      "/blog/tags/cloudflare",
      { ...listing, tag: { slug: "cloudflare", name: "cloudflare", total: listing.total } },
      { tag: "cloudflare" },
    ],
    [
      "/blog/series/:series",
      "app/routes/blog.series.$series.tsx",
      "/blog/series/ten-years-on-cloudflare",
      {
        ...listing,
        series: { name: longest.series ?? "A series", total: listing.posts.length },
      },
      { series: "a-series" },
    ],
    ["/projects", "app/routes/projects.tsx", "/projects", {}, {}],
    ["/colophon", "app/routes/colophon.tsx", "/colophon", {}, {}],
    ["/playground", "app/routes/playground.tsx", "/playground", "RUN_THE_LOADER", {}],
    ["/playground/ui", "app/routes/playground.ui.tsx", "/playground/ui", {}, {}],
    ["/phage-discovery", "app/routes/phage-discovery.tsx", "/phage-discovery", {}, {}],
    ["/privacy", "app/routes/privacy.tsx", "/privacy", {}, {}],
    ["/about", "app/routes/about.tsx", "/about", {}, {}],
  ];

  const bundled = await bundleRoutes(cases.map((c) => c[1]));
  let rendered = 0;

  try {
    for (const [i, [route, , url, fixture, params]] of cases.entries()) {
      const mod = await importBundled(bundled.files[i]);
      let loaderData = fixture;
      /*
       * ONE ROUTE RUNS ITS OWN LOADER. /playground's is pure over the query string and reaches no
       * server module, so the real thing is available and a fixture would be a worse copy of it.
       */
      if (fixture === "RUN_THE_LOADER") {
        loaderData = await /** @type {any} */ (mod).loader({
          request: new Request(`https://dustinedwards.info${url}`),
          params,
          context: { get: () => ({}) },
        });
      }

      const html = await renderRoute(mod, { path: url, url, loaderData, params });
      const svg = inlineSvgOf(html);
      const htmlBrotli = brotliSize(Buffer.from(html, "utf8"));
      const svgBrotli = svg ? brotliSize(Buffer.from(svg, "utf8")) : 0;
      const { brotli: ceiling } = HTML_CEILINGS[route];
      rendered += 1;

      console.log(
        `  ${route.padEnd(22)} html ${String(htmlBrotli).padStart(6)} of ${String(
          ceiling,
        ).padStart(6)}   ${String(html.length).padStart(7)} raw   ` +
          `inline svg ${String(svgBrotli).padStart(5)} brotli, ` +
          `${String(Math.round((svg.length / html.length) * 100)).padStart(2)}% of the raw markup`,
      );

      ok(
        `${route}: the rendered document is under ${ceiling} brotli`,
        htmlBrotli <= ceiling,
        `${htmlBrotli} bytes, ${html.length} raw, of which ${svg.length} is inline SVG. ` +
          `A document grows by a thing at a time: a drawing, a section, a row. Raise this ` +
          `ceiling in the commit that says why and when it comes down, ruling 119, or take ` +
          `the weight back out.`,
      );
    }
  } finally {
    await bundled.cleanup();
  }

  ok(
    `${rendered} public route(s) rendered, floor ${MINIMUM_ROUTES_RENDERED}`,
    rendered >= MINIMUM_ROUTES_RENDERED,
    `${rendered} rendered. A harness that has quietly stopped working reports a clean sweep ` +
      `of nothing, which reads exactly like a page that got smaller.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (/** @type {any} */ error) {
    console.error(
      `check:page-payload failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
