// The one constant-time comparison: a copy that drifts toward `===` leaks the token a byte at a
// time and no test notices. Kept `.server` because the secrets boundary is a path rule.

/**
 * Both sides are hashed to 32 bytes first, since comparing the raw strings would still leak their
 * length through the loop bound.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);

  // Branch-free on purpose. Folding the length difference in first is what makes `?? 0` safe.
  let diff = va.length ^ vb.length;
  for (const [i, byte] of va.entries()) diff |= byte ^ (vb[i] ?? 0);
  return diff === 0;
}

/**
 * A label for commit messages and rate-limit keys. 32-bit FNV-1a is not the token and cannot be
 * read back into one, but a holder of the label can confirm a guess; `constantTimeEqual` is the
 * security boundary.
 */
export function tokenLabel(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
