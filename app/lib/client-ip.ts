/**
 * The client IP every rate limiter keys on, stated once. Several spellings of a rate-limit identity
 * is rule 17's shape where drift is least affordable: an edit to one copy silently changes WHO one
 * door counts while the others keep counting someone else.
 *
 * `cf-connecting-ip` is set by the Cloudflare edge and cannot be spoofed by the client. It is
 * absent only off the edge.
 *
 * JUSTIFIED SUBSTITUTION (hard rule 13): the fallback substitutes a value, and it fails CLOSED. A
 * missing header collapses all such traffic into one rate bucket that exhausts quickly, rather than
 * minting each caller a fresh identity.
 */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
