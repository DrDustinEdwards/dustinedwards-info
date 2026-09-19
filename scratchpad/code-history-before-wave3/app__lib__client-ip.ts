/**
 * The client IP every rate limiter keys on, stated once.
 *
 * EXTRACTED 2026-08-25 from five identical inline reads (the auth callback,
 * the CSP report sink, the login action, the preview middleware and the Ask
 * endpoint). Five spellings of a rate-limit identity is rule 17's shape in the
 * one place drift is least affordable: an edit to one copy silently changes
 * WHO one door counts, and the other four keep counting someone else, which is
 * the N-1-of-N failure FAILURES.md opens with. Every body was the identical
 * expression, so this is a verbatim lift, not a rewrite.
 *
 * `cf-connecting-ip` is set by the Cloudflare edge on every request that
 * reaches a Worker and cannot be spoofed by the client. Absent only off the
 * edge, where `unknown` funnels every such caller into one shared counter,
 * which is the strict direction rather than the lax one: they share one bucket
 * instead of each getting their own.
 *
 * JUSTIFIED SUBSTITUTION (hard rule 13): the fallback substitutes a value, and
 * the substitution fails CLOSED. A missing header collapses all such traffic
 * into one rate bucket that exhausts quickly, rather than minting each caller
 * a fresh identity.
 */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
