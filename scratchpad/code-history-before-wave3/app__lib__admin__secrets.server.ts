/**
 * THE RUNTIME SECRETS AUDIT. PRESENCE ONLY, and that is a hard property rather
 * than a habit.
 *
 * `check:secrets` proves secrets are only READ inside the server boundary. It
 * cannot prove they are SET, because it never runs in the Worker. This answers
 * the other half, at runtime, in the one place the bindings actually exist:
 * which of the ratified secrets does this deployment hold.
 *
 * ## WHAT IT MAY RETURN, AND WHY THE SHAPE IS THE GUARANTEE
 *
 * A name and a boolean. Nothing else, ever:
 *
 *   - never a VALUE, which would publish the credential to whoever opens the
 *     page and to any log that captures the loader payload
 *   - never a PARTIAL value, no prefix, no suffix, no masked middle. A masked
 *     value still leaks its shape, and four characters of an OAuth secret is
 *     four characters an attacker no longer has to guess
 *   - never a LENGTH, which narrows a guess for free and is the leak people
 *     forget, because it does not look like the secret
 *
 * The boolean is computed and the value goes out of scope in the same
 * expression. There is no intermediate object holding it, so there is nothing
 * for a later edit to accidentally spread into the payload.
 *
 * `test/secrets-audit.test.mjs` asserts both halves: that a missing secret
 * cannot report present, and that a distinctive value handed in never appears
 * in the serialised result, in whole or in any run of four characters, and that
 * every entry carries exactly the two permitted keys.
 *
 * ## ONE THING check:secrets CANNOT SEE HERE
 *
 * That gate finds reads by matching `env.NAME` for each ratified name. This
 * module reads `env[name]` dynamically, so the scan does not count these as
 * reads. That is not a hole in the boundary: this file is a `.server` module,
 * which is what the boundary rule requires, and the dynamic form is what lets
 * the list be derived rather than restated. It is recorded because a future
 * reader comparing the gate's read count against the code will come up short
 * here and should know why.
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
