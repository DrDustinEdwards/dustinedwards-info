// PRESENCE ONLY: return a name and a boolean, never a value, a masked value or a length (each leaks).
// check:secrets matches `env.NAME`, so these dynamic `env[name]` reads are not in its count.

// Relative, not `~`: test/secrets-audit.test.mjs runs under node:test, which cannot resolve the alias.
import { REQUIRED_SECRETS } from "../secrets.mjs";

export interface SecretPresence {
  name: string;
  present: boolean;
}

// Empty string counts as absent: a `.dev.vars` line with nothing after `=` stores one.
export function auditSecrets(env: Record<string, unknown>): SecretPresence[] {
  return REQUIRED_SECRETS.map((name) => ({
    name,
    // Tested and discarded in one expression, never bound, so no later edit can return it.
    present: typeof env[name] === "string" && (env[name] as string).length > 0,
  }));
}
