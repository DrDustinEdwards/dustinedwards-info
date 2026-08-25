/**
 * The two primitives every static bearer credential in this repo needs.
 *
 * Extracted 2026-08-24 when the SMOKE credential became the second one. Before
 * that both lived privately in `operator/auth.server.ts` and there was one
 * caller, so there was nothing to share. There are two now, and a second copy
 * of a constant-time comparison is the rule 17 defect in the one place it is
 * least affordable: a copy that drifts toward `===` is a token recoverable a
 * byte at a time, and it would drift in silence, because both spellings return
 * the same booleans for every input a test would think to try.
 *
 * BOTH BODIES ARE LIFTED VERBATIM. Nothing here was rewritten or improved while
 * it moved. The equivalence was proven by differential against the pre-move
 * bodies over real inputs, with the comparison shown able to discriminate, per
 * hard rule 12; `test/bearer.test.mjs` keeps the discriminating half standing.
 *
 * This is a `.server` module because hard rule 3 is a PATH rule and these run
 * only inside the Worker. Neither function reads `env`, so `check:secrets` has
 * nothing to say about the file, and that is not a licence to move it: a helper
 * whose whole job is comparing a secret belongs behind the boundary whether or
 * not the gate can see it there.
 */

/**
 * Compares two strings without leaking where they diverge.
 *
 * A plain `===` on a secret returns as soon as two bytes differ, so the time it
 * takes is a function of how much of the prefix the caller guessed correctly,
 * and that is enough to recover a token a byte at a time over enough requests.
 *
 * Both sides are hashed to a fixed 32 bytes FIRST, then compared. Comparing the
 * raw strings would still leak their LENGTH through the loop bound, and hashing
 * makes both operands the same size whatever was sent.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);

  let diff = 0;
  for (let i = 0; i < va.length; i += 1) diff |= va[i] ^ vb[i];
  return diff === 0;
}

/**
 * A short, stable, non-reversing label for a token holder.
 *
 * It goes into commit messages and rate-limit keys, so it must identify the
 * caller without being the secret. Eight hex characters of a hash of the token:
 * stable across requests, changes if the token is rotated, and reveals nothing.
 *
 * Synchronous FNV-1a rather than SHA-256, because this runs after the token has
 * already been verified and is a label rather than a boundary.
 */
export function tokenLabel(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
