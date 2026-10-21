import { accessKeys, verifyAccessRequest as verifyAccess } from "@dustinedwards/site-runtime/access";
import type { KeySource } from "@dustinedwards/site-runtime/access-login";

/**
 * Who Cloudflare Access says is asking. Access sits in front of /admin on the apex and signs a token
 * for each request it lets through; this reads that token and trusts nothing else. The allowed people
 * live in ONE place, the Access policy (Zero Trust > Access > Applications > dustinedwards-login >
 * Policies): anyone it admits holds a token for this application, so adding or removing an
 * administrator is a policy edit and no code or deploy.
 *
 * The token check itself (signature by a published key, RS256 pinned, issuer, audience, dates, the
 * cached key set) is the family's one copy, `@dustinedwards/site-runtime/access`. What is here is the
 * site's own reading of a verdict:
 *
 * - `human`: a person Access admitted; `email` is who (lowercased), and is what edits are attributed to.
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

/** The team's signing keys for a team domain; the shared, isolate-cached set unless a test passes its own. */
export type TeamKeys = (teamDomain: string) => KeySource;

/** Local development only: `vite dev` on localhost has no Access in front of it. */
function localDevelopment(request: Request): boolean {
  if (!import.meta.env.DEV) return false;
  const { hostname } = new URL(request.url);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * True when Access vouches that an administrator is making this request. For a public page that
 * shows a draft to the administrator only: a token that fails verification is simply not an
 * administrator here, since the admin layout is where a bad token is answered.
 */
export async function isAdminViewer(env: Env, request: Request): Promise<boolean> {
  return (await accessIdentity(env, request)).kind === "human";
}

const LOCAL_DEV_EMAIL = "dev@localhost";

export async function accessIdentity(env: Env, request: Request, keys: TeamKeys = accessKeys): Promise<AccessIdentity> {
  // The header is added only on paths the Access application covers (/admin). The same token also
  // rides in the `CF_Authorization` cookie on every path of the host, which is how a public page
  // tells the administrator is looking at it (a draft shows to them and 404s for everyone else).
  return verifyAccessRequest(env, request, { audience: env.ACCESS_AUD, cookie: true }, keys);
}

/**
 * One Access application's verdict on a request, as this site reads it: its token, from the header (or, with `cookie`,
 * the `CF_Authorization` cookie), checked against `audience`. /admin and /lab (app/lab/access.server.ts) each pass their
 * own application's tag, so a token for one is refused at the other. A key set that cannot be fetched throws.
 */
export async function verifyAccessRequest(
  env: Env,
  request: Request,
  { audience, cookie }: { audience: string; cookie: boolean },
  keys: TeamKeys = accessKeys,
): Promise<AccessIdentity> {
  if (localDevelopment(request)) return { kind: "human", email: LOCAL_DEV_EMAIL };

  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  if (!teamDomain || !audience) return { kind: "absent" };

  // The key source is made on first use, so a request with no token never touches the team domain's keys.
  let source: KeySource | undefined;
  const lazyKeys: KeySource = (kid, fresh) => (source ??= keys(teamDomain))(kid, fresh);
  const verdict = await verifyAccess(request, { teamDomain, audience, cookie, keys: lazyKeys });
  if (!verdict.ok) return verdict.reason === "not-configured" || verdict.reason === "no-token" ? { kind: "absent" } : { kind: "refused", reason: verdict.reason };

  const { email, common_name: commonName } = verdict.claims;
  if (typeof email === "string" && email !== "") return { kind: "human", email: email.toLowerCase() };
  if (typeof commonName === "string" && commonName !== "") return { kind: "service", id: commonName };
  return { kind: "refused", reason: "no-identity" };
}
