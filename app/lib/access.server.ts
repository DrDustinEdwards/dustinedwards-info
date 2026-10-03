import { verifyAccessJwt } from "~/lib/access-jwt.mjs";

/**
 * Who Cloudflare Access says is asking. Access sits in front of /admin on the apex and signs a token
 * for each request it lets through; this reads that token and trusts nothing else. The allowed people
 * live in ONE place, the Access policy (Zero Trust > Access > Applications > dustinedwards-login >
 * Policies): anyone it admits holds a token for this application, so adding or removing an
 * administrator is a policy edit and no code or deploy.
 *
 * - `human`: a person Access admitted; `email` is who, and is what edits are attributed to.
 * - `service`: an Access service token (no person). Never an administrator; it only gets a request
 *   past Access, and the bearer credentials below still decide what it may do.
 * - `absent`: no token, or this Worker has no Access configuration.
 * - `refused`: a token was presented and failed verification, which is an answer and not a login page.
 */
export type AccessIdentity =
  | { kind: "human"; email: string }
  | { kind: "service"; id: string }
  | { kind: "absent" }
  | { kind: "refused"; reason: string };

const JWKS_CACHE_SECONDS = 3600;

type Jwks = Parameters<typeof verifyAccessJwt>[1];

async function fetchJwks(teamDomain: string): Promise<Jwks> {
  // Cached at the edge: Access publishes the next signing key before it rotates, so an hour-old copy
  // holds every key a live token can name. Unknown keys are refused, never refetched, so a forged
  // `kid` cannot make this Worker hammer the certs endpoint.
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    cf: { cacheTtl: JWKS_CACHE_SECONDS, cacheEverything: true },
  });
  if (!response.ok) {
    throw new Error(`Cloudflare Access signing keys unavailable: ${teamDomain} answered ${response.status}.`);
  }
  return (await response.json()) as Jwks;
}

/** Local development only: `vite dev` on localhost has no Access in front of it. */
function localDevelopment(request: Request): boolean {
  if (!import.meta.env.DEV) return false;
  const { hostname } = new URL(request.url);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/**
 * True when Access vouches that an administrator is making this request. For a public page that
 * shows a draft to the administrator only: a token that fails verification is simply not an
 * administrator here, since the admin layout is where a bad token is answered.
 */
export async function isAdminViewer(env: Env, request: Request): Promise<boolean> {
  return (await accessIdentity(env, request)).kind === "human";
}

export const LOCAL_DEV_EMAIL = "dev@localhost";

export async function accessIdentity(
  env: Env,
  request: Request,
  keys: (teamDomain: string) => Promise<Jwks> = fetchJwks,
): Promise<AccessIdentity> {
  if (localDevelopment(request)) return { kind: "human", email: LOCAL_DEV_EMAIL };

  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (!teamDomain || !audience) return { kind: "absent" };

  // The header is added only on paths the Access application covers (/admin). The same token also
  // rides in the `CF_Authorization` cookie on every path of the host, which is how a public page
  // tells the administrator is looking at it (a draft shows to them and 404s for everyone else).
  const token = request.headers.get("cf-access-jwt-assertion") ?? cookieValue(request, "CF_Authorization");
  if (!token) return { kind: "absent" };

  const verdict = await verifyAccessJwt(token, await keys(teamDomain), {
    issuer: `https://${teamDomain}`,
    audience,
    now: Math.floor(Date.now() / 1000),
  });
  if (!verdict.ok) return { kind: "refused", reason: verdict.reason };

  const { email, common_name: commonName } = verdict.claims;
  if (typeof email === "string" && email !== "") return { kind: "human", email: email.toLowerCase() };
  if (typeof commonName === "string" && commonName !== "") return { kind: "service", id: commonName };
  return { kind: "refused", reason: "no-identity" };
}
