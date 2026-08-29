import { env, type D1Migration } from "cloudflare:test";

/**
 * `env`, plus the three values `vitest.config.ts` adds for the tests.
 *
 * ## ONE CAST, IN ONE PLACE, AND NOT AN AUGMENTATION
 *
 * `cloudflare:test` types `env` as `Cloudflare.Env`, which `wrangler types`
 * generates from the wrangler config. The config declares bindings; it does not
 * declare the operator token (a `wrangler secret`, deliberately absent) nor the
 * migrations array, which exists only here.
 *
 * The tempting fix is to widen `Cloudflare.Env` itself. That would be WRONG in
 * a way that costs a real guard: `check:secrets` polices where a secret may be
 * read, and the app's own code adds `OPERATOR_TOKEN` by a local intersection at
 * each server module precisely so the type does not advertise it everywhere. A
 * global augmentation would hand every file in the Worker project a secret it
 * is not entitled to see, to make a test file compile.
 *
 * So: one narrowing here, named, with the reason attached. Every case imports
 * this instead of casting, which is the difference between one claim that is
 * checked and thirty that are not.
 */
export const testEnv = env as typeof env & {
  /** The operator bearer fixture. Grounds and the length rule in `vitest.config.ts`. */
  OPERATOR_TOKEN: string;
  /** The editor's GitHub token. Every call that uses it is stubbed at `fetch`. */
  GITHUB_TOKEN: string;
  /** `drizzle/`, read on the node side because the worker has no filesystem. */
  TEST_D1_MIGRATIONS: D1Migration[];
};
