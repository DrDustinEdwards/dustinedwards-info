/**
 * The enhancement bundles: one isolated Vite build per `app/enhance/*.ts`, in memory, run inside the
 * app build by `enhancePlugin()` and called directly by the route renderer and the tests.
 *
 * ISOLATED ON PURPOSE. Each module gets its own build with no config file, so it can share no chunk
 * with the framework and no framework code can reach it; the app build only carries the finished
 * bytes. That is what keeps React and React Router off the public plane.
 */

import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, constants } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ENHANCE_DIR = join(root, "app", "enhance");

/** The id `app/` imports the URLs and sizes from. `app/virtual-enhance.d.ts` declares its shape. */
export const ENHANCE_MODULE_ID = "virtual:enhance";
const RESOLVED_ID = `\0${ENHANCE_MODULE_ID}`;

/**
 * @typedef {{ name: string, code: string, gzipBytes: number, fileName: string, watchFiles: string[] }} EnhanceBundle
 */

/** @returns {string[]} module names, without the `.ts` */
export function enhanceModules() {
  const names = readdirSync(ENHANCE_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => name.replace(/\.ts$/, ""))
    .sort();
  if (names.length === 0) {
    throw new Error(`${ENHANCE_DIR} holds no .ts modules; nothing to bundle.`);
  }
  return names;
}

/**
 * Eight characters of base64url, so the name matches the `-[A-Za-z0-9_-]{8}.js` stem pattern every
 * script-set check strips. Derived from the bytes, so the client and server builds agree on the URL
 * without talking to each other, and check:page-payload can tell the bundle from a route chunk that
 * shares its stem by rehashing what is on disk.
 *
 * @param {string | Buffer} bytes
 */
export function contentHash(bytes) {
  return createHash("sha256").update(bytes).digest("base64url").slice(0, 8);
}

/** @param {string} name @param {string | Buffer} code */
export function enhanceFileName(name, code) {
  return `assets/${name}-${contentHash(code)}.js`;
}

// Measured here because the Worker has no filesystem. Level 9, because that is what a reader
// checking the number with `gzip -9` gets.
/** @param {string} code */
function gzipSize(code) {
  return gzipSync(Buffer.from(code, "utf8"), { level: constants.Z_BEST_COMPRESSION }).length;
}

/**
 * @param {any} node
 * @returns {string | null}
 */
function findModuleDependency(node) {
  if (node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findModuleDependency(child);
      if (hit) return hit;
    }
    return null;
  }
  if (node.type === "ImportDeclaration") return `static import of ${node.source?.value}`;
  if (node.type === "ImportExpression") return "dynamic import()";
  if (
    (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") &&
    node.source
  ) {
    return `re-export from ${node.source.value}`;
  }
  for (const key of Object.keys(node)) {
    if (key === "type") continue;
    const hit = findModuleDependency(node[key]);
    if (hit) return hit;
  }
  return null;
}

/**
 * What stops `code` standing alone, or null. The build refuses on it, and check:page-payload asks
 * again of the bytes actually served.
 *
 * @param {string} code
 * @returns {Promise<string | null>}
 */
export async function moduleDependencyOf(code) {
  const { parseAst } = await import("vite");
  return findModuleDependency(parseAst(code));
}

/**
 * @param {string} name
 * @returns {Promise<EnhanceBundle>}
 */
export async function bundleEnhancement(name) {
  // Imported here, so the readers of `contentHash` (check:page-payload, verify-live) do not load Vite.
  const { build } = await import("vite");
  const input = join(ENHANCE_DIR, `${name}.ts`);
  const result = await build({
    configFile: false,
    root,
    logLevel: "warn",
    resolve: { tsconfigPaths: true },
    build: {
      write: false,
      copyPublicDir: false,
      minify: "esbuild",
      sourcemap: false,
      rollupOptions: {
        input,
        output: {
          format: "es",
          entryFileNames: `${name}.js`,
          // One chunk per entry, dynamic imports inlined, which is what makes a lazy import legal under the
          // no-imports rule below.
          codeSplitting: false,
        },
      },
    },
  });

  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) =>
    "output" in r ? r.output : [],
  );
  // Exactly one chunk and nothing beside it: a second chunk or an emitted asset is a file the page
  // would fetch that nothing serves.
  const chunk = outputs[0];
  if (outputs.length !== 1 || chunk?.type !== "chunk") {
    throw new Error(
      `${name}.ts built to [${outputs.map((o) => o.fileName).join(", ")}], not one chunk.`,
    );
  }
  const code = chunk.code;
  if (code.trim().length === 0) {
    throw new Error(`${name}.js built empty; the bundle would enhance nothing.`);
  }
  const dependency = await moduleDependencyOf(code);
  if (dependency) {
    throw new Error(
      `${name}.js is not self-contained: it carries a ${dependency}. The bundle is served ` +
        `verbatim from /assets/, where only hashed names exist, so this would fail at ` +
        `runtime while the build stayed green.`,
    );
  }

  return {
    name,
    code,
    gzipBytes: gzipSize(code),
    fileName: enhanceFileName(name, code),
    watchFiles: chunk.moduleIds.filter((id) => !id.startsWith("\0")).map((id) => resolve(id)),
  };
}

