/**
 * THE RUNTIME SECRETS AUDIT. PRESENCE ONLY, and that is a hard property rather than a habit.
 *
 * `check:secrets` proves secrets are only READ inside the server boundary; it cannot prove they are
 * SET, because it never runs in the Worker. This answers the other half, where the bindings exist.
 *
 * **WHAT IT MAY RETURN IS A NAME AND A BOOLEAN. Nothing else, ever:** never a VALUE; never a PARTIAL
 * value, since a masked one still leaks its shape and four characters of an OAuth secret is four an
 * attacker no longer has to guess; never a LENGTH, which narrows a guess for free and is the leak
 * people forget, because it does not look like the secret. The boolean is computed and the value
 * goes out of scope in the same expression, so there is no intermediate object for a later edit to
 * spread into the payload. `test/secrets-audit.test.mjs` asserts all three refusals.
 *
 * **ONE THING `check:secrets` CANNOT SEE HERE.** That gate finds reads by matching `env.NAME`; this
 * module reads `env[name]` dynamically, so the scan does not count these. Not a hole in the
 * boundary, because this is a `.server` module. Recorded because a reader comparing the gate's read
 * count against the code will come up short.
 */

/*
 * RELATIVE, not the `~` alias, and that is load bearing rather than style.
 * `test/secrets-audit.test.mjs` drives this function under `node:test`, which
 * has no bundler and cannot resolve `~`. The alias made the security
 * assertions unrunnable, which is the same reason `upload-contract.mjs` and
 * `media-ref-key.mjs` import nothing.
 */
import { REQUIRED_SECRETS } from "../secrets.mjs";

/** One audited secret. A name, and whether this deployment has it. */
export interface SecretPresence {
  name: string;
  present: boolean;
}

/**
 * Whether each ratified secret is set on this deployment.
 *
 * A secret counts as present when it is a non-empty string. `wrangler secret
 * put` cannot store an empty value, but a `.dev.vars` line with nothing after
 * the `=` can, and an empty string is absence wearing the type of presence.
 *
 * @param env the request's bindings, from `getEnv(context)`
 */
export function auditSecrets(env: Record<string, unknown>): SecretPresence[] {
  return REQUIRED_SECRETS.map((name) => ({
    name,
    // The value is tested and discarded in one expression. It is never bound to
    // a name in this scope, so it cannot be returned by a later edit that adds
    // a field to the object above.
    present: typeof env[name] === "string" && (env[name] as string).length > 0,
  }));
}
