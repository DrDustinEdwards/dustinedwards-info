import { fileURLToPath } from "node:url";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

import { islandsPlugin } from "./scripts/lib/islands.mjs";

/**
 * The Worker test layer: real modules, real workerd, real bindings.
 *
 * These tests import the module the Worker imports and
 * run it inside workerd against miniflare-local D1, KV, R2, a Durable Object
 * and `caches.default`. So they see BEHAVIOR: what a function does to a
 * database, what headers a response carries, which branch a refusal takes.
 *
 * They do NOT see:
 *
 *   the deployed build      same blindness every gate has. `verify-live` owns
 *                           the wire.
 *   the platform cache      `caches.default` in miniflare is not Cloudflare's
 *                           edge. What is asserted here is the key this Worker
 *                           BUILDS and the store/lookup decisions it makes;
 *                           whether the platform in front honors a `Vary` is
 *                           `check:browser`'s and verify-live's.
 *   GitHub                  stubbed at the outbound fetch layer with recorded
 *                           shapes. A test proves this code sends and reads
 *                           what it thinks it does, never that GitHub agrees.
 *   the route table         `workers/app.ts` renders through
 *                           `virtual:react-router/server-build`, which is a
 *                           BUILD artifact. The alias below points it at a
 *                           hand-written stub, so the transport is real and the
 *                           app behind it is not. Route modules are driven
 *                           DIRECTLY instead, by importing their own exported
 *                           loader and action, which is the real code either
 *                           way.
 *
 * That last one is the deliberate seam and is worth being explicit about: the
 * subject of the themed-cache cases is `workers/app.ts`, not the React app, and
 * stubbing the app is what makes the transport testable without a build.
 */

/**
 * The virtual module `workers/app.ts` renders through.
 *
 * Aliased rather than mocked per-test: it is an import in the module graph, so
 * a `vi.mock` would have to run before the entry is loaded in every file that
 * touches it, and one file forgetting is a silent fall-through to a resolver
 * error. One alias covers the graph.
 */
const SERVER_BUILD_STUB = fileURLToPath(
  new URL("./test/worker/stub-server-build.ts", import.meta.url),
);

/**
 * `~` is `app/`, exactly as `tsconfig.cloudflare.json` declares it.
 *
 * STATED HERE rather than left to `resolve.tsconfigPaths`. That option reads
 * the nearest tsconfig, which is the root one, and the root config carries
 * `files: []` and no `paths`: the mapping lives in the cloudflare project. So a
 * module reached through the alias above resolved its own `~` imports against
 * nothing and failed at import time. One line, and it says the same thing the
 * typechecker is already told.
 */
const APP_DIR = fileURLToPath(new URL("./app/", import.meta.url));

/**
 * The token the operator cases authenticate with.
 *
 * LONG ENOUGH TO BE ACCEPTED, and that is the point rather than an accident:
 * `authenticateOperator` refuses any configured token under 32 characters with
 * a 503, so a short fixture would send every operator case down the
 * not-configured branch and assert nothing about authentication. Not a secret:
 * it is a literal in a tracked file and grants nothing anywhere.
 */
const TEST_OPERATOR_TOKEN = "test-operator-token-0123456789abcdef";

/** The Carrel site key, over the package's 32-character minimum for the same reason. Grants nothing. */
const TEST_CARREL_SITE_KEY = "test-carrel-site-key-0123456789abcdef";

/**
 * The migrations, read on the NODE side because the worker cannot read a
 * directory.
 *
 * THE SAME FILES `wrangler d1 migrations apply` RUNS, in the same order, from
 * the same directory. That is the property that makes a D1 assertion here mean
 * anything: a hand-written schema for the tests would be a second owner of the
 * shape, and rule 11 says `app/db/schema.ts` and `drizzle/` are the owners.
 * `test/schema-invariants.test.mjs` already binds those two to the live database; a
 * fixture schema would sit outside that chain entirely.
 */
const D1_MIGRATIONS = await readD1Migrations(fileURLToPath(new URL("./drizzle", import.meta.url)));

