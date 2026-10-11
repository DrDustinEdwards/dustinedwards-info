import type { JWTVerifyGetKey } from "jose";

import { accessKeys, verifyAccessRequest, type AccessIdentity } from "~/lib/access.server";

/**
 * Who the lab's own Cloudflare Access application says is asking (capsid docs/design/design-identity-roles.md, "How a
 * person signs in"). /lab sits behind `dustinedwards-lab-login`, a separate application from /admin's, so its token
 * carries ACCESS_LAB_AUD and never ACCESS_AUD: a /admin token is refused here for its audience, and a /lab token is
 * refused at /admin for the same reason. Being admitted by Access proves only an email; the person's row in `members`
 * decides what they may do (app/lab/actor.server.ts).
 *
 * Only the header is read, never the `CF_Authorization` cookie: two Access applications on one host each set that
 * cookie, and the header is the one Access adds for the application in front of this path.
 */
export function labIdentity(
  env: Env,
  request: Request,
  keys: (teamDomain: string) => JWTVerifyGetKey = accessKeys,
): Promise<AccessIdentity> {
  return verifyAccessRequest(env, request, { audience: env.ACCESS_LAB_AUD, cookie: false }, keys);
}
