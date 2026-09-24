/**
 * `cf-connecting-ip` is set by the edge and cannot be spoofed. The fallback fails closed: all
 * header-less traffic shares one bucket rather than each caller minting a fresh identity.
 */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
