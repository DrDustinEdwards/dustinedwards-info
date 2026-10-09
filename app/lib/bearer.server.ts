// The one constant-time comparison: a copy that drifts toward `===` leaks the token a byte at a
// time and no test notices. Kept `.server` because the secrets boundary is a path rule.

import { timingSafeEqual } from "node:crypto";

import { fnv1a32 } from "./bytes.mjs";

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
  // Equal-length views of fixed size, which is the shape `timingSafeEqual` requires (it throws on a length
  // mismatch). The runtime's own primitive, as Cloudflare's Workers best-practices page recommends.
  return timingSafeEqual(new Uint8Array(ha), new Uint8Array(hb));
}

/**
 * A label for commit messages and rate-limit keys. 32-bit FNV-1a is not the token and cannot be
 * read back into one, but a holder of the label can confirm a guess; `constantTimeEqual` is the
 * security boundary.
 */
export function tokenLabel(token: string): string {
  return fnv1a32(token);
}
