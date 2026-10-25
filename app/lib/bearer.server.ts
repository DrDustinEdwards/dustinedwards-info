// The bearer tokens' label. The compare itself is the family's one constant-time copy,
// `safeEqual` from `@dustinedwards/site-runtime/compare`. Kept `.server` because the secrets
// boundary is a path rule.

import { fnv1a32 } from "./fingerprint.mjs";

/**
 * A label for commit messages and rate-limit keys. 32-bit FNV-1a is not the token and cannot be
 * read back into one, but a holder of the label can confirm a guess; `safeEqual` is the
 * security boundary.
 */
export function tokenLabel(token: string): string {
  return fnv1a32(token);
}
