import { env, type D1Migration } from "cloudflare:test";

/* One named narrowing rather than augmenting `Cloudflare.Env`: a global augmentation would
 * advertise `OPERATOR_TOKEN` to every file in the Worker, which `check:secrets` polices. */
export const testEnv = env as typeof env & {
  OPERATOR_TOKEN: string;
  GITHUB_TOKEN: string;
  /** `drizzle/`, read on the node side because the worker has no filesystem. */
  TEST_D1_MIGRATIONS: D1Migration[];
};
