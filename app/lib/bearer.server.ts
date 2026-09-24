/**
 * The two primitives every static bearer credential in this repo needs.
 *
 * A SECOND COPY OF A CONSTANT-TIME COMPARISON is the rule 17 defect where it is least affordable: a
 * copy that drifts toward `===` is a token recoverable a byte at a time, and it drifts in silence,
 * because both spellings return the same booleans for every input a test would think to try.
 *
 * BOTH BODIES WERE LIFTED VERBATIM and proven equivalent by differential over real inputs, with the
 * comparison shown able to discriminate, per the replay rule.
 *
 * `test/bearer.test.mjs` asserts that a PREFIX is refused, and carries the naive prefix-bounded
 * implementation as a control. It does NOT assert constant time: timing a comparison in-process
 * measures the garbage collector, and a flaky assertion in the suite that gates a deploy teaches
 * people to re-run until green. `check:policy` asserts the ordering below by position.
 *
 * This is a `.server` module because the secrets-boundary rule is a PATH rule. Neither function reads `env`, so
 * `check:secrets` has nothing to say about the file, and that is not a license to move it.
 */

/**
 * Compares two strings without leaking where they diverge.
 *
 * A plain `===` returns as soon as two bytes differ, so the time it takes is a function of how much
 * of the prefix the caller guessed, which is enough to recover a token a byte at a time. Both sides
 * are hashed to a fixed 32 bytes FIRST: comparing the raw strings would still leak their LENGTH
 * through the loop bound.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);

  /*
   * THE LENGTH DIFFERENCE IS FOLDED IN FIRST, which is what makes the `?? 0` below safe: if the
   * lengths ever did differ, `diff` is already non-zero before the loop starts, so the read can never
   * flip the answer to "equal".
   *
   * Branch-free on purpose. An early return inside the loop would be a data-dependent exit from a
   * function whose whole job is not to have one.
   */
  let diff = va.length ^ vb.length;
  for (const [i, byte] of va.entries()) diff |= byte ^ (vb[i] ?? 0);
  return diff === 0;
}

/**
 * A short, stable, non-reversing label for a token holder. It goes into commit messages and
 * rate-limit keys, so it must identify the caller without being the secret: eight hex characters of
 * FNV-1a, stable across requests and different after a rotation.
 *
 * **IT DOES NOT "REVEAL NOTHING".** A 32-bit non-cryptographic digest supports that the label is not
 * the token and cannot be read back into one. It does NOT support a claim about an attacker holding
 * the label and a guess, who can confirm the guess by hashing it. The security boundary is
 * `constantTimeEqual` above, and that distinction is why a non-cryptographic hash is acceptable
 * here at all.
 */
export function tokenLabel(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