export default defineConfig({
  /**
   * `__BUILD_ID__` is a vite `define` in the real build, so it does not exist
   * as a value anywhere a test could import. A FIXED value here is what makes
   * the build dimension assertable at all: a test can only prove the build is
   * in the cache key by holding it still and changing something else, which is
   * exactly what the key cases do.
   */
  define: {
    __BUILD_ID__: JSON.stringify("test-build-id"),
  },
  resolve: {
    tsconfigPaths: true,
    alias: [
      { find: "virtual:react-router/server-build", replacement: SERVER_BUILD_STUB },
      { find: /^~\//, replacement: APP_DIR },
    ],
  },
  plugins: [
    // Route modules read island URLs and sizes from `virtual:islands`, as in the real build.
    islandsPlugin(),
    cloudflareTest({
      /**
       * The Durable Object class has to be defined by SOME worker script for
       * the binding to resolve, and `main` is where miniflare looks. It is a
       * three-line re-export rather than `workers/app.ts` itself, because
       * pointing `main` at the real entry would make every test file pay for
       * the whole route graph to instantiate a rate limiter.
       */
      main: "./test/worker/entry.ts",
      miniflare: {
        /* Matched to wrangler.jsonc.example. A different compatibility date is
         * a different runtime, and a test layer running on one while the deploy
         * runs on another is measuring something else.
         *
         * NO FLAGS, for the reason the config states at length: from compatibility date 2026-08-04
         * `nodejs_compat` and `nodejs_compat_v2` are both on by
         * default, so listing one here would be a flag the runtime ignores and
         * a reader takes for a decision. */
        compatibilityDate: "2026-09-01",
        /*
         * ONIGURUMA, AS A COMPILED MODULE. `app/lib/content/wasm.server.ts`
         * statically imports `shiki/onig.wasm` because Workers refuse
         * `WebAssembly.instantiate()` on raw bytes, and the Cloudflare Vite
         * plugin turns that import into an already-compiled module at build
         * time. This rule is what makes the same import mean the same thing
         * here; without it the plugin tries to load the wasm as JavaScript and
         * the whole render pipeline fails to import.
         */
        modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
        d1Databases: ["DB"],
        kvNamespaces: ["APP_KV"],
        r2Buckets: ["MEDIA", "MEDIA_REVISIONS", "OG", "BACKUPS"],
        durableObjects: {
          /*
           * SQLITE-BACKED, matching `new_sqlite_classes` in the wrangler
           * config's `migrations` block. `AskBudget` keeps its counter in
           * `state.storage.sql`, so without this the class exists and every
           * `hit()` throws "SQL is not enabled for this Durable Object class",
           * which is the runtime saying the test rig and the deploy disagree
           * about what kind of object this is.
           */
          ASK_BUDGET: { className: "AskBudget", useSQLite: true },
        },
        bindings: {
          OPERATOR_TOKEN: TEST_OPERATOR_TOKEN,
          CARREL_SITE_KEY: TEST_CARREL_SITE_KEY,
          /* Handed to the worker so `setup.ts` can apply them. A JSON binding
           * is the only channel: the test isolate has no filesystem. */
          TEST_D1_MIGRATIONS: D1_MIGRATIONS,
        },
      },
    }),
  ],
  test: {
    include: ["test/worker/**/*.test.ts"],
    setupFiles: ["./test/worker/setup.ts"],
    // Off: vitest 5's file module cache sends each fresh isolate a snapshot of every cached module, and the Workers pool
    // inlines it into one WebSocket message that grows with the app, past workerd's limit ("Message is too large").
    fsModuleCache: false,
    /**
     * THE CASE BUDGET, FOR THE WHOLE LAYER RATHER THAN FIVE CASES.
     *
     * Three health endpoint cases failed inside `ship` at about 5s, the default, while the machine was busiest; each
     * was green on an idle one. A budget is only ever paid by a case that HANGS, so what it buys is that a slow
     * machine reports what the code did rather than how long it took. One owner here, not a constant on five cases.
     */
    testTimeout: 30_000,
  },
});
