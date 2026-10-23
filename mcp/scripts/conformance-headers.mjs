// Security headers on the real entry, run last by devkit-conformance (.conformance.json "after"). Unit tests grade the
// handlers through withSecurityHeaders; only here does a response leave src/index.ts itself, so only here can a route that
// skips the wrapper be seen. Graded by the shared package's own check against the set this Worker declares.

const GRADED = [
  ["GET /health", "/health", {}],
  ["GET a 404", "/nowhere", {}],
  ["GET /authorize", "/authorize?response_type=code&client_id=x", { redirect: "manual" }],
  ["GET /callback", "/callback", {}],
  ["POST /mcp without a token", "/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }],
  ["GET the AS metadata", "/.well-known/oauth-authorization-server", {}],
  ["GET the PRM, path-scoped", "/.well-known/oauth-protected-resource/mcp", {}],
  ["POST /csp-report", "/csp-report", { method: "POST", body: "{}" }],
];

export default async function securityHeaderChecks({ origin, pass, fail }) {
  await import("../test/resolve-ts.mjs");
  const { securityHeaders } = await import("../src/security-headers.ts");
  const { checkSecurityHeaders, failures } = await import("@dustinedwards/site-runtime/check");
  for (const [label, path, init] of GRADED) {
    const res = await fetch(`${origin}${path}`, init);
    await res.arrayBuffer();
    const bad = failures(checkSecurityHeaders(res.headers, { standard: securityHeaders }));
    if (bad.length === 0) pass(`security headers on ${label} (status ${res.status})`);
    else fail(`security headers on ${label} (status ${res.status}): ${bad.map((b) => b.name).join("; ")}`);
  }
}
