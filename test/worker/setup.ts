import { refuseNetwork } from "@dustinedwards/devkit/network";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";

import { testEnv } from "./test-env";

/* The schema is the real migrations, never a hand-written CREATE TABLE that would drift from
 * production invisibly. A refusing `fetch` is installed before every case and removed after it,
 * so reaching the network is an error naming the URL; `stubGitHub` replaces it where a case
 * needs GitHub. */

beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_D1_MIGRATIONS);
});

beforeEach(() =>
  refuseNetwork({
    hint:
      "Install a stub with a recorded shape (see test/worker/github-stub.ts), " +
      "or assert the refusal if reaching for it is the defect.",
  }),
);
