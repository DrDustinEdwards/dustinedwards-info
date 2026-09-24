import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach, vi } from "vitest";

import { testEnv } from "./test-env";

/**
 * What every case in this layer starts from: the real schema, and no network.
 *
 * ## THE SCHEMA IS THE MIGRATIONS, NOT A FIXTURE
 *
 * The schema-source rule: `app/db/schema.ts` is the source of truth and
 * `check:invariants` section 4 binds it to `drizzle/` and to the live database.
 * A hand-written CREATE TABLE for the tests would be a FOURTH shape, outside
 * that chain, drifting in the one direction that is invisible: the tests would
 * keep passing against a schema production no longer has.
 *
 * So these are the same files `wrangler d1 migrations apply` runs, read from
 * the same directory, in the same order. A migration D1 accepts and this layer
 * cannot apply fails here loudly, which is a finding rather than a nuisance.
 *
 * `applyD1Migrations` records state in `d1_migrations` and skips what is
 * already applied, so `beforeAll` is once per file.
 *
 * ## AND THE NETWORK IS REFUSED BY DEFAULT
 *
 * FOUND BY THIS LAYER, ON ITS OWN FIRST RUN: `/api/health`'s content-drift
 * check calls GitHub, and the health cases had no stub, so a test run reached
 * `api.github.com` and got `401 Bad credentials` from the real service. The
 * assertion still passed. That is the shape a "never hits live" claim fails in
 * -- quietly, on the machine of whoever happens to hold a working token.
 *
 * A refusing `fetch` is installed before every case, so reaching the network is
 * an ERROR NAMING THE URL rather than a slow request. `stubGitHub` replaces it
 * where a case genuinely needs the boundary; nothing has to remember to opt in
 * to the refusal.
 */

beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_D1_MIGRATIONS);
});

beforeEach(() => {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    throw new Error(
      `this layer does not reach the network, and something asked for ${url}. ` +
        `Install a stub with a recorded shape (see test/worker/github-stub.ts), ` +
        `or assert the refusal if reaching for it is the defect.`,
    );
  });
});