/** @type {Promise<EnhanceBundle[]> | null} */
let memo = null;

/** Every source file any build so far read, lower-cased for Windows paths. Dev watches these. */
const watched = new Set();

/**
 * Every module, built once per process: the client and server environments of one app build, and
 * every render in one gate run, share the result. In sequence, not in parallel, for this host's
 * memory. A failure clears the memo, so the next caller rebuilds rather than inheriting it.
 *
 * @returns {Promise<EnhanceBundle[]>}
 */
export function bundleEnhancements() {
  if (!memo) {
    const pending = (async () => {
      /** @type {EnhanceBundle[]} */
      const bundles = [];
      for (const name of enhanceModules()) bundles.push(await bundleEnhancement(name));
      for (const b of bundles) for (const file of b.watchFiles) watched.add(file.toLowerCase());
      return bundles;
    })();
    // Only the memo is cleared here; the rejection still reaches every caller of `pending`.
    pending.catch(() => {
      if (memo === pending) memo = null;
    });
    memo = pending;
  }
  return memo;
}

/** Drops the memo, so the next reader rebuilds: dev calls it when a source changes. */
export function forgetEnhancements() {
  memo = null;
}

/**
 * The source of `virtual:enhance`. Keyed by module name, the URL under Vite's base.
 *
 * @param {EnhanceBundle[]} bundles @param {string} base
 */
export function enhanceModuleSource(bundles, base) {
  /** @type {Record<string, string>} */
  const urls = {};
  /** @type {Record<string, number>} */
  const sizes = {};
  for (const b of bundles) {
    urls[b.name] = `${base}${b.fileName}`;
    sizes[b.name] = b.gzipBytes;
  }
  return (
    `export const ENHANCE_URLS = ${JSON.stringify(urls)};\n` +
    `export const ENHANCE_GZIP_BYTES = ${JSON.stringify(sizes)};\n`
  );
}

/**
 * The app build's half: serves `virtual:enhance` to both environments, emits the bundles into the
 * client output, and in dev serves them from memory so `react-router dev` needs no prestep.
 *
 * @returns {import("vite").Plugin}
 */
export function enhancePlugin() {
  let base = "/";
  return {
    name: "dustinedwards:enhance",
    configResolved(config) {
      base = config.base;
    },
    resolveId(id) {
      return id === ENHANCE_MODULE_ID ? RESOLVED_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null;
      return enhanceModuleSource(await bundleEnhancements(), base);
    },
    async generateBundle() {
      // The server build needs the URLs only, and they are identical because the hash is the bytes'.
      if (this.environment.config.consumer !== "client") return;
      for (const b of await bundleEnhancements()) {
        this.emitFile({ type: "asset", fileName: b.fileName, source: b.code });
      }
    },
    configureServer(server) {
      /*
       * A changed source drops the memo and the virtual module in every environment, then reloads.
       * Nothing is rebuilt here: the reload's own request runs `load`, so a source that no longer
       * builds fails that request, where the error is seen, rather than in a watcher callback.
       */
      const onChange = (/** @type {string} */ file) => {
        const path = resolve(file).toLowerCase();
        const inEnhanceDir = dirname(path) === ENHANCE_DIR.toLowerCase();
        if (!inEnhanceDir && !watched.has(path)) return;
        forgetEnhancements();
        for (const environment of Object.values(server.environments)) {
          const mod = environment.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) environment.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.add(ENHANCE_DIR);
      server.watcher.on("change", onChange);
      server.watcher.on("add", onChange);
      server.watcher.on("unlink", onChange);

      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (!url.startsWith(`${base}assets/`)) return next();
        bundleEnhancements().then(
          (bundles) => {
            const hit = bundles.find((b) => `${base}${b.fileName}` === url);
            if (!hit) return next();
            res.setHeader("Content-Type", "text/javascript; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
            res.end(hit.code);
          },
          (/** @type {unknown} */ error) => next(error),
        );
      });
    },
  };
}
